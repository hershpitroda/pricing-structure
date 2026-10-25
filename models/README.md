# 3D models

Put model files in this folder, next to `index.html`, and name them in the **MODEL** column of the PRICELIST sheet.

## Linking a model to a configuration

1. In `PRICING STRUCTURE.xlsx`, sheet **PRICELIST**, add a column with the header **MODEL** (row 2, e.g. column T).
2. For each row (SKU) enter the file name, e.g. `WFLX-SH-1200.glb`. Many rows can share one file. Leave blank to use the built-in model.
3. Upload the files here (`models/`), then send the updated Excel so `pricelist.js` can be regenerated.

## Formats

- **GLB (recommended):** one file, materials and textures included, fastest on iPad.
- **OBJ:** put the `.mtl` beside it with the same name (`desk.obj` + `desk.mtl`). Textures referenced by the MTL must also be in this folder.
- Units: metres, centimetres or millimetres are detected automatically. Model should be upright (Y up) with the user side facing +Z.

## Part names (so finishes recolour the model)

Name meshes or materials with these words. Anything else keeps its own material.

| Finish picked in the app | Use a name containing |
|---|---|
| Top colour | `top`, `worksurface` |
| Frame & legs colour | `frame`, `leg`, `beam`, `modesty`, `bracket` |
| Glass screen colour | `glass` |
| Fabric screen colour | `fabric` |
| Pedestal / side unit carcass | `pedestal`, `carcass`, `side_unit`, `credenza` |
| Drawer fronts (match top) | `fascia`, `drawer`, `shutter` |

## Limits

- Models are fetched from this folder when the page runs, so they work on your website but are **not** included in the self-contained published artifact.
- If a file is missing or fails to load, the built-in model is shown and the caption says so.
