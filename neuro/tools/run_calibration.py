"""Send the 100 calibration texts to the neuro API, then compare the four versions.

    python tools/run_calibration.py https://<workspace>--neuro-engagement-neuro-neuro-score.modal.run
    python tools/build_reference.py        # afterwards: refresh data/reference.json

Results are saved after every text (data/calibration_results.jsonl), so it can be stopped and re-run.
"""

import json
import sys
import urllib.request
from pathlib import Path

import numpy as np

DATA = Path(__file__).parents[1] / "data"
sys.path.insert(0, str(DATA))
from calibration_texts import build  # noqa: E402

RESULTS = DATA / "calibration_results.jsonl"


def call(url: str, words: list[dict]) -> dict:
    req = urllib.request.Request(url, json.dumps({"words": words, "detail": True}).encode(),
                                 {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.load(r)


def collect(url: str) -> None:
    done = {json.loads(line)["id"] for line in RESULTS.read_text().splitlines()} if RESULTS.exists() else set()
    items = [i for i in build() if i["id"] not in done]
    for n, item in enumerate(items, 1):
        res = call(url, item["words"])
        with RESULTS.open("a") as f:
            f.write(json.dumps({"id": item["id"], "topic": item["topic"], "kind": item["kind"],
                                "raw": res["raw"], "rois": res["rois"]}) + "\n")
        print(f"[{n}/{len(items)}] {item['id']}: raw {res['raw']:.3f}")


def paired(a: np.ndarray, b: np.ndarray) -> tuple[float, float, float]:
    """mean difference, paired t statistic, share of pairs where a > b"""
    d = a - b
    return float(d.mean()), float(d.mean() / (d.std(ddof=1) / np.sqrt(len(d)) + 1e-12)), float((d > 0).mean())


def analyse() -> None:
    rows = [json.loads(line) for line in RESULTS.read_text().splitlines()]
    topics = sorted({r["topic"] for r in rows})
    by = {(r["topic"], r["kind"]): r for r in rows}
    topics = [t for t in topics if all((t, k) in by for k in ("engaging", "flat", "filler", "scrambled"))]
    rois = sorted(rows[0]["rois"])
    print(f"\n{len(topics)} complete topics\n")

    def vec(kind, key=None):
        return np.array([by[(t, kind)]["raw"] if key is None else by[(t, kind)]["rois"][key] for t in topics])

    print("CURRENT SCORE (language + social + auditory), mean raw value per version:")
    for k in ("engaging", "flat", "filler", "scrambled"):
        print(f"  {k:10s} {vec(k).mean():.3f}")
    report = {}
    for a, b in [("engaging", "flat"), ("engaging", "scrambled"), ("flat", "filler")]:
        diff, t, win = paired(vec(a), vec(b))
        print(f"  {a} vs {b}: diff {diff:+.3f}, t = {t:+.1f}, {a} higher in {win:.0%} of topics")
        report[f"{a}_vs_{b}"] = {"diff": diff, "t": t, "win_rate": win}

    print("\nBRAIN REGIONS that separate engaging from flat (paired t; |t| > 3.7 survives correction for 180 regions):")
    stats = sorted(((paired(vec("engaging", r), vec("flat", r)), r) for r in rois), key=lambda x: -x[0][1])
    for label, sel in [("higher for ENGAGING", stats[:12]), ("higher for FLAT", stats[-8:][::-1])]:
        print(f"  {label}:")
        for (diff, t, win), r in sel:
            print(f"    {r:8s} t = {t:+5.1f}  diff {diff:+.3f}  wins {win:.0%}")
    report["regions_engaging_vs_flat"] = [{"roi": r, "diff": d, "t": t, "win_rate": w} for (d, t, w), r in stats]
    (DATA / "calibration_report.json").write_text(json.dumps(report, indent=1))
    print("\nSaved data/calibration_report.json")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        collect(sys.argv[1])
    analyse()
