"""Does the neuro score track real human engagement, second by second?

Data: Song, Finn & Rosenberg (PNAS 2021). 21 people moved a 1-9 engagement slider while
listening to the 22-minute "Paranoia" story (Finn et al. 2018). One rating per second.
The story and ratings are not stored in this repository (the story is CC BY-NC). Fetch them into
tools/song_data/ first:

    B=https://raw.githubusercontent.com/hyssong/NarrativeEngagement/main/data
    curl -LO $B/behavior-engagement-paranoia.mat ; curl -LO $B/behavior-sensory-paranoia.mat
    S=https://s3.amazonaws.com/openneuro.org/ds001338/stimuli
    for i in 1 2 3; do curl -LO $S/story${i}_audio.wav; done
    uvx whisperx story1_audio.wav story2_audio.wav story3_audio.wav --model medium.en --language en \
        --align_model WAV2VEC2_ASR_LARGE_LV60K_960H --output_dir whisper --output_format json

Then, from the neuro/ folder:

    python tools/run_song_validation.py words            # whisperx output -> song_data/words.json
    python tools/run_song_validation.py <neuro-score endpoint url>   # send the story in pieces, then analyse
    python tools/run_song_validation.py                  # analysis only

Results are saved after every piece (song_data/results.jsonl), so it can be stopped and re-run.
The outcome of our run is in data/song_validation_report.json and ANALYSIS.md.
"""

import json
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.io as sio

HERE = Path(__file__).parent
DATA = HERE / "song_data"
WORDS = DATA / "words.json"
RESULTS = DATA / "results.jsonl"

N_SEC = 1310  # length of the rating timeline (three scanner runs back to back, 1 sample per second)
# Second at which each audio file starts on that timeline. Found by matching each file's
# loudness to the loudness curve shipped with the ratings (r = 0.95 for all three).
RUN_START = {1: 2, 2: 528, 3: 980}
PIECE, LEAD_IN = 120, 60  # seconds scored per call, plus earlier seconds sent as context and discarded
SMOOTH = 10  # seconds; engagement moves slowly, so both curves are smoothed before comparing
MAX_LAG = 15
N_NULL = 2000

NETWORKS = {
    "language": ["44", "45", "47l", "55b", "IFSa", "IFSp", "IFJa", "STSda", "STSdp", "STSva", "STSvp",
                 "STGa", "TPOJ1", "PSL", "SFL"],
    "social": ["TPOJ2", "PGi", "PGs", "STV", "TE1a", "TGd"],
    "auditory": ["A1", "LBelt", "MBelt", "PBelt", "RI", "A4", "A5"],
    # default-mode network: the system the paper ties to engagement
    "default_mode": ["7m", "POS1", "v23ab", "d23ab", "31pv", "31pd", "RSC", "PCV", "10r", "10v", "9m",
                     "p32", "a24", "d32", "s32", "10d", "PGi", "PGs", "PFm", "TE1a", "TE1m"],
}


# ---------- word timings ----------

def build_words() -> None:
    words = []
    for run, offset in RUN_START.items():
        segments = json.loads((DATA / "whisper" / f"story{run}_audio.json").read_text())["segments"]
        for seg in segments:
            for w in seg["words"]:
                if "start" in w:  # whisperx leaves a few words (numbers, mostly) without a time
                    words.append({"text": w["word"].replace('"', "").strip(),
                                  "start": round(w["start"] + offset, 2), "end": round(w["end"] + offset, 2)})
    words = [w for w in words if w["text"]]
    WORDS.write_text(json.dumps(words))
    print(f"{len(words)} words, {words[0]['start']:.0f}s to {words[-1]['end']:.0f}s -> {WORDS.name}")


# ---------- API calls ----------

def call(url: str, words: list[dict]) -> dict:
    req = urllib.request.Request(url, json.dumps({"words": words, "detail": "timeseries"}).encode(),
                                 {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=1800) as r:
        return json.load(r)


def collect(url: str) -> None:
    words = json.loads(WORDS.read_text())
    done = {json.loads(line)["piece"] for line in RESULTS.read_text().splitlines()} if RESULTS.exists() else set()
    pieces = [p for p in range(0, N_SEC, PIECE) if p not in done]
    for k, p in enumerate(pieces, 1):
        t0, origin = time.time(), max(p - LEAD_IN, 0)
        chunk = [{"text": w["text"], "start": round(w["start"] - origin, 2), "end": round(w["end"] - origin, 2)}
                 for w in words if origin <= w["start"] < p + PIECE]
        res = call(url, chunk)
        if "roi_ts" not in res:
            sys.exit("The API did not return per-second detail. Redeploy first: modal deploy modal_app.py")
        t = np.array(res["roi_t"]) + origin
        keep = (t >= p) & (t < p + PIECE)
        with RESULTS.open("a") as f:
            f.write(json.dumps({"piece": p, "names": res["roi_names"], "t": t[keep].tolist(),
                                "ts": np.array(res["roi_ts"])[keep].tolist()}) + "\n")
        print(f"[{k}/{len(pieces)}] seconds {p}-{p + PIECE}: {len(chunk)} words, {time.time() - t0:.0f}s")


# ---------- analysis ----------

def smooth(x: np.ndarray) -> np.ndarray:
    return pd.Series(x).rolling(SMOOTH, center=True, min_periods=SMOOTH // 2).mean().to_numpy()


def corr(a: np.ndarray, b: np.ndarray) -> float:
    ok = ~np.isnan(a) & ~np.isnan(b)
    return float(np.corrcoef(a[ok], b[ok])[0, 1]) if ok.sum() > 30 else np.nan


def lagged(x: np.ndarray, human: np.ndarray) -> tuple[float, float, int]:
    """r with no shift, and the best r when the human curve may trail or lead by up to MAX_LAG seconds."""
    rs = {}
    for lag in range(-MAX_LAG, MAX_LAG + 1):  # positive lag = humans react after the model
        h = np.roll(human, -lag).astype(float)
        if lag > 0:
            h[-lag:] = np.nan
        elif lag < 0:
            h[:-lag] = np.nan
        rs[lag] = corr(x, h)
    best = max(rs, key=lambda k: abs(rs[k]))
    return rs[0], rs[best], best


def surrogates(human: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Curves with the same slow rhythm as the human one but scrambled timing (phase-randomised),
    the same chance model the paper used. A slow curve correlates with almost anything by luck."""
    f = np.fft.rfft(human - human.mean())
    phases = np.exp(2j * np.pi * rng.random((N_NULL, len(f))))
    phases[:, 0] = 1
    return np.fft.irfft(f * phases, n=len(human), axis=1)


def p_value(x: np.ndarray, null: np.ndarray, observed: float) -> float:
    """Share of scrambled curves that match as well as the real one (best lag allowed for both)."""
    best = np.array([abs(lagged(x, s)[1]) for s in null[:400]])
    return float((np.sum(best >= abs(observed)) + 1) / (len(best) + 1))


def load() -> tuple[pd.DataFrame, np.ndarray]:
    rows = [json.loads(line) for line in RESULTS.read_text().splitlines()]
    names = rows[0]["names"]
    X = np.full((N_SEC, len(names)), np.nan)
    for r in rows:
        t = np.array(r["t"], int)
        ok = (t >= 0) & (t < N_SEC)
        X[t[ok]] = np.array(r["ts"])[ok]
    e = sio.loadmat(DATA / "behavior-engagement-paranoia.mat")["engagement"].astype(float)
    human = ((e - e.mean(0)) / e.std(0)).mean(1)  # each rater z-scored, then averaged (as in the paper)
    return pd.DataFrame(X, columns=names), human


def held_out_fit(X: pd.DataFrame, human: np.ndarray) -> float:
    """Learn a weighting of all regions on two story parts, test it on the third. Mean test r."""
    bounds = [0, RUN_START[2], RUN_START[3], N_SEC]
    Z = X.apply(smooth).to_numpy()
    h = smooth(human)
    ok = ~np.isnan(Z).any(1) & ~np.isnan(h)
    rs = []
    for i in range(3):
        test = np.zeros(N_SEC, bool)
        test[bounds[i]:bounds[i + 1]] = True
        tr, te = ok & ~test, ok & test
        mu, sd = Z[tr].mean(0), Z[tr].std(0) + 1e-9
        A, B = (Z[tr] - mu) / sd, (Z[te] - mu) / sd
        with np.errstate(all="ignore"):  # macOS numpy prints spurious matmul warnings
            w = np.linalg.solve(A.T @ A + 10 * len(A) * np.eye(A.shape[1]), A.T @ (h[tr] - h[tr].mean()))  # ridge
            rs.append(np.corrcoef(B @ w, h[te])[0, 1])
    return float(np.mean(rs))


def analyse() -> None:
    X, human = load()
    covered = int((~X.isna().any(axis=1)).sum())
    print(f"\n{covered} of {N_SEC} seconds scored, {X.shape[1]} brain regions\n")
    null = surrogates(human, np.random.default_rng(0))
    h = smooth(human)

    def net(names):
        return X[[n for n in names if n in X]].mean(axis=1).to_numpy()

    signals = {"current score (language + social + auditory)":
               np.mean([net(NETWORKS[n]) for n in ("language", "social", "auditory")], axis=0)}
    signals |= {f"{n} regions": net(v) for n, v in NETWORKS.items()}
    signals["whole cortex"] = X.mean(axis=1).to_numpy()

    words = json.loads(WORDS.read_text())
    rate = np.bincount([int(w["start"]) for w in words if w["start"] < N_SEC], minlength=N_SEC).astype(float)
    loud = sio.loadmat(DATA / "behavior-sensory-paranoia.mat")["audio"].ravel()
    baselines = {"words per second (no brain model)": rate, "loudness (no brain model)": loud}

    e = sio.loadmat(DATA / "behavior-engagement-paranoia.mat")["engagement"].astype(float)
    z = (e - e.mean(0)) / e.std(0)
    print(f"CEILING: half the raters vs the other half: r = "
          f"{corr(smooth(z[:, ::2].mean(1)), smooth(z[:, 1::2].mean(1))):+.2f}\n")

    print("MATCH WITH THE HUMAN ENGAGEMENT CURVE  (r: 0 = none, 1 = identical; p below 0.05 = unlikely to be luck)")
    report = {"seconds": covered, "signals": {}}
    for group, items in [("Brain-model signals", signals), ("Simple baselines", baselines)]:
        print(f"  {group}:")
        for name, x in items.items():
            r0, rb, lag = lagged(smooth(x), h)
            p = p_value(smooth(x), null, rb)
            print(f"    {name:46s} r = {r0:+.2f} | best {rb:+.2f} at {lag:+d}s | p = {p:.3f}")
            report["signals"][name] = {"r": r0, "best_r": rb, "lag": lag, "p": p}

    per = pd.Series({c: corr(smooth(X[c].to_numpy()), h) for c in X}).sort_values(ascending=False)
    print("\nSINGLE REGIONS (r with human curve, no shift)")
    print("  rise with engagement: " + ", ".join(f"{k} {v:+.2f}" for k, v in per.head(10).items()))
    print("  fall with engagement: " + ", ".join(f"{k} {v:+.2f}" for k, v in per.tail(10)[::-1].items()))
    report["regions"] = per.round(3).to_dict()

    if covered > 0.8 * N_SEC:
        fit = held_out_fit(X, human)
        print(f"\nBEST CASE: weighting of all regions learned on two story parts, tested on the third: r = {fit:+.2f}")
        report["held_out_fit"] = fit
    (DATA / "report.json").write_text(json.dumps(report, indent=1))
    print("\nSaved report.json")


if __name__ == "__main__":
    if sys.argv[1:] == ["words"]:
        build_words()
    else:
        if len(sys.argv) > 1:
            collect(sys.argv[1])
        analyse()
