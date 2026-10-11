"""Frame-by-frame delivery measurements with MediaPipe (face, pose, and hand landmarks).

Every 0.2 s of video becomes one sample, and each metric is the share of samples that pass a geometric test.
Thresholds are relative to the speaker's own median pose, because phone height and angle vary between takes.
"""
from __future__ import annotations

import math
import statistics
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path

SAMPLE_FPS = 5
GAZE_TOLERANCE_DEG = 10         # "looking at the lens" = gaze within 10° of the speaker's forward direction
EYE_DEG_PER_UNIT = 30           # MediaPipe eyeLook* blendshapes run 0–1 over roughly 30° of eye rotation
MAX_HEAD_ROLL_DEG = 15          # sideways head tilt
MAX_HEAD_PITCH_SHIFT_DEG = 20   # tipping the head back or down, relative to the speaker's median
MAX_NOSE_DROP = 0.10            # head sinking toward the shoulders, in shoulder widths
MAX_SHOULDER_TILT_DEG = 8
MAX_TORSO_SHIFT = 0.15          # leaning/swaying away from the median position, in shoulder widths
HAND_MOVE_THRESHOLD = 0.02      # hand centroid travel between samples, as a fraction of frame size
FACE_BOX_MARGIN = 0.2           # a hand inside the face box (+20%) counts as touching the face

MODELS = {
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
    "pose_landmarker_lite.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
    "hand_landmarker.task": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
}
MODEL_DIR = Path(__file__).resolve().parent.parent / "models"


@dataclass(frozen=True)
class DeliveryMeasurements:
    samples: int
    face_visible_ratio: float
    eye_contact_ratio: float   # share of samples looking at the lens
    upright_ratio: float       # share of samples upright and steady
    gesture_ratio: float       # share of samples with a visible hand moving (not touching the face)
    face_touch_ratio: float    # share of samples with a hand on the face

    def to_dict(self) -> dict[str, float | int]: return {k: (round(v, 3) if isinstance(v, float) else v) for k, v in asdict(self).items()}


def _model(name: str) -> str:
    path = MODEL_DIR / name
    if not path.exists():
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(MODELS[name], path)
    return str(path)


def _sample_frames(video_path: str | Path):
    import cv2
    capture = cv2.VideoCapture(str(video_path))  # applies the phone's rotation metadata
    next_t = 0.0
    try:
        while True:
            ok, frame = capture.read()
            if not ok: return
            t = capture.get(cv2.CAP_PROP_POS_MSEC) / 1000
            if t + 1e-6 < next_t: continue
            next_t += 1 / SAMPLE_FPS
            h, w = frame.shape[:2]; scale = 640 / max(h, w)
            yield t, cv2.cvtColor(cv2.resize(frame, (int(w * scale), int(h * scale))), cv2.COLOR_BGR2RGB)
    finally:
        capture.release()


def _landmark_frames(video_path: str | Path) -> list[dict]:
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision
    video = vision.RunningMode.VIDEO
    face = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=_model("face_landmarker.task")), running_mode=video, output_face_blendshapes=True, output_facial_transformation_matrixes=True))
    pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=_model("pose_landmarker_lite.task")), running_mode=video))
    hands = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(base_options=BaseOptions(model_asset_path=_model("hand_landmarker.task")), running_mode=video, num_hands=2))
    frames: list[dict] = []
    with face, pose, hands:
        for t, rgb in _sample_frames(video_path):
            image, ms = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(t * 1000)
            f, p, h = face.detect_for_video(image, ms), pose.detect_for_video(image, ms), hands.detect_for_video(image, ms)
            frame: dict = {"t": t, "hands": [(sum(l.x for l in hand) / len(hand), sum(l.y for l in hand) / len(hand)) for hand in h.hand_landmarks]}
            if f.face_landmarks:
                m = f.facial_transformation_matrixes[0]  # head rotation relative to the camera
                b = {c.category_name: c.score for c in f.face_blendshapes[0]}
                xs, ys = [l.x for l in f.face_landmarks[0]], [l.y for l in f.face_landmarks[0]]
                frame |= {
                    "pitch": math.degrees(math.atan2(m[2][1], m[2][2])),  # negative = looking up
                    "yaw": math.degrees(math.asin(max(-1.0, min(1.0, -m[2][0])))),
                    "roll": math.degrees(math.atan2(m[1][0], m[0][0])),
                    "eye_vertical": (b["eyeLookDownLeft"] + b["eyeLookDownRight"] - b["eyeLookUpLeft"] - b["eyeLookUpRight"]) / 2,
                    "eye_horizontal": (b["eyeLookInLeft"] + b["eyeLookOutRight"] - b["eyeLookOutLeft"] - b["eyeLookInRight"]) / 2,
                    "face_box": (min(xs), min(ys), max(xs), max(ys)),
                }
            if p.pose_landmarks:
                lm = p.pose_landmarks[0]
                left, right, nose = lm[11], lm[12], lm[0]
                width = max(abs(left.x - right.x), 1e-3)
                frame |= {
                    "shoulder_tilt": abs(math.degrees(math.atan2(right.y - left.y, right.x - left.x))) % 180,
                    "nose_height": ((left.y + right.y) / 2 - nose.y) / width,
                    "torso": ((left.x + right.x) / 2, (left.y + right.y) / 2), "shoulder_width": width,
                }
            frames.append(frame)
    return frames


def _ratio(flags: list[bool]) -> float: return sum(flags) / len(flags) if flags else 0.0


def measure_delivery(video_path: str | Path) -> DeliveryMeasurements:
    frames = _landmark_frames(video_path)
    if not frames: raise RuntimeError("Could not read any video frames")
    faces = [f for f in frames if "pitch" in f]
    bodies = [f for f in frames if "nose_height" in f]
    if not faces: raise RuntimeError("No face was visible in the video; keep your face in frame")
    median = lambda key, rows: statistics.median(r[key] for r in rows)
    gaze_pitch = lambda f: f["pitch"] + EYE_DEG_PER_UNIT * f["eye_vertical"]
    forward_pitch = statistics.median(gaze_pitch(f) for f in faces)
    forward_yaw, forward_eye_h, head_pitch = median("yaw", faces), median("eye_horizontal", faces), median("pitch", faces)
    nose_height = median("nose_height", bodies) if bodies else 0.0
    torso_x = statistics.median(f["torso"][0] for f in bodies) if bodies else 0.0
    torso_y = statistics.median(f["torso"][1] for f in bodies) if bodies else 0.0

    def looking(f: dict) -> bool:
        return ("pitch" in f and abs(gaze_pitch(f) - forward_pitch) <= GAZE_TOLERANCE_DEG and abs(f["yaw"] - forward_yaw) <= GAZE_TOLERANCE_DEG
                and EYE_DEG_PER_UNIT * abs(f["eye_horizontal"] - forward_eye_h) <= GAZE_TOLERANCE_DEG)

    def upright(f: dict) -> bool:
        if "pitch" not in f or "nose_height" not in f: return False
        shoulder_tilt = min(f["shoulder_tilt"], 180 - f["shoulder_tilt"])
        return (abs(f["roll"]) <= MAX_HEAD_ROLL_DEG and abs(f["pitch"] - head_pitch) <= MAX_HEAD_PITCH_SHIFT_DEG and nose_height - f["nose_height"] <= MAX_NOSE_DROP
                and shoulder_tilt <= MAX_SHOULDER_TILT_DEG and math.hypot(f["torso"][0] - torso_x, f["torso"][1] - torso_y) / f["shoulder_width"] <= MAX_TORSO_SHIFT)

    gesturing, touching, previous = [], [], []
    for f in frames:
        box, touch, moving = f.get("face_box"), False, False
        for x, y in f["hands"]:
            if box:
                mx, my = (box[2] - box[0]) * FACE_BOX_MARGIN, (box[3] - box[1]) * FACE_BOX_MARGIN
                if box[0] - mx <= x <= box[2] + mx and box[1] - my <= y <= box[3] + my: touch = True; continue
            if any(math.hypot(x - px, y - py) > HAND_MOVE_THRESHOLD for px, py in previous): moving = True
        gesturing.append(moving and not touch); touching.append(touch); previous = f["hands"]

    return DeliveryMeasurements(samples=len(frames), face_visible_ratio=len(faces) / len(frames), eye_contact_ratio=_ratio([looking(f) for f in frames]),
                                upright_ratio=_ratio([upright(f) for f in frames]), gesture_ratio=_ratio(gesturing), face_touch_ratio=_ratio(touching))
