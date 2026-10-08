# Sampling contract

**Status: DRAFT.** Delivery step 2 locks this contract after the sampling spike.
The source is [HANDOFF.md](HANDOFF.md), sections "Required sampling contract" and "Proposed API shape".
API names are proposals. No platform adapter in the package implements this contract.
The spike adapters in `example/modules/palette-sampler/` are evidence, not the implementation.

## Undefined items

The spike and delivery step 2 must define these items. Do not treat them as decided.

| Item | Open question |
| --- | --- |
| Raster rounding rule | How a logical point becomes a physical bitmap pixel (floor, round, or pixel center). |
| Sampling footprint | One pixel or an average of a pixel area. The size of that area. |
| Raster tolerance | The permitted difference between a sampled channel and the fixture value. |
| Supported transforms | The transforms that the point mapping supports. All other transforms must fail explicitly. |
| Capture root effects | Whether the capture includes the opacity and the transforms of the capture root. |
| Opaque threshold | Whether a sample is opaque only when alpha is exactly 1. The shared core uses exactly 1. |
| Linearization threshold | The shared core uses the WCAG 2.x constant 0.03928. The sRGB standard uses 0.04045. |
| Invalid backdrop code | The shared core reports an invalid `backdrop` string as `UNRESOLVED_BACKDROP`. |
| Readiness detection | How an adapter detects non-zero layout and completed image load. |

## Spike inputs for step 2

The sampling spike supplies these inputs. They are not locked. The evidence is in [spike/README.md](spike/README.md).
All data comes from simulators, one emulator, and headless browsers.

| Item | Spike input |
| --- | --- |
| Raster rounding rule | `pixel = floor(logical * scale)` on the mapped capture-root point. The pixel that contains the point. |
| Sampling footprint | One physical pixel. |
| Raster tolerance | 1 for each 8-bit channel was sufficient. The maximum observed difference was 0.5. |
| Capture point | The reported point can differ from the layout value by less than one physical pixel. Android aligns views to physical pixels. |
| Supported transforms | Translate, scale, and rotate on iOS and Android. Translate only on web. Perspective is rejected. |
| Capture root effects | The opacity of the capture root is in the sample on iOS and web. It is not in the sample on Android. One rule is necessary. |
| Readiness detection | The spike waited for `onLoad` of each image. The adapters detect zero size only. |
| Exclusion scope | Only the requested foreground subtree. A different foreground is background content. |
| View references | Each reference must have a native view. A flattened view gives `INVALID_VIEW_RELATIONSHIP`. |
| Web images | The DOM renderer omits a cross-origin image without an error. The adapter must reject it before the capture. |

## 1. Capture scope and backdrop

- The caller supplies an explicit `captureRoot`.
- The `captureRoot` contains the painted background and the foreground.
- The two references are mounted in the same supported view hierarchy and the same rendering surface.
- The caller selects the smallest ancestor that contains the necessary background layers.
- The library samples the rendered composition. It does not read declared styles.
- An adapter includes the effects outside its capture, or it rejects them, or the documentation lists them as unsupported.
- A subtree capture is not the final screen compositor. The documentation must not describe it as one.

If the sampled pixel is translucent, the library resolves it against the `backdrop` only.
The `backdrop` is an opaque sRGB color in the form `#rrggbb`.
If the sampled pixel is translucent and no `backdrop` is supplied, the request rejects with `UNRESOLVED_BACKDROP`.
The library never assumes white, black, or the device theme.
The `backdrop` is a boundary value from the caller. It is not a pixel that the library found.

## 2. Foreground exclusion and restoration

- The capture excludes the full foreground subtree.
- The capture keeps all other background content in its original paint order.
- Exclusion preserves layout, transforms, opacity, visibility, accessibility, hit tests, and sibling order.
- The adapter restores the state after success, error, cancellation, and unmount.
- A visible flash, a collapsed row, or a label that disappears is a failure.
- A React state change to `opacity: 0` around an asynchronous capture is not accepted as safe. It can span rendered frames.

The exclusion strategy is open. Refer to [open-decisions.md](open-decisions.md).

## 3. Position and pixel representation

- The default point is the local top-left bounds point of the foreground: `{ x: 0, y: 0 }`.
- The caller can supply a different foreground-local point in logical units.
- The adapter maps the point through nested offsets, scroll position, supported transforms, and capture-root coordinates.
- Logical layout units and physical bitmap pixels stay separate. The adapter reports the bitmap scale.
- All adapters use the same raster rounding rule and the same sampling footprint.
- The request rejects for non-finite coordinates, empty bounds, detached references, and points outside the captured area.

The adapter decodes one pixel into normalized sRGB RGBA:

- Each channel is in the range 0..1.
- Alpha is straight (not premultiplied).
- The adapter identifies channel order, premultiplied alpha, color space, and bitmap scale before it reads the pixel.
- Transparency stays in the sample until backdrop resolution.
- An adapter does not replace absent or unsupported content with a black sample.
- If an adapter cannot detect an unsupported renderer, its documented supported content becomes smaller.

## 4. Contrast selection

The shared core implements this section. It has no React import and no native import.

1. Resolve the sample to an opaque sRGB color. Composite a translucent sample source-over the `backdrop`.
2. Calculate the WCAG 2.x relative luminance with linearized channels.
3. Calculate the contrast ratio against opaque black and against opaque white.
4. Select the foreground with the larger ratio. A tie selects black.

The `foreground` value in the result is the string `'black'` or the string `'white'`.
Each value is a valid React Native color string.

The result describes one point only. It does not certify contrast across an image, a gradient, or a text region.
Region sampling, minimum contrast across an area, scrims, and custom foreground palettes are not part of this contract.

## 5. Readiness and asynchronous behavior

- Capture occurs after non-zero layout and after the relevant images load.
- `onLayout` alone does not prove that an image is ready.
- Refresh is explicit. The library does not capture on each render or each frame.
- Each request resolves or rejects.
- Cancellation and unmount release resources.
- If cancellation cannot stop a native capture, the library discards the result and completes the cleanup.
- An already-aborted `signal` rejects with `ABORTED` before the capture starts.

A later hook can coalesce refreshes, discard stale completions, and expose pending and error states.
The hook is not part of this contract.

## Proposed API

```ts
function sampleContrast(options: SampleContrastOptions): Promise<SampleContrastResult>;
```

### Options

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `captureRoot` | view reference | yes | Ancestor that contains the painted background and the foreground. |
| `foreground` | view reference | yes | View that the capture excludes. |
| `point` | `{ x, y }` | no | Foreground-local point in logical units. The default is `{ x: 0, y: 0 }`. |
| `backdrop` | `#rrggbb` string | no | Opaque sRGB color. It resolves residual transparency only. |
| `signal` | `AbortSignal` | no | Cancels the request. |

The `backdrop` accepts the form `#rrggbb` only.
Short forms, alpha forms, color names, and functional notation are invalid.

### Result

| Field | Description |
| --- | --- |
| `sampledRGBA` | Color that the capture returned, before backdrop resolution. |
| `resolvedRGBA` | Opaque color that the contrast selection used. |
| `foreground` | `'black'` or `'white'`. |
| `contrastRatio` | WCAG 2.x contrast ratio between `foreground` and `resolvedRGBA`. |
| `capturePoint` | Sampled position in capture-root logical units. |
| `scope` | Always `'point'`. |

The result does not contain bitmap data.

### Errors

Each rejection is a `PaletteError` with a `code` and an optional `cause`.

| Code | Condition |
| --- | --- |
| `NOT_READY` | Layout is zero, or a relevant image is not loaded. |
| `INVALID_VIEW_RELATIONSHIP` | A reference is detached, or the foreground is not in the `captureRoot`. |
| `INVALID_POINT` | The point is not finite, the bounds are empty, or the point is outside the captured area. |
| `UNRESOLVED_BACKDROP` | The sample is translucent and no valid opaque `backdrop` is available. |
| `UNSUPPORTED_CONTENT` | The content or the mapping is outside the supported subset. |
| `CAPTURE_FAILED` | The capture did not complete, or no capture adapter exists. |
| `ABORTED` | The `signal` aborted the request. |

A convenience component can show an explicit fallback color.
That component must expose the failure. A fallback color is not a successful sample.

## Current implementation

| Part | State |
| --- | --- |
| Backdrop parse and composition (`src/core/color.ts`) | Implemented, unit tests only. |
| Luminance, ratio, and selection (`src/core/contrast.ts`) | Implemented, unit tests only. |
| `sampleContrast` input validation and result flow | Implemented, tested with a fake adapter. |
| Capture, exclusion, point mapping, decode | Not implemented in the package. Spike code exists in `example/modules/palette-sampler/`. |
