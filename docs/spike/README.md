# Sampling spike (delivery step 1)

**Status: complete on simulators and one emulator. Physical devices are not tested.**
The report is below. The fixture application is in [example/](../../example/README.md).
The source is [HANDOFF.md](../HANDOFF.md), sections "Delivery sequence" and "Exact next action".

## Brief

Start with the sampling spike. Do not start with a color-only npm wrapper.

1. Read the handoff and the linked Palette-iOS source.
2. Build one fixture: an image, a transparent or translucent overlay, and a movable foreground.
3. Sample the rendered background below the foreground. Exclude the foreground from the capture.
4. Prove point mapping, exclusion, composition, and restoration on iOS.
5. Prove the same four items on Android.
6. Assess the web adapter.
7. Compare the backend alternatives.
8. Record the supported content and the runtime constraints.
9. Complete the report template below.

Use the then-current versions of React Native and Expo. Record each version in the report.
Put the fixture application in [example/](../../example/README.md).
Keep spike code that is not part of the example in this directory.

## Rules

- A capture that decodes is not evidence that the background is correct. A capture can be blank without an error.
- Compare each sampled value with a known fixture pixel.
- A simulator or an emulator does not prove physical-device behavior. Record the device type.
- If a generic sampler cannot satisfy the contract, propose a controlled component with a smaller stated scope.
- Do not weaken the contract silently.
- Do not block the spike on names or on publication.

## Output

The spike returns these items:

- Observed RGBA and contrast results.
- Foreground-restoration evidence.
- Capture limitations.
- The recommended backend.
- Inputs for the decisions that [open-decisions.md](../open-decisions.md) assigns to step 1.

---

# Spike report

The data in this report comes from simulators, one emulator, and headless browsers.
No physical device was used. This report does not establish physical-device behavior.
All native runs used a debug build and a development JavaScript bundle.

## Environment

| Item | Value |
| --- | --- |
| Date | 7 October 2026 |
| Author | Claude Code agent, for Carlos Simon |
| React Native version | 0.86.3 |
| Expo SDK version | 57 (`expo` 57.0.27, `expo-modules-core` 57.0.21) |
| React version | 19.2.3 |
| Runtime (development build or Expo Go) | Development build (`expo prebuild`, `expo run:ios`, Gradle `assembleDebug`). Not Expo Go. |
| Architecture (New Architecture on or off) | On (Fabric, bridgeless) |
| Web packages | `react-native-web` 0.21.3, `html2canvas-pro` 2.5.2 |
| Baseline packages | `react-native-view-shot` 5.1.0, `upng-js` 2.1.0 |
| Build tools | Xcode 26.6, JDK 17 (Zulu), Android compile SDK 36, Node.js 24.20.0 |
| Host | Mac16,8 (Apple M4 Pro), macOS 27.0.1 |

`npm` shows `react-native` 0.87.1 as the latest version. Expo SDK 57 selects 0.86.3.
The spike used the Expo SDK 57 selection.

## Fixture description

- Image source and dimensions: `example/assets/fixture.png` and `example/assets/bands.png`. Each image is 400 x 400 pixels, 8-bit RGB, sRGB, no alpha. `example/scripts/generate-fixtures.mjs` writes them.
- Known pixel values and their positions:
  - `fixture.png` has four flat quadrants: top-left `#ffffff`, top-right `#000000`, bottom-left `#ff9500`, bottom-right `#0000ff`.
  - `bands.png` has four flat horizontal bands: `#ff0000`, `#ffff00`, `#800080`, `#00ffff`.
  - `example/src/fixture.ts` calculates each expected value from these definitions and from source-over math.
- Overlay color and alpha: `rgba(0,0,0,0.5)` at the rectangle (75, 75, 150, 150) of the main capture root.
- Foreground content and positions tested: an opaque `#ff00ff` panel of 60 x 30 logical units. It contains a `Text` and a nested `View` with a child `View`. The main fixture has 13 positions. Three of them have a transform (translate, scale, rotate).
- Capture roots:
  - Main: 300 x 300, `fixture.png` with `resizeMode="stretch"`, the overlay, and a transparent child container with a second foreground.
  - Scroll: 300 x 200, a `ScrollView` with four flat blocks, scrolled by 80 logical units.
  - Cover and contain: 300 x 150 with a `#00ff00` background and `bands.png`.
  - Residual: 200 x 60 with no painted background. The right half has a `rgba(0,0,0,0.5)` layer.
  - Zero size, root with `opacity: 0.5`, root that React Native can flatten, and (web only) root with a cross-origin image.

The sample point is the top-left point of the foreground, unless the case supplies an explicit point.
All sample points are a minimum of 5 logical units from a color edge.

## Backend alternatives compared

| Alternative | Exclusion method | Platforms | Works in Expo Go | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| Custom native module, one-pixel render | iOS: `layer.isHidden` in one `CATransaction` in one main-queue block. Android: `transitionAlpha = 0` in one UI-thread message. | iOS, Android | No | Pass: 31 of 31 (iOS), 32 of 32 (Android). No frame without the foreground. | Recommended. |
| Same module, Android `View.INVISIBLE` | `setVisibility(INVISIBLE)` and restore in `finally` | Android | No | Pass for 1 case. | Not preferred. A visibility change can clear focus and can send accessibility events (assumption from the Android source, not measured). |
| `react-native-view-shot` `captureRef` and PNG decode in JS | React state change to `opacity: 0` | iOS, Android | Yes | Fail. The foreground is absent from 71% to 74% of the recorded frames. | Refer to "Baseline results". |
| `html2canvas-pro` DOM render | `ignoreElements` on the clone pass. No change to the live DOM. | Web | Not applicable | Chromium: 32 of 32. WebKit: 30 of 32, not stable. | Experimental only. |
| Controlled background and foreground component | Separate background layer | All | Not assessed | Not built. | Not necessary for the tested content. It stays the fallback for unsupported content. |

## Observed RGBA and contrast results

RGBA values are 8-bit (0 to 255). The position is the sampled capture point in capture-root logical units.
"Expected" shows the expected sample and the expected foreground, or the expected error code.
The full records, with pixel coordinates and restoration flags, are in `docs/spike/evidence/`.

### iOS

Device and OS version: iPhone 16, iOS 18.4, scale 3. Physical device or simulator: simulator.
A second run on iPhone 17, iOS 26.5, scale 3 (simulator) gave the same table.

| Sample position | Expected RGBA | Sampled RGBA | Resolved RGBA | Foreground | Contrast ratio | Match |
| --- | --- | --- | --- | --- | --- | --- |
| `image-white` (20, 20) | 255, 255, 255, 255; black | 255, 255, 255, 255 | 255, 255, 255, 255 | black | 21 | yes |
| `image-black` (220, 20) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `image-orange` (20, 250) | 255, 149, 0, 255; black | 255, 149, 0, 255 | 255, 149, 0, 255 | black | 9.551 | yes |
| `image-blue` (220, 250) | 0, 0, 255, 255; white | 0, 0, 255, 255 | 0, 0, 255, 255 | white | 8.592 | yes |
| `overlay-on-white` (85, 90) | 127.5, 127.5, 127.5, 255; black | 127, 127, 127, 255 | 127, 127, 127, 255 | black | 5.245 | yes |
| `overlay-on-black` (160, 90) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `overlay-on-orange` (85, 180) | 127.5, 74.5, 0, 255; white | 127, 74, 0, 255 | 127, 74, 0, 255 | white | 7.287 | yes |
| `overlay-on-blue` (160, 180) | 0, 0, 127.5, 255; white | 0, 0, 127, 255 | 0, 0, 127, 255 | white | 16.074 | yes |
| `explicit-point` (160, 30) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `transparent-child` (85, 265) | 255, 149, 0, 255; black | 255, 149, 0, 255 | 255, 149, 0, 255 | black | 9.551 | yes |
| `other-foreground-stays` (100, 275) | 255, 0, 255, 255; black | 255, 0, 255, 255 | 255, 0, 255, 255 | black | 6.696 | yes |
| `transform-translate` (220, 20) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `transform-scale` (160, 35) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `transform-rotate` (165, 25) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `scroll-offset` (20, 50) | 0, 0, 255, 255; white | 0, 0, 255, 255 | 0, 0, 255, 255 | white | 8.592 | yes |
| `cover-yellow` (20, 20) | 255, 255, 0, 255; black | 255, 255, 0, 255 | 255, 255, 0, 255 | black | 19.556 | yes |
| `cover-purple` (200, 100) | 128, 0, 128, 255; white | 128, 0, 128, 255 | 128, 0, 128, 255 | white | 9.419 | yes |
| `contain-red` (100, 10) | 255, 0, 0, 255; black | 255, 0, 0, 255 | 255, 0, 0, 255 | black | 5.252 | yes |
| `contain-letterbox` (5, 10) | 0, 255, 0, 255; black | 0, 255, 0, 255 | 0, 255, 0, 255 | black | 15.304 | yes |
| `contain-cyan` (160, 120) | 0, 255, 255, 255; black | 0, 255, 255, 255 | 0, 255, 255, 255 | black | 16.748 | yes |
| `residual-no-backdrop` (10, 10) | `UNRESOLVED_BACKDROP`; sample 0, 0, 0, 0 | 0, 0, 0, 0 | `UNRESOLVED_BACKDROP` | - | - | yes |
| `residual-backdrop-white` (10, 10) | 0, 0, 0, 0; black | 0, 0, 0, 0 | 255, 255, 255, 255 | black | 21 | yes |
| `residual-backdrop-black` (10, 10) | 0, 0, 0, 0; white | 0, 0, 0, 0 | 0, 0, 0, 255 | white | 21 | yes |
| `residual-half-no-backdrop` (120, 10) | `UNRESOLVED_BACKDROP`; sample 0, 0, 0, 127.5 | 0, 0, 0, 128 | `UNRESOLVED_BACKDROP` | - | - | yes |
| `residual-half-backdrop-white` (120, 10) | 0, 0, 0, 127.5; black | 0, 0, 0, 128 | 127, 127, 127, 255 | black | 5.245 | yes |
| `error-not-descendant` - | `INVALID_VIEW_RELATIONSHIP` | `INVALID_VIEW_RELATIONSHIP` | - | - | - | yes |
| `error-point-outside` - | `INVALID_POINT` | `INVALID_POINT` | - | - | - | yes |
| `error-zero-size-root` - | `NOT_READY` | `NOT_READY` | - | - | - | yes |
| `negative-control-no-exclusion` (20, 20) | 255, 0, 255, 255; black | 255, 0, 255, 255 | 255, 0, 255, 255 | black | 6.696 | yes |
| `restore-after-forced-error` - | `CAPTURE_FAILED` | `CAPTURE_FAILED` | - | - | - | yes |
| `restore-after-abort` - | `ABORTED` | `ABORTED` | - | - | - | yes |
| `observe-unmount-in-flight` (10, 45) | observation | 0, 0, 0, 0 | - | - | - | observation |
| `observe-root-opacity` (10, 5) | observation | 255, 255, 255, 128 | `UNRESOLVED_BACKDROP` | - | - | observation |
| `observe-flattened-root` - | observation | `INVALID_VIEW_RELATIONSHIP` | - | - | - | observation |

Result: 31 of 31 cases pass. Maximum channel difference: 0.5. Maximum capture point difference: 0.

### Android

Device and OS version: AVD `MainDisk_Android_10GB` (`sdk_gphone64_arm64`), Android 15 (API 35), 1080 x 2400, density 2.625. Physical device or emulator: emulator (`-gpu host`).

| Sample position | Expected RGBA | Sampled RGBA | Resolved RGBA | Foreground | Contrast ratio | Match |
| --- | --- | --- | --- | --- | --- | --- |
| `image-white` (20.19, 20.19) | 255, 255, 255, 255; black | 255, 255, 255, 255 | 255, 255, 255, 255 | black | 21 | yes |
| `image-black` (220.19, 20.19) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `image-orange` (20.19, 249.905) | 255, 149, 0, 255; black | 255, 149, 0, 255 | 255, 149, 0, 255 | black | 9.551 | yes |
| `image-blue` (220.19, 249.905) | 0, 0, 255, 255; white | 0, 0, 255, 255 | 0, 0, 255, 255 | white | 8.592 | yes |
| `overlay-on-white` (84.952, 89.905) | 127.5, 127.5, 127.5, 255; black | 127, 127, 127, 255 | 127, 127, 127, 255 | black | 5.245 | yes |
| `overlay-on-black` (160, 89.905) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `overlay-on-orange` (84.952, 180.19) | 127.5, 74.5, 0, 255; white | 127, 74, 0, 255 | 127, 74, 0, 255 | white | 7.287 | yes |
| `overlay-on-blue` (160, 180.19) | 0, 0, 127.5, 255; white | 0, 0, 127, 255 | 0, 0, 127, 255 | white | 16.074 | yes |
| `explicit-point` (159.905, 30.19) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `transparent-child` (84.952, 265.143) | 255, 149, 0, 255; black | 255, 149, 0, 255 | 255, 149, 0, 255 | black | 9.551 | yes |
| `other-foreground-stays` (100.19, 275.048) | 255, 0, 255, 255; black | 255, 0, 255, 255 | 255, 0, 255, 255 | black | 6.696 | yes |
| `transform-translate` (220.19, 20.19) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `transform-scale` (160.286, 35.143) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `transform-rotate` (164.952, 24.762) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `scroll-offset` (20.19, 49.905) | 0, 0, 255, 255; white | 0, 0, 255, 255 | 0, 0, 255, 255 | white | 8.592 | yes |
| `cover-yellow` (20.19, 20.19) | 255, 255, 0, 255; black | 255, 255, 0, 255 | 255, 255, 0, 255 | black | 19.556 | yes |
| `cover-purple` (200, 100.19) | 128, 0, 128, 255; white | 128, 0, 128, 255 | 128, 0, 128, 255 | white | 9.419 | yes |
| `contain-red` (100.19, 9.905) | 255, 0, 0, 255; black | 255, 0, 0, 255 | 255, 0, 0, 255 | black | 5.252 | yes |
| `contain-letterbox` (4.952, 9.905) | 0, 255, 0, 255; black | 0, 255, 0, 255 | 0, 255, 0, 255 | black | 15.304 | yes |
| `contain-cyan` (160, 120) | 0, 255, 255, 255; black | 0, 255, 255, 255 | 0, 255, 255, 255 | black | 16.748 | yes |
| `residual-no-backdrop` (9.905, 9.905) | `UNRESOLVED_BACKDROP`; sample 0, 0, 0, 0 | 0, 0, 0, 0 | `UNRESOLVED_BACKDROP` | - | - | yes |
| `residual-backdrop-white` (9.905, 9.905) | 0, 0, 0, 0; black | 0, 0, 0, 0 | 255, 255, 255, 255 | black | 21 | yes |
| `residual-backdrop-black` (9.905, 9.905) | 0, 0, 0, 0; white | 0, 0, 0, 0 | 0, 0, 0, 255 | white | 21 | yes |
| `residual-half-no-backdrop` (120, 9.905) | `UNRESOLVED_BACKDROP`; sample 0, 0, 0, 127.5 | 0, 0, 0, 128 | `UNRESOLVED_BACKDROP` | - | - | yes |
| `residual-half-backdrop-white` (120, 9.905) | 0, 0, 0, 127.5; black | 0, 0, 0, 128 | 127, 127, 127, 255 | black | 5.245 | yes |
| `error-not-descendant` - | `INVALID_VIEW_RELATIONSHIP` | `INVALID_VIEW_RELATIONSHIP` | - | - | - | yes |
| `error-point-outside` - | `INVALID_POINT` | `INVALID_POINT` | - | - | - | yes |
| `error-zero-size-root` - | `NOT_READY` | `NOT_READY` | - | - | - | yes |
| `negative-control-no-exclusion` (20.19, 20.19) | 255, 0, 255, 255; black | 255, 0, 255, 255 | 255, 0, 255, 255 | black | 6.696 | yes |
| `restore-after-forced-error` - | `CAPTURE_FAILED` | `CAPTURE_FAILED` | - | - | - | yes |
| `restore-after-abort` - | `ABORTED` | `ABORTED` | - | - | - | yes |
| `android-visibility-exclusion` (20.19, 20.19) | 255, 255, 255, 255; black | 255, 255, 255, 255 | 255, 255, 255, 255 | black | 21 | yes |
| `observe-unmount-in-flight` (9.905, 44.952) | observation | 0, 0, 0, 0 | - | - | - | observation |
| `observe-root-opacity` (9.905, 4.952) | observation | 255, 255, 255, 255 | 255, 255, 255, 255 | black | 21 | observation |
| `observe-flattened-root` - | observation | `INVALID_VIEW_RELATIONSHIP` | - | - | - | observation |

Result: 32 of 32 cases pass. Maximum channel difference: 0.5. Maximum capture point difference: 0.286 logical units.
The capture point differs from the layout value because React Native aligns each view to a physical pixel at density 2.625.

### Web

Browser engines and versions: Chromium 156.0.8078.4 (headless, Playwright 1.64.0) at device pixel ratio 1 and 2. WebKit 27.2 (Playwright build) at device pixel ratio 2. Firefox 157.0 did not start in this environment ("Could not find profile folder"). Firefox was not executed.

Chromium, device pixel ratio 2. The run at device pixel ratio 1 gave the same table.

| Sample position | Expected RGBA | Sampled RGBA | Resolved RGBA | Foreground | Contrast ratio | Match |
| --- | --- | --- | --- | --- | --- | --- |
| `image-white` (20, 20) | 255, 255, 255, 255; black | 255, 255, 255, 255 | 255, 255, 255, 255 | black | 21 | yes |
| `image-black` (220, 20) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `image-orange` (20, 250) | 255, 149, 0, 255; black | 255, 149, 0, 255 | 255, 149, 0, 255 | black | 9.551 | yes |
| `image-blue` (220, 250) | 0, 0, 255, 255; white | 0, 0, 255, 255 | 0, 0, 255, 255 | white | 8.592 | yes |
| `overlay-on-white` (85, 90) | 127.5, 127.5, 127.5, 255; black | 127, 127, 127, 255 | 127, 127, 127, 255 | black | 5.245 | yes |
| `overlay-on-black` (160, 90) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `overlay-on-orange` (85, 180) | 127.5, 74.5, 0, 255; white | 127, 74, 0, 255 | 127, 74, 0, 255 | white | 7.287 | yes |
| `overlay-on-blue` (160, 180) | 0, 0, 127.5, 255; white | 0, 0, 127, 255 | 0, 0, 127, 255 | white | 16.074 | yes |
| `explicit-point` (160, 30) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `transparent-child` (85, 265) | 255, 149, 0, 255; black | 255, 149, 0, 255 | 255, 149, 0, 255 | black | 9.551 | yes |
| `other-foreground-stays` (100, 275) | 255, 0, 255, 255; black | 255, 0, 255, 255 | 255, 0, 255, 255 | black | 6.696 | yes |
| `transform-translate` (220, 20) | 0, 0, 0, 255; white | 0, 0, 0, 255 | 0, 0, 0, 255 | white | 21 | yes |
| `transform-scale` - | `UNSUPPORTED_CONTENT` | `UNSUPPORTED_CONTENT` | - | - | - | yes |
| `transform-rotate` - | `UNSUPPORTED_CONTENT` | `UNSUPPORTED_CONTENT` | - | - | - | yes |
| `scroll-offset` (20, 50) | 0, 0, 255, 255; white | 0, 0, 255, 255 | 0, 0, 255, 255 | white | 8.592 | yes |
| `cover-yellow` (20, 20) | 255, 255, 0, 255; black | 255, 255, 0, 255 | 255, 255, 0, 255 | black | 19.556 | yes |
| `cover-purple` (200, 100) | 128, 0, 128, 255; white | 128, 0, 128, 255 | 128, 0, 128, 255 | white | 9.419 | yes |
| `contain-red` (100, 10) | 255, 0, 0, 255; black | 255, 0, 0, 255 | 255, 0, 0, 255 | black | 5.252 | yes |
| `contain-letterbox` (5, 10) | 0, 255, 0, 255; black | 0, 255, 0, 255 | 0, 255, 0, 255 | black | 15.304 | yes |
| `contain-cyan` (160, 120) | 0, 255, 255, 255; black | 0, 255, 255, 255 | 0, 255, 255, 255 | black | 16.748 | yes |
| `residual-no-backdrop` (10, 10) | `UNRESOLVED_BACKDROP`; sample 0, 0, 0, 0 | 0, 0, 0, 0 | `UNRESOLVED_BACKDROP` | - | - | yes |
| `residual-backdrop-white` (10, 10) | 0, 0, 0, 0; black | 0, 0, 0, 0 | 255, 255, 255, 255 | black | 21 | yes |
| `residual-backdrop-black` (10, 10) | 0, 0, 0, 0; white | 0, 0, 0, 0 | 0, 0, 0, 255 | white | 21 | yes |
| `residual-half-no-backdrop` (120, 10) | `UNRESOLVED_BACKDROP`; sample 0, 0, 0, 127.5 | 0, 0, 0, 128 | `UNRESOLVED_BACKDROP` | - | - | yes |
| `residual-half-backdrop-white` (120, 10) | 0, 0, 0, 127.5; black | 0, 0, 0, 128 | 127, 127, 127, 255 | black | 5.245 | yes |
| `error-not-descendant` - | `INVALID_VIEW_RELATIONSHIP` | `INVALID_VIEW_RELATIONSHIP` | - | - | - | yes |
| `error-point-outside` - | `INVALID_POINT` | `INVALID_POINT` | - | - | - | yes |
| `error-zero-size-root` - | `NOT_READY` | `NOT_READY` | - | - | - | yes |
| `error-cross-origin-image` - | `UNSUPPORTED_CONTENT` | `UNSUPPORTED_CONTENT` | - | - | - | yes |
| `observe-cross-origin-unchecked` (60, 5) | observation | 255, 255, 255, 255 | 255, 255, 255, 255 | black | 21 | observation |
| `negative-control-no-exclusion` (20, 20) | 255, 0, 255, 255; black | 255, 0, 255, 255 | 255, 0, 255, 255 | black | 6.696 | yes |
| `restore-after-forced-error` - | `CAPTURE_FAILED` | `CAPTURE_FAILED` | - | - | - | yes |
| `restore-after-abort` - | `ABORTED` | `ABORTED` | - | - | - | yes |
| `observe-unmount-in-flight` (10, 45) | observation | 0, 0, 0, 0 | - | - | - | observation |
| `observe-root-opacity` (10, 5) | observation | 255, 255, 255, 128 | `UNRESOLVED_BACKDROP` | - | - | observation |

Chromium result: 32 of 32 cases pass in each run.

WebKit result: 30 of 32 cases pass in each of three runs. The two failed cases are different in each run.
In each failure the sample has no image pixel: alpha 0, or only the overlay `0, 0, 0, 128`.
The repeated loop had 1 wrong sample in 30 in two runs. The first run stopped at a wrong sample.
The DOM renderer gave no error. The cause is not known.
With a `backdrop`, such a sample resolves to a wrong color without an error.

### Baseline results (`react-native-view-shot`, JS `opacity: 0`)

| Platform | Cases that pass | Failures |
| --- | --- | --- |
| iOS 18.4 simulator | 4 of 5 | `transform-translate`: sampled the untransformed position (`measureLayout` does not include transforms). |
| iOS 26.5 simulator | 2 of 5 | `transform-translate` as above. Blue sampled as `0, 0, 245`. Overlay on orange sampled as `120, 76, 23`. The PNG is not in sRGB. |
| Android 15 emulator | 3 of 5 | `transform-translate` as above. `explicit-point` sampled `255, 0, 255`: the foreground was in the capture. |

### Negative control

The debug mode `skipExclusion` keeps the foreground in the capture.
The sample is then `255, 0, 255, 255` on iOS, Android, and web (case `negative-control-no-exclusion`).
The case `other-foreground-stays` shows that the capture excludes only the requested foreground.

## Foreground-restoration evidence

| Check | iOS | Android | Web |
| --- | --- | --- | --- |
| No visible flash (frame capture or screen record) | Pass. iOS 18.4: 1001 frames in 5.98 s, 12729 samples, same magenta pixel count in each frame. iOS 26.5: 954 frames, 19023 samples, same count. | Pass. 294 frames in 5.97 s, 5285 samples. The count is 13476 or 13477 in each frame. | Not recorded. The observer shows no DOM change from the capture in the root subtree. |
| Layout is the same before and after | Pass (`frame`, `bounds`, sibling index) | Pass (`left`, `top`, `right`, `bottom`, child index) | Pass (bounding rectangle, child index) |
| Opacity, visibility, and transforms are the same | Pass (`isHidden`, `layer.isHidden`, `alpha`, `layer.opacity`, `transform`) | Pass (`visibility`, `alpha`, `transitionAlpha`, translation, scale, rotation) | Pass (computed `display`, `visibility`, `opacity`, `transform`) |
| Accessibility and hit tests are the same | Flags only: `isAccessibilityElement`, `accessibilityElementsHidden`, `isUserInteractionEnabled`. No VoiceOver run. | Flags only: `importantForAccessibility`, `isClickable`, `isEnabled`, `hasFocus`. No TalkBack run. | Attributes only: `aria-hidden`, `pointer-events`. No screen reader run. |
| State is restored after an error | Pass (`restore-after-forced-error`: failure after the exclusion) | Pass (same case) | Pass (same case; the web adapter never changes the DOM) |
| State is restored after cancellation | Pass (`restore-after-abort`) | Pass (same case) | Pass (same case) |
| State is restored after unmount | The request settled. The native block is synchronous, so no excluded state exists outside that block. | Same as iOS | The request settled. The adapter does not change the DOM. |

Method:

- The native module returns the foreground state before, during, and after the exclusion. The suite compares "before" with "after".
- The suite also reads the state through a separate native call before and after each request.
- "During" differs from "before" in each native capture (`layer.isHidden` is true, or `transitionAlpha` is 0). Thus the exclusion did occur.
- The repeated loop (200 samples) had 0 wrong samples and 0 state differences on iOS and on Android.
- The screen record covers a loop of approximately 6 seconds. `docs/spike/tools/flash-check.mjs` counts the magenta pixels in each recorded frame.
- With the view-shot baseline, the same check shows the foreground absent in 214 of 301 frames (iOS 18.4), 218 of 299 frames (iOS 26.5), and 219 of 295 frames (Android). Thus the check can detect a foreground that disappears.

Limits of this evidence:

- The simulator record has variable frame timing. The largest interval between two recorded frames in the loop was 0.35 s (iOS 18.4) and 0.46 s (iOS 26.5). On Android it was 0.05 s.
- A screen record of a simulator is not a record of a physical display.
- On web, 4 of 23 captures had one `style` mutation in the root. This agrees with the text color update that the fixture applies after the previous case. This cause is an inference.

Evidence links: `docs/spike/evidence/` (suite output for each platform and `flash-check.jsonl`). The video files are not in the repository.

## Capture limitations

"Observed" means that the spike measured the behavior. "Assumed" means that the spike did not exercise it.

| Platform | Unsupported content | Detection (explicit error or silent) | Notes |
| --- | --- | --- | --- |
| iOS | Visual-effect views, Metal layers, video layers (`layer.render(in:)` does not draw them) | Silent. No detection is implemented. | Assumed. The fixture has no such content. |
| iOS | Perspective transform between the foreground and the capture root | Explicit `UNSUPPORTED_CONTENT` | Implemented, not exercised. |
| Android | Hardware bitmaps in the capture root | Explicit `UNSUPPORTED_CONTENT` | Implemented, not exercised. React Native did not use hardware bitmaps for the fixture images. |
| Android | `SurfaceView`, `TextureView`, video, camera | Silent. No detection is implemented. | Assumed. |
| Android | Perspective transform between the foreground and the capture root | Explicit `UNSUPPORTED_CONTENT` | Implemented, not exercised. |
| Android | `transitionAlpha` needs API 29 | The module uses `INVISIBLE` below API 29 | The fallback was executed on API 35 through a debug mode only. |
| Web | Scale and rotate between the foreground and the capture root | Explicit `UNSUPPORTED_CONTENT` | Observed. The mapping uses bounding rectangles. |
| Web | Cross-origin image | Explicit `UNSUPPORTED_CONTENT` from a check in the adapter | Observed. Without the check, the renderer omits the image and gives `255, 255, 255` where the screen shows black. No error occurs. |
| Web | Image content in WebKit | Silent | Observed. Intermittent absent image pixels. |
| Web | CSS that `html2canvas-pro` does not support | Silent | Assumed. The renderer rebuilds the DOM. It is not a browser screenshot. |
| All | A view that React Native flattens | Explicit `INVALID_VIEW_RELATIONSHIP` on iOS and Android | Observed. A view with no paint and no `collapsable={false}` has no native view. |
| All | A different foreground at the sample point | None. It is background content. | Observed. The capture excludes only the requested foreground. |

Effects outside the capture root (opacity, transforms, ancestor effects):

- Opacity of the capture root itself (`opacity: 0.5`, white background). iOS: included, sample alpha 128. Web: included, sample alpha 128. Android: not included, sample alpha 255. Observed. The platforms disagree.
- Transform of the capture root itself: not assessed.
- Effects of ancestors of the capture root: not included by design (subtree render). Not exercised.
- A capture root that is a scroll container: not assessed.

Other observations:

- React Native 0.86.3 on Android stopped with "Cannot read property 'forEach' of null" when a `transform` style changed from an array to `undefined`. The fixture uses an empty array. This defect is not in the sampler.
- `Image` on Android has a default fade. The fixture sets `fadeDuration={0}`. A sample during the fade is an assumption, not an observation.
- Readiness in the fixture is `onLoad` of all images. No readiness detection exists in the adapter.

## Recommended backend

- Recommendation: a small custom native module for iOS and Android. It does one synchronous UI-thread transaction and renders one pixel. The generic sampler satisfied exclusion, composition, point mapping, and restoration for the tested content on the two simulators and the emulator.
- Web: `html2canvas-pro` with `ignoreElements` is a candidate for an experimental adapter. Do not advertise web support. Chromium passed. WebKit did not. Firefox was not executed.
- Native module framework recommendation: Expo Modules API was a convenience for the spike. It is not the final framework decision. Trade-off:
  - Expo Modules API: approximately 170 lines for each platform, autolinking, a view lookup by tag, and coded errors. A plain React Native application must add the `expo` package.
  - TurboModule: no Expo runtime. It needs a codegen specification, Objective-C++ code for the Swift implementation, and its own view lookup. The spike did not build it.
  - Input for step 3: keep Expo Modules API if the library is Expo-first. Select a TurboModule if plain React Native without the Expo runtime has priority.
- Installation complexity: a development build is necessary (`expo prebuild`, or `pod install` and Gradle). No Expo Go support is possible for this backend. No permission and no configuration plugin is necessary.
- Maintenance cost: two small native files with public UIKit and Android view APIs only. The view lookup depends on `expo-modules-core`. `findNodeHandle` supplies the view tag in JS. Step 3 must confirm the supported replacement for `findNodeHandle`.
- Rejected alternatives and the reason for each:
  - `react-native-view-shot` with a JS `opacity: 0` exclusion: the foreground disappears on screen, one Android sample contained the foreground, `measureLayout` ignores transforms, the iOS 26.5 PNG was not in sRGB, and p50 latency was 365 ms to 593 ms.
  - Android `View.INVISIBLE` as the default exclusion: it changes the visibility state. `transitionAlpha` does not.
  - Controlled component: not necessary for the tested content.
- Generic sampler or controlled component: generic sampler, with a stated supported-content subset. Use a controlled component only for content that the render cannot draw.

## Performance measurements

The latency is the time of one `sampleContrast` call from JS. "UI block" is the time in the native block.
The values come from debug builds on a simulator or an emulator on the host above.

| Platform | Device | Capture size (logical) | Density | p50 | p95 | UI block | JS block | Memory growth |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iOS | iPhone 16 simulator, iOS 18.4 | 300 x 300 root, 1 x 1 pixel bitmap | 3 | 0.34 ms | 0.53 ms | p50 0.17 ms, p95 0.29 ms | not assessed | not assessed |
| iOS | iPhone 17 simulator, iOS 26.5 | 300 x 300 root, 1 x 1 pixel bitmap | 3 | 0.19 ms | 0.29 ms | p50 0.10 ms, p95 0.17 ms | not assessed | not assessed |
| Android | API 35 emulator, host GPU | 300 x 300 root, 1 x 1 pixel bitmap | 2.625 | 4.4 ms | 13.3 ms | p50 0.39 ms, p95 0.79 ms | not assessed | not assessed |
| Web | Chromium 156 headless | 300 x 300 root, 1 x 1 CSS pixel canvas | 1 and 2 | 57 ms | 59 ms | not applicable | approximately the full latency (the render runs on the main thread) | not assessed |

Baseline (`react-native-view-shot`, full bitmap, PNG decode in JS), 30 samples: iOS 18.4 p50 365 ms and p95 399 ms; iOS 26.5 p50 593 ms and p95 599 ms; Android p50 570 ms and p95 631 ms.

Number of captures for each measurement: 200 on iOS and Android. 30 on web. 30 for the baseline.
Proposed performance budget: not set. Input for step 3: measure a release build on named physical devices first. The simulator data suggests a UI-thread budget of 2 ms (p95) as a first proposal.

Notes:

- Android showed larger values (p95 up to 57 ms) on an emulator with a software GPU. The table uses the run with `-gpu host`.
- The native block renders the full capture-root layer tree into a 1 x 1 bitmap. The cost can increase with the complexity of the root. The spike measured one root only.

## Contract inputs for step 2

These items are inputs from the spike. They are not locked decisions.

- Raster rounding rule: `pixel = floor(logical * scale)` on the mapped capture-root point. The three adapters use it. On Android the mapped point is already in physical pixels.
- Sampling footprint: exactly one physical pixel.
- Raster tolerance: 1 for each 8-bit channel was sufficient. The maximum observed difference was 0.5 (the expected value 127.5 gave 127 or 128). The suite limit was 2.
- Capture point tolerance: the reported capture point can differ from the layout value by less than one physical pixel (0.29 logical units at density 2.625).
- Supported transforms: translate, scale, and rotate (2D affine) on iOS and Android. Translate only on web. Perspective is rejected (not exercised).
- Capture root effects: the platforms disagree on the opacity of the capture root. Step 2 must select one rule (reject or normalize).
- View flattening: the two references must have a native view. `collapsable={false}` guarantees that.
- Exclusion scope: only the requested foreground subtree.
- Changes to the `CaptureAdapter` interface: none. The provisional interface was sufficient. Optional input: add the physical pixel coordinates to `CaptureSample` for diagnostics.

## Deviations and items that were not done

- React Native is 0.86.3 (Expo SDK 57), not 0.87.x.
- The iOS simulators are iPhone 16 (iOS 18.4) and iPhone 17 (iOS 26.5).
- The first fixture version put one sample point on a second foreground. The sampler returned magenta there, which was correct. The fixture moved the second foreground and added the case `other-foreground-stays`.
- The iOS transform check first rejected `scale` because React Native also scales the z axis. The check now rejects only perspective.
- Not done: physical devices, release builds, memory growth, JS and UI block profiles, Firefox, VoiceOver and TalkBack, theme and image-change refresh (acceptance row 10), content that the render cannot draw, TurboModule comparison.
