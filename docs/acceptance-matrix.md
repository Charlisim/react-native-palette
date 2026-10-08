# Acceptance matrix

The source is [HANDOFF.md](HANDOFF.md), section "Acceptance and evidence matrix".
No scenario is run on any platform. The shared unit tests do not replace these platform tests.

Permitted cell values: `not run`, `pass`, `fail`, `not supported`.
Add a link to the evidence for each cell that is not `not run`.

| # | Scenario | Required result | iOS | Android | Web |
| --- | --- | --- | --- | --- | --- |
| 1 | Opaque sRGB fixtures: red `#ff0000`, orange `#ff9500`, yellow `#ffff00`, green `#00ff00`, cyan `#00ffff` | Actual sampled background and black foreground; match known RGBA within a stated raster tolerance. | not run | not run | not run |
| 2 | Opaque sRGB fixtures: blue `#0000ff` and purple `#800080` | Actual sampled background and white foreground. | not run | not run | not run |
| 3 | Image with separate light/dark areas | Moving the foreground between areas changes the selected foreground; an unrelated dominant image color does not determine the result. | not run | not run | not run |
| 4 | Cropped/scaled image (`cover` and `contain`) | Sampling follows displayed crop, scale, and any letterboxing/background, not source-image coordinates alone. | not run | not run | not run |
| 5 | Transparent child over an image inside capture root | Image pixels determine the result even when the child's declared background is absent or transparent. | not run | not run | not run |
| 6 | Translucent overlay over the same image | Sample matches the composited visible color; foreground changes when that composition crosses the contrast boundary. | not run | not run | not run |
| 7 | Residual transparent root | Explicit opaque backdrop resolves it; absence produces `UNRESOLVED_BACKDROP`. | not run | not run | not run |
| 8 | Foreground text, opaque foreground panel, and foreground descendants | None contaminates the sample; layout and original state survive capture. | not run | not run | not run |
| 9 | Nested layout, scrolling, high density, supported transforms and clipping | The correct physical pixel is sampled; unsupported mappings fail explicitly. | not run | not run | not run |
| 10 | Theme, image-load and background changes | Refresh gives the new result; older asynchronous captures cannot overwrite it. | not run | not run | not run |
| 11 | Failure, cancellation, unmount, repeated captures | No stuck hidden views, hanging requests, retained bitmaps or capture-file accumulation. | not run | not run | not run |
| 12 | Web image/canvas access restriction or unsupported renderer | Explicit limitation/error; no fabricated success. | not run | not run | not run |

## Evidence rules

- Use deterministic image fixtures and pixel expectations.
- Test the sampled result and the rendered foreground assignment separately.
- Validate iOS and Android separately.
- A simulator or an emulator does not prove physical-device behavior. Record the device type for each run.
- Validate the supported web subset in a minimum of two browser engines before a general web support claim.
- Run the cancellation, restoration, and resource tests under repeated refreshes.

## Performance evidence

No measurement exists. No performance budget is set.

| Measurement | iOS | Android | Web |
| --- | --- | --- | --- |
| Hardware name | not run | not run | not run |
| Capture dimensions | not run | not run | not run |
| Pixel density | not run | not run | not run |
| End-to-end latency p50 | not run | not run | not run |
| End-to-end latency p95 | not run | not run | not run |
| UI thread and JS thread block time | not run | not run | not run |
| Memory growth under repeated captures | not run | not run | not run |
