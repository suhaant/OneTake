"""TRIBE v2 neuro API on Modal (https://modal.com).

Setup once:
    pip install modal && modal setup
    modal secret create huggingface HF_TOKEN=hf_xxx     # read token with Llama-3.2 access
Deploy (from this folder):
    modal deploy modal_app.py                            # prints the two endpoint URLs

Endpoints (both POST, JSON in, JSON out):
    .../neuro-score   {"words": [{"text": "Hello", "start": 0.4, "end": 0.7}, ...], "brain": true}
    .../analyze       {"media_b64": "<base64 of a video or audio file>", "filename": "speech.mp4"}
                      or {"media_url": "https://.../speech.mp4"}
"""

from pathlib import Path

import modal

GPU = "A100"  # "L4" is the cheapest that works well; "A10G" / "L40S" sit in between
HERE = Path(__file__).parent
MAX_MEDIA_MB = 200

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .pip_install("tribev2 @ git+https://github.com/facebookresearch/tribev2.git",
                 "nibabel", "fastapi[standard]")
    .run_commands("python -m spacy download en_core_web_lg")
    .add_local_file(HERE / "neuro_core.py", "/root/neuro_core.py")
    .add_local_file(HERE.parent / "scoring.py", "/root/scoring.py")
    .add_local_file(HERE.parent / "data" / "reference.json", "/root/reference.json")
)
app = modal.App("neuro-engagement", image=image)
weights = modal.Volume.from_name("neuro-weights", create_if_missing=True)  # model cache survives restarts


@app.cls(gpu=GPU, secrets=[modal.Secret.from_name("huggingface")],
         volumes={"/cache": weights}, scaledown_window=600, timeout=900,
         env={"HF_HOME": "/cache/hf"})
class Neuro:
    @modal.enter()
    def load(self):
        import neuro_core

        self.core = neuro_core
        self.model = neuro_core.load_model("/cache/tribe")
        self.roi = neuro_core.load_atlas("/cache/atlas")
        self.asr = neuro_core.load_asr()
        # warm up Llama so the first real request is fast
        warm = [{"text": w, "start": i * 0.4, "end": i * 0.4 + 0.3}
                for i, w in enumerate("This is a short warm up sentence for the model.".split())]
        neuro_core.neuro_score(self.model, self.roi, warm)
        weights.commit()

    @modal.fastapi_endpoint(method="POST")
    def neuro_score(self, body: dict):
        """Transcript with word timings -> scores, ranking, regions (and the brain map if "brain" is true)."""
        from fastapi import HTTPException

        try:
            return self.core.neuro_score(self.model, self.roi, body["words"], body.get("detail", False),
                                         bool(body.get("brain")))
        except (KeyError, ValueError) as e:
            raise HTTPException(status_code=400, detail=str(e))

    @modal.fastapi_endpoint(method="POST")
    def analyze(self, body: dict):
        """Video or audio file -> transcript -> everything neuro_score returns, plus the brain map."""
        import base64
        import urllib.request

        from fastapi import HTTPException

        try:
            if "media_b64" in body:
                media = base64.b64decode(body["media_b64"])
                name = body.get("filename", "clip.mp4")
            else:
                name = body["media_url"]
                if not name.startswith("https://"):
                    raise ValueError("media_url must start with https://")
                with urllib.request.urlopen(name, timeout=120) as r:
                    media = r.read(MAX_MEDIA_MB * 2**20 + 1)
            if len(media) > MAX_MEDIA_MB * 2**20:
                raise ValueError(f"File is larger than {MAX_MEDIA_MB} MB")
            suffix = Path(name.split("?")[0]).suffix or ".mp4"
            return self.core.analyze_media(self.model, self.roi, self.asr, media, suffix,
                                           brain=body.get("brain", True))
        except (KeyError, ValueError) as e:
            raise HTTPException(status_code=400, detail=str(e))
