"""Turn the calibration run (data/calibration_results.jsonl) into data/reference.json,
the lookup table scoring.py ranks new transcripts against.

    python tools/build_reference.py
"""

import json
from pathlib import Path

import numpy as np

DATA = Path(__file__).parents[1] / "data"
KINDS = ("engaging", "flat", "filler", "scrambled")
NETWORKS = {
    "language": ["44", "45", "47l", "55b", "IFSa", "IFSp", "IFJa", "STSda", "STSdp", "STSva", "STSvp",
                 "STGa", "TPOJ1", "PSL", "SFL"],
    "social": ["TPOJ2", "PGi", "PGs", "STV", "TE1a", "TGd"],
    "auditory": ["A1", "LBelt", "MBelt", "PBelt", "RI", "A4", "A5"],
    "default_mode": ["7m", "POS1", "v23ab", "d23ab", "31pv", "31pd", "RSC", "PCV", "10r", "10v", "9m",
                     "p32", "a24", "d32", "s32", "10d", "PGi", "PGs", "PFm", "TE1a", "TE1m"],
}
PLUS_T, MINUS_T = 1.5, -3.7  # thresholds used in the analysis (see ANALYSIS.md)


def main() -> None:
    rows = [json.loads(line) for line in (DATA / "calibration_results.jsonl").read_text().splitlines()]
    by = {(r["topic"], r["kind"]): r for r in rows}
    topics = sorted({r["topic"] for r in rows})
    rois = sorted(rows[0]["rois"])

    def paired_t(a: str, b: str, roi: str) -> float:
        d = np.array([by[(t, a)]["rois"][roi] - by[(t, b)]["rois"][roi] for t in topics])
        return float(d.mean() / (d.std(ddof=1) / np.sqrt(len(d))))

    vs_flat = {r: paired_t("engaging", "flat", r) for r in rois}
    vs_scrambled = {r: paired_t("engaging", "scrambled", r) for r in rois}
    # regions higher for engaging text than for BOTH flat and scrambled text, and the reverse
    plus = [r for r in rois if min(vs_flat[r], vs_scrambled[r]) > PLUS_T]
    minus = [r for r in rois if max(vs_flat[r], vs_scrambled[r]) < MINUS_T]

    def vivid(rd: dict) -> float:
        return float(np.mean([rd[r] for r in plus]) - np.mean([rd[r] for r in minus]))

    def net(rd: dict, name: str) -> float:
        return float(np.mean([rd[r] for r in NETWORKS[name]]))

    def per_kind(fn) -> dict:
        return {k: sorted(round(fn(by[(t, k)]), 4) for t in topics) for k in KINDS}

    natural = [by[(t, k)]["rois"] for t in topics for k in ("engaging", "flat")]
    reference = {
        "about": "100 calibration texts (25 topics x engaging / flat / flat+filler / scrambled), spoken at an "
                 "even 150 words per minute, scored by TRIBE v2 (text pathway only). See ANALYSIS.md.",
        "n_topics": len(topics),
        "raw": per_kind(lambda r: r["raw"]),
        "vividness": per_kind(lambda r: vivid(r["rois"])),
        "networks": {n: per_kind(lambda r, n=n: net(r["rois"], n)) for n in NETWORKS},
        "network_regions": NETWORKS,
        "vividness_plus": plus,
        "vividness_minus": minus,
        "roi_mean": {r: round(float(np.mean([x[r] for x in natural])), 4) for r in rois},
        "roi_std": {r: round(float(np.std([x[r] for x in natural])), 4) for r in rois},
        "roi_t_engaging_vs_flat": {r: round(vs_flat[r], 2) for r in rois},
        "roi_t_engaging_vs_scrambled": {r: round(vs_scrambled[r], 2) for r in rois},
    }
    (DATA / "reference.json").write_text(json.dumps(reference, indent=1))
    print(f"{len(rows)} texts -> reference.json | plus {plus} | {len(minus)} minus regions")


if __name__ == "__main__":
    main()
