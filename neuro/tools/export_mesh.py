"""Write viewer/fsaverage5_mesh.json: the cortical surface TRIBE v2 predicts on.

    pip install nilearn nibabel && python tools/export_mesh.py

Vertex order is fsaverage5 left hemisphere (10,242 vertices) then right (10,242), the same
order as TRIBE's output and as tribev2's own plotting code, so value i belongs to vertex i.
"""

import base64
import json
import sys
from pathlib import Path

import numpy as np
from nilearn import datasets, surface

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "api"))
sys.path.insert(0, str(ROOT))
GAP = 6  # mm between the two inflated hemispheres


def b64(a: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def main() -> None:
    import neuro_core

    fs = datasets.fetch_surf_fsaverage("fsaverage5")
    pial, infl, faces, sulc = [], [], [], []
    for h, hemi in enumerate(("left", "right")):
        p, f = (np.asarray(x) for x in surface.load_surf_mesh(fs[f"pial_{hemi}"]))
        i = np.asarray(surface.load_surf_mesh(fs[f"infl_{hemi}"])[0]).copy()
        # inflated hemispheres are both centred on x = 0; move them apart
        i[:, 0] += (-i[:, 0].max() - GAP / 2) if hemi == "left" else (-i[:, 0].min() + GAP / 2)
        pial.append(p), infl.append(i), faces.append(f + h * len(p))
        sulc.append(np.asarray(surface.load_surf_data(fs[f"sulc_{hemi}"])))
    pial, infl, faces, sulc = (np.concatenate(x) for x in (pial, infl, faces, sulc))
    assert len(pial) == 20484 and faces.max() == 20483

    roi = neuro_core.load_atlas(ROOT / "tools" / "hcp_atlas")  # HCP-MMP1 label per vertex
    names = sorted(set(roi) - {"", "?"})
    index = np.array([names.index(r) + 1 if r in names else 0 for r in roi], np.uint8)
    sulc_q = np.clip(np.round(sulc / np.abs(sulc).max() * 127), -127, 127).astype(np.int8)
    mesh = {
        "space": "fsaverage5", "n_vertices": len(pial), "n_faces": len(faces),
        "hemisphere_order": ["left", "right"], "vertices_per_hemisphere": 10242,
        "axes": "x = right, y = front, z = up (mm)",
        "pial_f32": b64(pial.astype(np.float32)), "inflated_f32": b64(infl.astype(np.float32)),
        "faces_u16": b64((faces % 65536).astype(np.uint16)) if faces.max() < 65536 else None,
        "sulc_i8": b64(sulc_q),
        "region_names": [""] + names, "region_index_u8": b64(index),
        "source": "fsaverage5 surfaces via nilearn; HCP-MMP1 atlas (Glasser et al. 2016) on fsaverage",
    }
    out = ROOT / "viewer" / "fsaverage5_mesh.json"
    out.write_text(json.dumps(mesh))
    print(f"{out.name}: {out.stat().st_size / 1e6:.2f} MB, {len(pial)} vertices, {len(faces)} faces, {len(names)} regions")


if __name__ == "__main__":
    main()
