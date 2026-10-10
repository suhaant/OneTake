"""Video or audio file -> transcript -> TRIBE v2 -> ranked scores and a 3D brain page.

    export NEURO_ANALYZE_URL=https://<workspace>--neuro-engagement-neuro-analyze.modal.run
    python -m neuro.analyze_video speech.mp4 --out results/speech

Writes result.json (everything the API returned) and brain.html (a single file that opens
by double-click: the 3D viewer with this clip's data inside).
"""

import argparse
import json
import re
from pathlib import Path

from . import client

VIEWER = Path(__file__).parent / "viewer"
IMPORT_LINE = "import { createBrainViewer } from './brain_viewer.js'; //@inline"


def brain_html(result: dict) -> str:
    """The viewer page with the mesh, the viewer code and this result inlined."""
    page = (VIEWER / "index.html").read_text()
    viewer = re.sub(r"^export ", "", (VIEWER / "brain_viewer.js").read_text(), flags=re.M)
    assert IMPORT_LINE in page

    def tag(name: str, payload: str) -> tuple[str, str]:
        empty = f'<script type="application/json" id="{name}"></script>'
        return empty, empty.replace("></script>", ">" + payload.replace("</", "<\\/") + "</script>")

    page = page.replace(IMPORT_LINE, viewer)
    page = page.replace(*tag("neuro-mesh", (VIEWER / "fsaverage5_mesh.json").read_text()))
    return page.replace(*tag("neuro-result", json.dumps(result)))


def summary(result: dict) -> str:
    k = result["ranking"]
    lines = [f'Transcript ({len(result.get("words", []))} words): {result.get("transcript", "")[:200]}', ""]
    for title, key in (("Raw score", "raw_score"), ("Vividness score", "vividness_score")):
        s = k[key]
        lines.append(f'{title:16s} {s["value"]:+.3f}  rank {s["percentile"]}/100 ({s["band"]}); beats '
                     f'{s["beats_flat_texts"]}% of bland and {s["beats_vivid_texts"]}% of vivid reference texts')
    lines.append("Networks:        " + ", ".join(f'{n} {s["percentile"]}/100' for n, s in k["networks"].items()))
    lines.append("Most activated:  " + ", ".join(f'{r["region"]} {r["activation"]:+.2f}' for r in k["most_activated_regions"][:6]))
    lines.append(f'Peak at {result["peak"]["t"]}s: "{result["peak"]["text"]}"')
    lines += [""] + [f"Note: {n}" for n in k["notes"]]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("media", help="video or audio file")
    ap.add_argument("--out", default=None, help="output folder (default: <file name>_neuro)")
    ap.add_argument("--url", default=None, help="analyze endpoint (default: $NEURO_ANALYZE_URL)")
    args = ap.parse_args()
    out = Path(args.out or Path(args.media).with_suffix("").name + "_neuro")
    out.mkdir(parents=True, exist_ok=True)
    result = client.analyze_media(args.media, args.url)
    (out / "result.json").write_text(json.dumps(result))
    (out / "brain.html").write_text(brain_html(result))
    print(summary(result))
    print(f"\nSaved {out / 'result.json'} and {out / 'brain.html'}")


if __name__ == "__main__":
    main()
