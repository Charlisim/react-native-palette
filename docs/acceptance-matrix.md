# Acceptance matrix

The source is [HANDOFF.md](HANDOFF.md), section "Acceptance and evidence matrix".
The sampling spike ran some scenarios on simulators, one emulator, and headless browsers.
No scenario is run on a physical device. The shared unit tests do not replace these platform tests.

Permitted cell values: `not run`, `pass`, `fail`, `not supported`.
Add a link to the evidence for each cell that is not `not run`.
A label in parentheses shows the device type or the browser engine.
The evidence for all cells from the spike is in [spike/README.md](spike/README.md) and `spike/evidence/`.

| # | Scenario | Required result | iOS | Android | Web |
| --- | --- | --- | --- | --- | --- |
| 1 | Opaque sRGB fixtures: red `#ff0000`, orange `#ff9500`, yellow `#ffff00`, green `#00ff00`, cyan `#00ffff` | Actual sampled background and black foreground; match known RGBA within a stated raster tolerance. | pass (simulators, iOS 18.4 and 26.5) | pass (emulator, API 35) | pass (Chromium 156), fail (WebKit 27.2, intermittent) |
| 2 | Opaque sRGB fixtures: blue `#0000ff` and purple `#800080` | Actual sampled background and white foreground. | pass (simulators, iOS 18.4 and 26.5) | pass (emulator, API 35) | pass (Chromium 156), fail (WebKit 27.2, intermittent) |
| 3 | Image with separate light/dark areas | Moving the foreground between areas changes the selected foreground; an unrelated dominant image color does not determine the result. | pass (simulators, iOS 18.4 and 26.5) | pass (emulator, API 35) | pass (Chromium 156), fail (WebKit 27.2, intermittent) |
| 4 | Cropped/scaled image (`cover` and `contain`) | Sampling follows displayed crop, scale, and any letterboxing/background, not source-image coordinates alone. | pass (simulators, iOS 18.4 and 26.5) | pass (emulator, API 35) | pass (Chromium 156), fail (WebKit 27.2, intermittent) |
| 5 | Transparent child over an image inside capture root | Image pixels determine the result even when the child's declared background is absent or transparent. | pass (simulators, iOS 18.4 and 26.5) | pass (emulator, API 35) | pass (Chromium 156), fail (WebKit 27.2, intermittent) |
| 6 | Translucent overlay over the same image | Sample matches the composited visible color; foreground changes when that composition crosses the contrast boundary. | pass (simulators, iOS 18.4 and 26.5) | pass (emulator, API 35) | pass (Chromium 156), fail (WebKit 27.2, intermittent) |
| 7 | Residual transparent root | Explicit opaque backdrop resolves it; absence produces `UNRESOLVED_BACKDROP`. | pass (simulators, iOS 18.4 and 26.5) | pass (emulator, API 35) | pass (Chromium 156, WebKit 27.2) |
| 8 | Foreground text, opaque foreground panel, and foreground descendants | None contaminates the sample; layout and original state survive capture. | pass (simulators, iOS 18.4 and 26.5) | pass (emulator, API 35) | pass (Chromium 156), fail (WebKit 27.2, intermittent) |
| 9 | Nested layout, scrolling, high density, supported transforms and clipping | The correct physical pixel is sampled; unsupported mappings fail explicitly. | not run | not run | not run |
| 10 | Theme, image-load and background changes | Refresh gives the new result; older asynchronous captures cannot overwrite it. | not run | not run | not run |
| 11 | Failure, cancellation, unmount, repeated captures | No stuck hidden views, hanging requests, retained bitmaps or capture-file accumulation. | not run | not run | not run |
| 12 | Web image/canvas access restriction or unsupported renderer | Explicit limitation/error; no fabricated success. | not run | not run | pass (Chromium 156, WebKit 27.2) |

## Notes on the spike results

- Scenario 1: the green value is a root background, not an image fixture. All five colors were sampled.
- Scenario 4: `cover` and `contain` used a 300 x 150 frame with a banded image.
- Scenario 8: the foreground has a `Text`, a nested `View`, and a child `View`. A negative control without the exclusion returned the foreground color.
- Scenario 9 stays `not run`. Partial data exists: nested layout, scroll offset, translate, scale, rotate, and densities 3 and 2.625 passed on iOS and Android. Clipping and the explicit failure of a perspective transform were not exercised.
- Scenario 10 was not run.
- Scenario 11 stays `not run`. Partial data exists: restoration after a forced error and after an abort passed, and 200 repeated captures left no hidden view. Memory growth and bitmap retention were not measured.
- Scenario 12: the web adapter rejects a cross-origin image with `UNSUPPORTED_CONTENT`. Without that check, the renderer omits the image without an error.
- Web in WebKit: 2 of 32 cases failed in each run, with different cases in each run. Do not advertise web support.

## Evidence rules

- Use deterministic image fixtures and pixel expectations.
- Test the sampled result and the rendered foreground assignment separately.
- Validate iOS and Android separately.
- A simulator or an emulator does not prove physical-device behavior. Record the device type for each run.
- Validate the supported web subset in a minimum of two browser engines before a general web support claim.
- Run the cancellation, restoration, and resource tests under repeated refreshes.

## Performance evidence

The values come from debug builds on a simulator, an emulator, and a headless browser. No physical-device measurement exists.
No performance budget is set. The count of captures is 200 on iOS and Android and 30 on web.

| Measurement | iOS | Android | Web |
| --- | --- | --- | --- |
| Hardware name | iPhone 16 simulator, iOS 18.4 (host Apple M4 Pro) | API 35 emulator, host GPU (host Apple M4 Pro) | Chromium 156 headless (host Apple M4 Pro) |
| Capture dimensions | 300 x 300 logical root, 1 x 1 pixel bitmap | 300 x 300 logical root, 1 x 1 pixel bitmap | 300 x 300 CSS pixel root, 1 x 1 CSS pixel canvas |
| Pixel density | 3 | 2.625 | 1 and 2 |
| End-to-end latency p50 | 0.34 ms | 4.4 ms | 57 ms |
| End-to-end latency p95 | 0.53 ms | 13.3 ms | 59 ms |
| UI thread and JS thread block time | UI: p50 0.17 ms, p95 0.29 ms. JS: not run | UI: p50 0.39 ms, p95 0.79 ms. JS: not run | not run |
| Memory growth under repeated captures | not run | not run | not run |
