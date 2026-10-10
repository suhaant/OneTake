"""Rank a transcript's predicted brain response against the calibration texts.

Input: the raw score and the mean predicted activity per HCP-MMP1 region (both from the API).
Output: where they fall among the 100 calibration texts, which networks and regions responded
most, and the caveats that go with the numbers. Pure numpy; no model needed.

What the ranking means is set by the calibration analysis (ANALYSIS.md):
  * raw score      : separates vivid, concrete text from bland text (25 of 25 topics), but
                     scrambled word order scores even higher, so it can be gamed with nonsense.
  * vividness score: same idea with the regions that respond to scrambled or bland text
                     subtracted, so nonsense no longer wins.
Neither has been shown to track audience engagement (see the Song et al. validation).
"""

import json
from pathlib import Path

import numpy as np

_HERE = Path(__file__).parent
_REF_PATH = next(p for p in (_HERE / "reference.json", _HERE / "data" / "reference.json") if p.exists())
REF = json.loads(_REF_PATH.read_text())

REGION_INFO = {  # plain-language role of the regions that matter most for speech (HCP-MMP1 names)
    "44": "Broca's area: building sentences", "45": "Broca's area: word meaning and selection",
    "47l": "inferior frontal: retrieving meaning", "55b": "premotor language area",
    "IFSa": "inferior frontal sulcus: holding language in mind", "IFSp": "inferior frontal sulcus: holding language in mind",
    "IFJa": "inferior frontal junction: attention control", "IFJp": "inferior frontal junction: attention control",
    "STSda": "superior temporal sulcus: speech meaning", "STSdp": "superior temporal sulcus: speech meaning",
    "STSva": "superior temporal sulcus: speech and voices", "STSvp": "superior temporal sulcus: speech and voices",
    "STGa": "anterior superior temporal: combining words", "TE1a": "anterior temporal: concepts and people",
    "TE1m": "middle temporal: word knowledge", "TE2a": "anterior temporal: concepts", "TGd": "temporal pole: social and emotional meaning",
    "TGv": "temporal pole: concepts", "TPOJ1": "temporo-parietal junction: language", "TPOJ2": "temporo-parietal junction: other minds",
    "PGi": "angular gyrus: integrating meaning", "PGs": "angular gyrus: integrating meaning", "PFm": "inferior parietal: reasoning",
    "STV": "superior temporal: voices and faces", "PSL": "perisylvian language area", "SFL": "superior frontal language area",
    "A1": "primary auditory cortex", "A4": "auditory association cortex", "A5": "auditory association cortex: speech sounds",
    "LBelt": "auditory belt", "MBelt": "auditory belt", "PBelt": "auditory belt", "RI": "auditory: retroinsular",
    "8BM": "medial frontal: cognitive control", "8BL": "superior frontal: reasoning", "TF": "parahippocampal: memory and scenes",
    "EC": "entorhinal cortex: memory", "31pv": "posterior cingulate: default mode", "31pd": "posterior cingulate: default mode",
    "7m": "precuneus: default mode", "v23ab": "posterior cingulate: default mode", "d23ab": "posterior cingulate: default mode",
    "10r": "medial prefrontal: self and value", "10v": "medial prefrontal: self and value", "9m": "medial prefrontal: thinking about people",
    "10pp": "frontal pole", "3b": "primary somatosensory cortex", "4": "primary motor cortex",
    "V1": "primary visual cortex", "V7": "dorsal visual: spatial attention", "LO1": "lateral occipital: visual form",
    "LIPv": "intraparietal: spatial attention", "MIP": "intraparietal: spatial attention", "IPS1": "intraparietal: spatial attention",
    "IP0": "intraparietal: spatial attention", "PH": "occipito-temporal: visual form", "6r": "premotor cortex",
    "FOP3": "frontal operculum", "FOP4": "frontal operculum", "V3A": "dorsal visual", "V3B": "dorsal visual", "V3CD": "dorsal visual",
}
NOTES = [
    "Percentiles compare this transcript with 50 calibration texts (25 vivid, 25 bland) written for this project.",
    "The scores reflect how vivid and concrete the language is. They are not a validated measure of audience engagement.",
    "Predicted for an average listener from the words and their timing only; voice and video are not used.",
]


def _percentile(value: float, pool: list[float]) -> int:
    return int(round(100 * float(np.mean(np.asarray(pool) < value))))


def vividness(rois: dict[str, float]) -> float:
    plus = np.mean([rois[r] for r in REF["vividness_plus"] if r in rois])
    minus = np.mean([rois[r] for r in REF["vividness_minus"] if r in rois])
    return float(plus - minus)


def _ranked(value: float, table: dict[str, list[float]]) -> dict:
    return {
        "value": round(value, 4),
        "percentile": _percentile(value, table["engaging"] + table["flat"]),
        "beats_flat_texts": _percentile(value, table["flat"]),
        "beats_vivid_texts": _percentile(value, table["engaging"]),
    }


def _band(value: float, table: dict[str, list[float]]) -> str:
    flat_top, vivid_bottom = np.percentile(table["flat"], 75), np.percentile(table["engaging"], 25)
    if value >= vivid_bottom:
        return "vivid"
    return "bland" if value <= flat_top else "in between"


def rank(raw: float, rois: dict[str, float], top: int = 8) -> dict:
    """Everything the UI needs about how strongly the text drove the predicted brain response."""
    viv = vividness(rois)
    z = {r: (v - REF["roi_mean"][r]) / (REF["roi_std"][r] or 1.0) for r, v in rois.items() if r in REF["roi_mean"]}
    order = sorted(z, key=z.get, reverse=True)

    def region(r: str) -> dict:
        return {"region": r, "role": REGION_INFO.get(r, ""), "activation": round(rois[r], 4),
                "vs_typical_text": round(z[r], 2)}

    networks = {}
    for name, members in REF["network_regions"].items():
        value = float(np.mean([rois[r] for r in members if r in rois]))
        networks[name] = _ranked(value, REF["networks"][name])
    return {
        "raw_score": {**_ranked(raw, REF["raw"]), "band": _band(raw, REF["raw"])},
        "vividness_score": {**_ranked(viv, REF["vividness"]), "band": _band(viv, REF["vividness"])},
        "networks": networks,
        "most_activated_regions": [region(r) for r in sorted(rois, key=rois.get, reverse=True)[:top]],
        "above_typical_regions": [region(r) for r in order[:top]],
        "below_typical_regions": [region(r) for r in order[-top:][::-1]],
        "notes": NOTES,
    }
