"""Transcript-only TRIBE v2 scoring.

video or audio -> transcript with word timings (Whisper) -> predicted brain response per second
(TRIBE v2, text pathway only) -> raw score, its rank against the calibration texts, the regions
that responded, and a per-vertex map for the 3D viewer.
"""

import base64
import re
import subprocess
import tempfile
import urllib.request
from pathlib import Path

import nibabel as nib
import numpy as np
import pandas as pd
import torch

import scoring

NETWORKS = {  # HCP-MMP1 regions; the ones a transcript can drive
    "language": ["44", "45", "47l", "55b", "IFSa", "IFSp", "IFJa", "STSda", "STSdp",
                 "STSva", "STSvp", "STGa", "TPOJ1", "PSL", "SFL"],
    "social": ["TPOJ2", "PGi", "PGs", "STV", "TE1a", "TGd"],
    "auditory": ["A1", "LBelt", "MBelt", "PBelt", "RI", "A4", "A5"],
}
ATLAS_URLS = {"lh": "https://ndownloader.figshare.com/files/5528816",
              "rh": "https://ndownloader.figshare.com/files/5528819"}
N_VERT = 10242  # fsaverage5 vertices per hemisphere
HOOK_SEC = 5
# Mean / std of the engagement curve over a reference set of clips. PLACEHOLDERS:
# replace with values from your own calibration clips (see calibrate()).
REF_MEAN, REF_STD = 0.15, 0.15


def load_atlas(folder: str | Path = "hcp_atlas") -> np.ndarray:
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    roi: list[str] = []
    for hemi, url in ATLAS_URLS.items():
        annot = folder / f"{hemi}.HCPMMP1.annot"
        if not annot.exists():
            urllib.request.urlretrieve(url, annot)
        labels, _, names = nib.freesurfer.read_annot(str(annot))
        names = [n.decode()[2:].replace("_ROI", "") for n in names]
        roi += [names[i] if i >= 0 else "" for i in labels[:N_VERT]]
    return np.array(roi)


def load_model(cache_folder: str = "./cache"):
    from tribev2.demo_utils import TribeModel

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda" and not torch.cuda.is_bf16_supported(including_emulation=False):
        # Older GPUs (T4) have no native bfloat16, so Llama crawls; load it as float16 instead.
        import transformers

        orig = transformers.AutoModel.from_pretrained.__func__

        def fp16_llama(cls, name, *a, **k):
            if "Llama" in str(name):
                k.setdefault("dtype", torch.float16)
            return orig(cls, name, *a, **k)

        transformers.AutoModel.from_pretrained = classmethod(fp16_llama)
    return TribeModel.from_pretrained(
        "facebook/tribev2", cache_folder=cache_folder,
        config_update={"data.text_feature.device": device},  # released config hard-codes cuda
    )


def words_to_events(words: list[dict]) -> pd.DataFrame:
    """[{text, start, end}, ...] -> TRIBE events dataframe (Word events only)."""
    from tribev2.demo_utils import (AddContextToWords, AddSentenceToWords, AddText,
                                    RemoveMissing, standardize_events)

    sentences, current = [], []
    for w in words:
        current.append(w)
        if re.search(r"[.!?]$", w["text"].strip()):
            sentences.append(current)
            current = []
    if current:
        sentences.append(current)
    rows = []
    for i, sent in enumerate(sentences):
        sentence = " ".join(w["text"].strip() for w in sent)
        for w in sent:
            rows.append(dict(type="Word", text=w["text"].strip(), start=float(w["start"]),
                             duration=max(float(w["end"]) - float(w["start"]), 0.01),
                             sequence_id=i, sentence=sentence, timeline="default", subject="default"))
    events = standardize_events(pd.DataFrame(rows))
    for transform in [AddText(), AddSentenceToWords(max_unmatched_ratio=0.05),
                      AddContextToWords(sentence_only=False, max_context_len=1024, split_field=""),
                      RemoveMissing()]:
        events = transform(events)
    return standardize_events(events)


def engagement_curve(preds: np.ndarray, starts: np.ndarray, roi: np.ndarray) -> dict[str, np.ndarray]:
    """Per-second predicted activity for each network, plus their mean ('overall')."""
    idx = np.round(starts).astype(int)
    idx -= min(idx.min(), 0)
    out = {}
    for name, rois in NETWORKS.items():
        tc = np.full(idx.max() + 1, np.nan)
        tc[idx] = preds[:, np.isin(roi, rois)].mean(1)
        out[name] = tc
    out["overall"] = np.nanmean([out[n] for n in NETWORKS], axis=0)
    return out


def to_score(x: float) -> int:
    """Raw engagement -> 0-100 against the reference clips (50 = average clip)."""
    return int(round(100 / (1 + np.exp(-1.7 * (x - REF_MEAN) / REF_STD))))


MAX_FRAMES = 90  # time steps sent to the viewer; longer clips are averaged down to this many


def brain_payload(preds: np.ndarray, starts: np.ndarray) -> dict:
    """Per-vertex predictions for the viewer, exactly as TRIBE returns them (fsaverage5: 10,242
    left-hemisphere vertices, then 10,242 right). Nothing is smoothed, thresholded or re-ordered.

    mean   : average over the clip, one float per vertex
    frames : the time course, int8-quantised (value = int8 / 127 * frame_scale), base64
    """
    step = int(np.ceil(len(preds) / MAX_FRAMES))
    n = len(preds) // step * step or len(preds)
    frames = preds[:n].reshape(-1, step, preds.shape[1]).mean(1) if step > 1 else preds
    scale = float(np.abs(frames).max()) or 1.0
    q = np.clip(np.round(frames / scale * 127), -127, 127).astype(np.int8)
    return {
        "space": "fsaverage5", "n_vertices": int(preds.shape[1]), "hemisphere_order": ["left", "right"],
        "units": "predicted fMRI response (TRIBE v2 model units, average subject)",
        "mean": np.round(preds.mean(0), 3).tolist(),
        "frame_t": [float(t) for t in starts[:n:step]], "frame_seconds": step,
        "frame_scale": round(scale, 4), "frames_int8_b64": base64.b64encode(q.tobytes()).decode(),
    }


def neuro_score(model, roi: np.ndarray, words: list[dict], detail: bool | str = False,
                brain: bool = False) -> dict:
    """detail="timeseries" adds per-second activity for every HCP region (for validation);
    brain=True adds the per-vertex map for the 3D viewer."""
    if len(words) < 5:
        raise ValueError("Need at least 5 words")
    preds, segments = model.predict(events=words_to_events(words), verbose=False)
    starts = np.array([s.start for s in segments])
    names = sorted(set(roi) - {"", "?"})
    mean = preds.mean(0)
    rois = {r: round(float(mean[roi == r].mean()), 4) for r in names}
    extra = {}
    if detail == "timeseries":
        extra["roi_names"] = names
        extra["roi_t"] = [int(round(t)) for t in starts]
        extra["roi_ts"] = np.stack([preds[:, roi == r].mean(1) for r in names], 1).round(3).tolist()
    if brain:
        extra["brain"] = brain_payload(preds, starts)
    curves = engagement_curve(preds, starts, roi)
    e = curves["overall"]
    sm = pd.Series(e).rolling(3, center=True, min_periods=1).mean().to_numpy()
    peak, dip = int(np.nanargmax(sm)), int(np.nanargmin(sm))

    def said(t: int) -> str:
        return " ".join(w["text"].strip() for w in words if t - 1 <= w["start"] < t + 2)

    raw = round(float(np.nanmean(e)), 4)
    return {
        "raw": raw,
        "ranking": scoring.rank(raw, rois),
        "peak": {"t": peak, "text": said(peak)},
        "dip": {"t": dip, "text": said(dip)},
        "curve": [None if np.isnan(v) else round(float(v), 3) for v in e],
        "rois": rois,
        # kept for older clients; uses placeholder reference values, prefer "ranking"
        "score": to_score(float(np.nanmean(e))),
        "hook": to_score(float(np.nanmean(e[:HOOK_SEC]))),
        "networks": {n: to_score(float(np.nanmean(curves[n]))) for n in NETWORKS},
        **extra,
    }


# ---------- video / audio -> words ----------

WHISPER_MODEL = "openai/whisper-medium.en"


def load_asr():
    from transformers import pipeline

    cuda = torch.cuda.is_available()
    return pipeline("automatic-speech-recognition", model=WHISPER_MODEL, chunk_length_s=30,
                    device=0 if cuda else -1, torch_dtype=torch.float16 if cuda else torch.float32)


def transcribe(asr, media: bytes, suffix: str = ".mp4") -> list[dict]:
    """Any video or audio file -> [{text, start, end}, ...] with one entry per spoken word."""
    with tempfile.TemporaryDirectory() as tmp:
        src, wav = Path(tmp) / f"in{suffix}", Path(tmp) / "audio.wav"
        src.write_bytes(media)
        done = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn", "-ac", "1",
                               "-ar", "16000", str(wav)], capture_output=True, text=True)
        if done.returncode != 0 or not wav.exists():
            raise ValueError(f"Could not read audio from the file: {done.stderr.strip()[-300:]}")
        out = asr(str(wav), return_timestamps="word")
    words, last = [], 0.0
    for chunk in out["chunks"]:
        start, end = chunk["timestamp"]
        start = last if start is None else float(start)
        end = start + 0.3 if end is None else float(end)
        text = chunk["text"].strip()
        if text:
            words.append({"text": text, "start": round(start, 2), "end": round(max(end, start + 0.01), 2)})
        last = end
    return words


def analyze_media(model, roi: np.ndarray, asr, media: bytes, suffix: str = ".mp4", brain: bool = True) -> dict:
    words = transcribe(asr, media, suffix)
    if len(words) < 5:
        raise ValueError(f"Only {len(words)} words of speech found; need at least 5")
    result = neuro_score(model, roi, words, brain=brain)
    return {"transcript": " ".join(w["text"] for w in words), "words": words, **result}


def calibrate(model, roi: np.ndarray, clips: list[list[dict]]) -> tuple[float, float]:
    """Run reference clips; returns (REF_MEAN, REF_STD) to paste above."""
    means = []
    for words in clips:
        preds, segments = model.predict(events=words_to_events(words), verbose=False)
        means.append(np.nanmean(engagement_curve(preds, np.array([s.start for s in segments]), roi)["overall"]))
    return float(np.mean(means)), float(np.std(means))
