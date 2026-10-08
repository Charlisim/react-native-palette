# Sampling contract

**Status: LOCKED. Contract v1 (8 October 2026).** Delivery step 2 locked this contract.
The sources are [HANDOFF.md](HANDOFF.md), the spike report [spike/README.md](spike/README.md), and [spike/blur-and-glass.md](spike/blur-and-glass.md).
A change to a rule in this file needs a new contract version.

The shared core in `src/` implements sections 4 and 5 and the input validation.
No platform adapter exists in the package. The adapters in `example/modules/palette-sampler/` are spike code.
Those adapters follow this contract. Step 3 moves them into the package.

All evidence comes from simulators, one emulator, and headless browsers. No physical device is tested.
An item that the evidence does not support is in the list "Not verified". It is not supported content.

## 1. Capture scope and backdrop

- The caller supplies an explicit `captureRoot`.
- The `captureRoot` contains the painted background and the foreground.
- The foreground is a descendant of the `captureRoot`. The two references are different views.
- The two references are in the same view hierarchy and the same rendering surface.
- The caller selects the smallest ancestor that contains the necessary background layers.
- The library samples the rendered composition. It does not read declared styles.

The sample describes the content that is painted inside the `captureRoot`. These items are out of scope:

| Item | Rule in v1 |
| --- | --- |
| Opacity of the `captureRoot` itself | Not part of the sample. A root with `opacity: 0.5` and a white background gives alpha 255. |
| Transform of the `captureRoot` itself | Out of scope. Not defined. Refer to "Not verified". |
| Effects of ancestors of the `captureRoot` (opacity, transforms, clips, filters) | Not part of the sample. |
| Content outside the `captureRoot` | Not part of the sample. |

A subtree capture is not the final screen compositor. Do not describe it as one.

If the sampled pixel is translucent, the library resolves it against the `backdrop` only.
The `backdrop` is an opaque sRGB color in the form `#rrggbb`.
If the sampled pixel is translucent and no `backdrop` is supplied, the request rejects with `UNRESOLVED_BACKDROP`.
The library never assumes white, black, or the device theme.
The `backdrop` is a boundary value from the caller. It is not a pixel that the library found.

## 2. Foreground exclusion and restoration

- The capture excludes the full subtree of the requested foreground.
- The capture excludes only that subtree. A different foreground at the sample point is background content.
- The capture keeps all other content in its original paint order.
- Exclusion preserves layout, transforms, opacity, visibility, accessibility flags, hit-test flags, and sibling order.
- The adapter restores the state after success, error, cancellation, and unmount.
- A visible flash, a collapsed row, or a label that disappears is a failure.
- A React state change to `opacity: 0` around an asynchronous capture is not permitted. It spans rendered frames.

Each adapter does the exclusion, the render, and the restoration in one synchronous unit:

| Platform | Unit | Exclusion |
| --- | --- | --- |
| iOS | One main-queue block and one `CATransaction` with actions off | `layer.isHidden` of the foreground. The same transaction sets the root layer opacity to 1 and restores it. |
| Android | One UI-thread message | `transitionAlpha = 0` (API 29 and later). `View.INVISIBLE` below API 29. |
| Web | One DOM render of a clone | `ignoreElements` on the clone. The clone gets `opacity: 1` on the root. The live DOM does not change. |

### `collapsable={false}` is required

React Native can remove a view that has no paint (view flattening). A removed view has no native view.

1. Set `collapsable={false}` on the `captureRoot`.
2. Set `collapsable={false}` on the foreground.

If a reference does not resolve to a native view, the request rejects with `INVALID_VIEW_RELATIONSHIP`.
The message names `collapsable={false}` as the probable cause.

## 3. Position and pixel representation

- The default point is the local top-left bounds point of the foreground: `{ x: 0, y: 0 }`.
- The caller can supply a different foreground-local point in logical units.
- The point can be outside the foreground bounds. The mapped point must be inside the `captureRoot`.
- The adapter maps the point through nested offsets, scroll position, and the supported transforms.
- The result contains the mapped point in capture-root logical units (`capturePoint`).

Locked rules:

| Rule | Value |
| --- | --- |
| Raster rounding | `pixel = floor(logical * scale)` for each axis of the mapped capture-root point. This is the physical pixel that contains the point. |
| Sampling footprint | Exactly one physical pixel. No average. |
| Captured area | `0 <= x < width` and `0 <= y < height` of the `captureRoot`, in logical units. |
| Raster tolerance | A sampled channel can differ from the known value by a maximum of 1 on the 8-bit scale. |
| Capture point tolerance | `capturePoint` can differ from the layout value by less than one physical pixel. Android aligns each view to a physical pixel. |

Supported transforms between the foreground and the `captureRoot`:

| Platform | Supported | Rejected with `UNSUPPORTED_CONTENT` |
| --- | --- | --- |
| iOS | Translate, scale, rotate (2D affine) | Perspective |
| Android | Translate, scale, rotate (2D affine) | Perspective |
| Web | Translate | Scale, rotate, perspective, each other transform |

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
2. Calculate the WCAG 2.x relative luminance with linearized channels. The linearization threshold is 0.03928.
3. Calculate the contrast ratio against opaque black and against opaque white.
4. Select the foreground with the larger ratio. A tie selects black.

A sample is opaque only when its alpha is exactly 1. Each other alpha value is translucent.
The `foreground` value in the result is the string `'black'` or the string `'white'`.
Each value is a valid React Native color string.

The result describes one point only. It does not certify contrast across an image, a gradient, or a text region.
Region sampling, minimum contrast across an area, scrims, and custom foreground palettes are not part of this contract.

## 5. Readiness and asynchronous behavior

- The caller starts a request after non-zero layout and after the relevant images load.
- `onLayout` alone does not prove that an image is ready.
- An adapter detects a zero size only. It does not detect an image that is not loaded.
- Refresh is explicit. The library does not capture on each render or each frame.
- Each request resolves or rejects.
- An already-aborted `signal` rejects with `ABORTED` before the capture starts.
- A `signal` that aborts during the capture rejects with `ABORTED`. The library discards the sample.
- A native capture is one synchronous block. An abort cannot stop it. The block always restores the foreground.
- Cancellation and unmount release resources. The one-pixel bitmap does not leave the adapter.

A later hook can coalesce refreshes, discard stale completions, and expose pending and error states.
The hook is not part of this contract.

## API (v1)

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

The `backdrop` accepts the form `#rrggbb` only. Uppercase and lowercase hexadecimal digits are valid.
Short forms, alpha forms, color names, functional notation, and values with white space are invalid.

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
The shared core validates in this sequence: `point`, `backdrop`, view references, `signal`, adapter.

| Code | Exact condition |
| --- | --- |
| `INVALID_POINT` | The `point` is not an object, or `x` or `y` is not a finite number. Or the mapped point is outside the captured area. |
| `INVALID_BACKDROP` | A `backdrop` is supplied and it is not an opaque `#rrggbb` string. The check occurs before the capture, also for an opaque sample. |
| `INVALID_VIEW_RELATIONSHIP` | A reference is absent or its value is `null`. Or the two references are the same view. Or a reference does not resolve to a native view (probable cause: no `collapsable={false}`). Or a view is not attached. Or the foreground is not a descendant of the `captureRoot`. |
| `ABORTED` | The `signal` is aborted before the capture, or it aborts before the capture settles. |
| `NOT_READY` | The `captureRoot` or the foreground has a zero width or a zero height. |
| `UNSUPPORTED_CONTENT` | The mapping or the content is outside the supported subset, and the adapter detected it. Refer to the list below. |
| `UNRESOLVED_BACKDROP` | The sample is translucent (alpha less than 1) and no `backdrop` is supplied. This is the only condition. |
| `CAPTURE_FAILED` | No capture adapter exists. Or the capture did not complete. Or the adapter returned an invalid sample. |

Conditions that give `UNSUPPORTED_CONTENT`:

- A transform outside the supported subset is between the foreground and the `captureRoot`.
- An effect that the adapter detects covers the sample point. The message names the effect. Refer to section "Supported content".
- Web: the `captureRoot` contains a cross-origin image, or the canvas is not readable.
- Android: the software draw finds a hardware bitmap. This path is implemented and not exercised.

A convenience component can show an explicit fallback color.
That component must expose the failure. A fallback color is not a successful sample.

## Supported content

"Verified" means that a sampled value agreed with a known fixture value within the raster tolerance.
The device type is in parentheses. Web is experimental.

| Content | iOS | Android | Web |
| --- | --- | --- | --- |
| Solid colors and `Image` with `stretch`, `cover`, `contain` | Verified (simulators, iOS 18.4 and 26.5) | Verified (emulator, API 35) | Verified (Chromium 156). Not stable (WebKit 27.2). |
| Translucent layers in the root | Verified | Verified | Verified (Chromium). Not stable (WebKit). |
| Transparent containers, nested layout, vertical `ScrollView` offset | Verified | Verified | Verified (Chromium). Not stable (WebKit). |
| Foreground with translate, scale, rotate | Verified | Verified | Translate only |
| Residual transparency with a `backdrop` | Verified | Verified | Verified (Chromium and WebKit) |
| Root with its own opacity | Verified: not in the sample | Verified: not in the sample | Verified (Chromium and WebKit): not in the sample |
| Cross-origin image | Not applicable | Not applicable | Rejected with `UNSUPPORTED_CONTENT` |

### Effects (blur, Liquid Glass, filters)

No adapter renders these effects. The measured differences are in [spike/blur-and-glass.md](spike/blur-and-glass.md).
An adapter rejects a sample when a detected effect covers the sample point.
A sample at a point that the effect does not cover stays valid.
The detection is geometric. It rejects also when opaque content covers the effect at that point.

| Effect | Detection | Result when the effect covers the point |
| --- | --- | --- |
| iOS `UIVisualEffectView` with an effect (`UIBlurEffect`, `UIGlassEffect`, each other subclass) | Detected by class. Observed with `expo-blur` and `expo-glass-effect`. | `UNSUPPORTED_CONTENT` |
| iOS material or glass that is not a `UIVisualEffectView` (for example SwiftUI) | Not detected | Not supported. The sample can be wrong without an error. Not exercised. |
| Android Dimezis `BlurView` with an active controller (`expo-blur` with `blurMethod`) | Detected by class name | `UNSUPPORTED_CONTENT` |
| Android React Native `filter` style | Detected by the view tag that React Native sets | `UNSUPPORTED_CONTENT` |
| Android `View.setRenderEffect` from other code, other blur libraries | Not detected. Android has no public read access to the `RenderEffect` of a view. | Not supported. The sample can be wrong without an error. |
| Android `expo-blur` with the default `blurMethod` (`none`) | No effect. It is a translucent color. | Supported. Verified (emulator): the sample agrees with the screen. |
| Web `backdrop-filter` and `filter` (computed style) | Detected | `UNSUPPORTED_CONTENT` |
| `GlassView` where Liquid Glass is not available (iOS 18.4, Android, web) | No effect. It is a plain view. | Supported. Verified: the sample agrees with the screen. |

If the foreground subtree contains the effect, the capture excludes the effect with the foreground.
The sample is then the content below the effect. It is not the color that the screen shows below the label.

## Not verified

Do not describe these items as supported.

- Physical devices, release builds, and display color modes other than sRGB.
- The transform of the `captureRoot` itself. iOS and Android sampled the root-local point for translate, scale, and rotate.
  Web reported a `capturePoint` in screen-space units for scale and rotate. The platforms disagree. No rule is locked.
- A `captureRoot` that is a scroll container. Horizontal scroll. Nested scroll containers.
- 3D rotations without perspective (`rotateX`, `rotateY`), skew, and `matrix` transforms.
- Clipping (`overflow: 'hidden'`) at the sample point, borders, shadows, gradients, and text as background content.
- Android below API 35. The `View.INVISIBLE` path below API 29 ran through a debug mode on API 35 only.
- Android hardware bitmaps. `SurfaceView`, `TextureView`, video, camera, maps, and GPU surfaces on each platform (no detection).
- iOS Metal layers and video layers (no detection).
- Web: Firefox (not executed). WebKit gave 2 wrong samples in 35 cases in each run. CSS that `html2canvas-pro` does not support.
- Screen readers. The checks compared accessibility flags only.
- Theme change, image change, and refresh sequence (acceptance scenario 10).
- Memory growth and bitmap retention under repeated captures.
- Image load detection. The caller is responsible for it.

## Current implementation

| Part | State |
| --- | --- |
| Backdrop parse and composition (`src/core/color.ts`) | Implemented, unit tests. |
| Luminance, ratio, and selection (`src/core/contrast.ts`) | Implemented, unit tests. |
| `sampleContrast` input validation and result flow (`src/sampleContrast.ts`) | Implemented, tested with a fake adapter. |
| Capture, exclusion, point mapping, decode, effect detection | Not in the package. Spike code in `example/modules/palette-sampler/` follows this contract. |
