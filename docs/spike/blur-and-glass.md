# Blur and Liquid Glass (investigation, delivery step 2)

**Status: complete on two iOS simulators, one Android emulator, and headless Chromium. No physical device is tested.**
The handoff puts blur and material effects outside the initial guaranteed subset.
This report shows what the sampler returns with these effects, and what the screen shows.
Simulator rendering of Liquid Glass can differ from a device. Each value in this report is a simulator, emulator, or headless value.

## Summary

- Before step 2, the sampler returned a wrong color below an effect and gave no error. The largest measured difference was 181 of 255 (Liquid Glass on black, iOS 26.5 simulator).
- After step 2, an adapter rejects with `UNSUPPORTED_CONTENT` when a detected effect covers the sample point. The message names the effect.
- A sample at a point that the effect does not cover is correct and is not rejected (role 3).
- If the foreground contains the effect, the capture excludes the effect. The sample is then the content below the effect, not the screen color (role 2).
- No tested path gives the screen color and also excludes the foreground and also shows no flash. The options are in the last section.

## Versions and devices

| Item | Value |
| --- | --- |
| Date | 8 October 2026 |
| Expo SDK, React Native | `expo` 57.0.27, React Native 0.86.3, New Architecture, development build |
| Effect packages | `expo-blur` 57.0.3 (Android: Dimezis `BlurView` 3.1.0), `expo-glass-effect` 57.0.4 |
| iOS | iPhone 16 simulator, iOS 18.4, scale 3. iPhone 17 simulator, iOS 26.5, scale 3. Xcode 26.6. |
| Android | AVD `MainDisk_Android_10GB`, Android 15 (API 35), density 2.625, `-gpu host` |
| Web | Chromium 156.0.8078.4 headless (Playwright 1.64.0), device pixel ratio 2. WebKit 27.2 for the suite only. |

APIs, confirmed from the package source:

- `BlurView` on iOS is a `UIVisualEffectView` subclass (`BlurEffectView`) with a `UIBlurEffect`. Props: `tint`, `intensity`.
- `BlurView` on Android has the default `blurMethod` `'none'`. That method draws a translucent color and no blur.
  A real blur needs `blurMethod="dimezisBlurView"` (or `"dimezisBlurViewSdk31Plus"`) and a `blurTarget` reference to a `BlurTargetView`.
  `experimentalBlurMethod` is deprecated. On API 35 the controller was `RenderNodeBlurController`.
- `BlurView` on web sets `backdrop-filter: saturate(180%) blur(Npx)` and a translucent background color.
- `GlassView` on iOS contains a `UIVisualEffectView`. On iOS 26 it gets a `UIGlassEffect`. `isLiquidGlassAvailable()` was `true` on iOS 26.5 and `false` on iOS 18.4.
- `GlassView` on iOS 18.4, Android, and web is a plain view with no effect.

## Fixture and method

The fixture is in `example/src/effects.tsx`. Each root is 180 x 180 logical units.
`fixture.png` fills the root. The quadrants are white, black, orange `#ff9500`, and blue. Each quadrant is 90 x 90.
The effect panel is the rectangle (20, 20, 140, 140) with a corner radius of 16. The label is the rectangle (60, 80, 60, 20).

| Root | Content | Role |
| --- | --- | --- |
| `control` | Plain `rgba(0,0,0,0.5)` panel. No effect. | Background |
| `blur-light-50`, `blur-dark-100`, `blur-default-20` | `BlurView` with that tint and intensity. Android: `blurMethod="dimezisBlurView"`. | Background |
| `blur-none-light-50` (Android) | `BlurView` with the default `blurMethod` | Background |
| `rn-filter-blur` (Android, web) | View with the React Native style `filter: blur(6)` and its own copy of the image | Background |
| `glass-regular`, `glass-clear` (iOS only for `clear`) | `GlassView` | Background |
| `fg-blur-light-50`, `fg-glass-regular` | The foreground is a container that holds the effect panel. The label is a child of the panel. | Foreground |

Sample points, in capture-root units. No point is below the label.

| Point | Position | Purpose |
| --- | --- | --- |
| `flat-white`, `flat-black`, `flat-orange`, `flat-blue` | (45, 45), (135, 45), (45, 135), (135, 135) | Center of a quadrant, 45 units from each color edge |
| `edge` | (86, 45) | 4 units from the white and black boundary. A blur mixes the two colors. |
| `outside` | (8, 8) | Not below the panel (role 3) |

Variants of each sample:

- `raw`: debug mode `skipEffectCheck`. This is the behavior before step 2.
- `normal`: the default path after step 2.
- `inner`: foreground roots only. The caller passes the label in the panel as the foreground.
- `dhRootFalse`, `dhRootTrue`, `dhWindowFalse`, `dhWindowTrue` (iOS) and `pixelCopy` (Android): experimental compositor modes.

Ground truth: the host takes a screenshot while the page is static (`xcrun simctl io <udid> screenshot`, `adb exec-out screencap -p`, Playwright `page.screenshot`).
`docs/spike/tools/fx-compare.mjs` reads the screenshot at the physical pixel of each sample.
The screen value is the mean of a 3 x 3 pixel area. The tool also reports the channel range of a 7 x 7 area.
"Difference" is the largest RGB channel difference between the sample and the screen value.

Method check: on the `control` root the sample, the screenshot, and the calculated value agree with a difference of 0 on each platform.
The iOS screenshots have the sRGB profile.

Limits of the method:

- A blurred area is not fully flat. The 7 x 7 range was 0 to 5 on iOS and 0 to 28 in Chromium at the `edge` point.
- The Dimezis blur on Android has noise. The 7 x 7 range was 5 to 29. A difference below approximately 10 is not significant there.
- The WebKit screenshot showed no blur at the `edge` point. This report does not use WebKit as ground truth.
- On the iOS simulators, `blur-light-50` and `blur-default-20` gave the same screen values. The cause was not examined.

## Results: iOS 26.5 simulator

The full table is in `evidence/fx-ios-26.5-iphone17-simulator.txt`. Values are 8-bit RGB.

### Role 1: effect as background

| Effect | Point | Screen | Sampled before step 2 (`raw`) | Difference | After step 2 (`normal`) |
| --- | --- | --- | --- | --- | --- |
| `control` | `flat-orange` | 127, 74, 0 | 127, 74, 0 | 0 | 127, 74, 0 (pass) |
| `blur-light-50` | `flat-black` | 91, 90, 112 | 77, 77, 77 | 34.8 | `UNSUPPORTED_CONTENT` |
| `blur-light-50` | `flat-orange` | 255, 172, 77 | 255, 181, 77 | 9 | `UNSUPPORTED_CONTENT` |
| `blur-light-50` | `edge` | 177, 171, 174 | 255, 255, 255 | 84.4 | `UNSUPPORTED_CONTENT` |
| `blur-dark-100` | `flat-white` | 89, 88, 88 | 89, 89, 89 | 1.4 | `UNSUPPORTED_CONTENT` |
| `blur-dark-100` | `edge` | 60, 60, 60 | 89, 89, 89 | 29 | `UNSUPPORTED_CONTENT` |
| `glass-regular` | `flat-white` | 253, 245, 245 | 255, 255, 255 | 10 | `UNSUPPORTED_CONTENT` |
| `glass-regular` | `flat-black` | 181, 179, 180 | 0, 0, 0 | 181 | `UNSUPPORTED_CONTENT` |
| `glass-regular` | `flat-orange` | 255, 222, 158 | 255, 149, 0 | 157.9 | `UNSUPPORTED_CONTENT` |
| `glass-regular` | `flat-blue` | 177, 175, 255 | 0, 0, 255 | 177 | `UNSUPPORTED_CONTENT` |
| `glass-clear` | `flat-black` | 19, 19, 19 | 0, 0, 0 | 19 | `UNSUPPORTED_CONTENT` |
| `glass-clear` | `flat-orange` | 255, 174, 21 | 255, 149, 0 | 25 | `UNSUPPORTED_CONTENT` |

Observed behavior of `layer.render(in:)`:

- Blur: the render draws the tint layer of the effect and no blur. The sample is the image color with the tint.
- Liquid Glass: the render draws nothing for the effect. The sample is the image color.
- The error is silent. With `glass-regular` on black the sample is black and the selected foreground is white.
  The screen shows 181, 179, 180, where black has the larger contrast ratio (approximately 10 against 2). The selection is wrong.

### Role 2: effect as foreground

| Root | Foreground reference | Point | Screen | Sampled (`normal`) | Difference |
| --- | --- | --- | --- | --- | --- |
| `fg-blur-light-50` | Container of the panel | `flat-black` | 91, 89, 112 | 0, 0, 0 (pass: image pixel) | 111.6 |
| `fg-blur-light-50` | Container of the panel | `edge` | 177, 171, 174 | 255, 255, 255 (pass: image pixel) | 84.1 |
| `fg-glass-regular` | Container of the panel | `flat-black` | 180, 179, 181 | 0, 0, 0 (pass: image pixel) | 181 |
| `fg-glass-regular` | Container of the panel | `flat-orange` | 255, 220, 164 | 255, 149, 0 (pass: image pixel) | 164 |
| `fg-blur-light-50`, `fg-glass-regular` | Label in the panel (`inner`) | Each point below the panel | as above | `UNSUPPORTED_CONTENT` | - |

"Pass" means that the sample agrees with the known image pixel. It does not agree with the screen.

### Role 3: effect not below the sample point

The `outside` point gave 255, 255, 255 on each root, in each variant. The screen shows 255, 255, 255. No sample was rejected.

### iOS 18.4 simulator

- Blur: the same values as iOS 26.5 within 1. Refer to `evidence/fx-ios-18.4-iphone16-simulator.txt`.
- `GlassView`: no effect. The sample, the screen, and the image pixel agree with a difference of 0. No sample is rejected.

## Results: Android 15 emulator

The full table is in `evidence/fx-android-15-api35-emulator.txt`.

| Effect | Point | Screen | Sampled before step 2 (`raw`) | Difference | After step 2 (`normal`) |
| --- | --- | --- | --- | --- | --- |
| `control` | `flat-orange` | 127, 74, 0 | 127, 74, 0 | 0 | 127, 74, 0 (pass) |
| `blur-light-50` (Dimezis) | `flat-orange` | 245, 185, 101 | 251, 194, 114 | 12.6 | `UNSUPPORTED_CONTENT` |
| `blur-light-50` (Dimezis) | `edge` | 194, 194, 194 | 212, 212, 212 | 17.7 | `UNSUPPORTED_CONTENT` |
| `blur-default-20` (Dimezis) | `flat-orange` | 243, 154, 29 | 251, 166, 48 | 19 | `UNSUPPORTED_CONTENT` |
| `blur-default-20` (Dimezis) | `edge` | 200, 200, 200 | 237, 237, 237 | 36.8 | `UNSUPPORTED_CONTENT` |
| `rn-filter-blur` | `flat-orange` | 255, 149, 0 | 255, 149, 0 | 0 | `UNSUPPORTED_CONTENT` |
| `rn-filter-blur` | `edge` | 190, 190, 190 | 255, 255, 255 | 65.3 | `UNSUPPORTED_CONTENT` |
| `blur-none-light-50` | `flat-orange` | 253, 188, 97 | 253, 188, 97 | 0 | 253, 188, 97 (not rejected) |
| `glass-regular` (plain view) | `flat-orange` | 255, 149, 0 | 255, 149, 0 | 0 | 255, 149, 0 (pass) |

- The software draw (`View.draw` on a bitmap canvas) does not apply a `RenderEffect`. The `rn-filter-blur` sample at `edge` is the color with no blur.
- The software draw of the Dimezis `BlurView` gave a color near the screen color, but not in the tolerance.
- Role 2 (`fg-blur-light-50`, container as foreground): `flat-black` gave 0, 0, 0 and the screen shows 103, 103, 103 (difference 102.8). The label as foreground gave `UNSUPPORTED_CONTENT`.
- Role 3: the `outside` point gave 255, 255, 255 on each root. No sample was rejected.

## Results: web (Chromium 156, headless)

The full table is in `evidence/fx-web-chromium-2.txt`.

| Effect | Point | Screen | Sampled before step 2 (`raw`) | Difference | After step 2 (`normal`) |
| --- | --- | --- | --- | --- | --- |
| `control` | `flat-orange` | 127, 74, 0 | 127, 74, 0 | 0 | 127, 74, 0 (pass) |
| `blur-light-50` (`backdrop-filter`) | `flat-orange` | 253, 183, 97 | 253, 188, 97 | 5 | `UNSUPPORTED_CONTENT` |
| `blur-light-50` (`backdrop-filter`) | `edge` | 197, 197, 197 | 253, 253, 253 | 55.7 | `UNSUPPORTED_CONTENT` |
| `blur-dark-100` (`backdrop-filter`) | `edge` | 52, 52, 52 | 76, 76, 76 | 23.7 | `UNSUPPORTED_CONTENT` |
| `blur-default-20` (`backdrop-filter`) | `edge` | 215, 215, 215 | 255, 255, 255 | 40 | `UNSUPPORTED_CONTENT` |
| `rn-filter-blur` (`filter: blur(6px)`) | `edge` | 187, 187, 187 | 187, 187, 187 | 0 | `UNSUPPORTED_CONTENT` |
| `glass-regular` (plain view) | `flat-orange` | 255, 149, 0 | 255, 149, 0 | 0 | 255, 149, 0 (pass) |

- `html2canvas-pro` draws the background color of the `BlurView` and no `backdrop-filter`.
- `html2canvas-pro` drew `filter: blur(6px)` with a difference of 0 at the six points. The rejection of `filter` is conservative. Six points are not sufficient evidence to support it.
- Role 2 (`fg-blur-light-50`, container as foreground): `flat-black` gave 0, 0, 0 and the screen shows 97, 97, 97. The label as foreground gave `UNSUPPORTED_CONTENT`.
- Role 3: the `outside` point gave 255, 255, 255 on each root. No sample was rejected.

## What role 2 implies for the API

The caller selects the reference. The two selections give different results:

| The caller passes | Result in v1 | Meaning |
| --- | --- | --- |
| The glass or blur container | A sample of the content below the container | Correct for the contract. It is not the color that the screen shows below the label. |
| The label in the container | `UNSUPPORTED_CONTENT` | The effect stays in the capture and covers the point. |

Thus v1 gives no screen-accurate value for a label on blur or on Liquid Glass.
A caller that passes the container must know that the effect changes the visible color (difference up to 181 in this fixture).

## Detection reliability

| Platform | Rule | Reliability |
| --- | --- | --- |
| iOS | A `UIVisualEffectView` with a non-empty `effect` in the root subtree (root included), outside the foreground subtree, whose bounds contain the sample point. Hidden views are ignored. | Reliable for UIKit effect views. Observed: `BlurEffectView` with `UIBlurEffect`, `UIVisualEffectView` with `UIGlassEffect`. An effect view with no effect (iOS 18.4 `GlassView`) is not rejected. |
| iOS | Effects that are not a `UIVisualEffectView` (SwiftUI materials, custom layers) | Not detected. Not exercised. |
| Android | A view of class `eightbitlab.com.blurview.BlurView` whose controller is not the no-op controller (read through reflection) | Reliable for this library version. Observed: `RenderNodeBlurController` is rejected and the default `expo-blur` method is not rejected. |
| Android | A view with the React Native `filter` tag | Reliable for React Native 0.86.3. It rejects each filter type, not only blur. |
| Android | `View.setRenderEffect` from other code, other blur libraries, `SurfaceView` content | Not detected. `View` has no public read access to its `RenderEffect`. |
| Web | An element in the root (root included), outside the foreground, with a computed `backdrop-filter` or `filter` that is not `none`, whose rectangle contains the point | Reliable for computed styles. It does not examine pseudo-elements. |

Properties of the detection on each platform:

- It is geometric. It uses the rectangle of the effect view. It rejects also in a clipped corner, and when opaque content covers the effect.
- It does not reject a sample that the effect does not cover (role 3, observed on each platform).
- A glass shadow or a blur that extends outside the rectangle is not examined. At the `outside` point the screen and the sample agreed.

## Support evaluation

### iOS: `drawHierarchy(in:afterScreenUpdates:)` (measured)

The experimental modes hide the foreground layer, call `drawHierarchy` on the root or on the window, and restore the layer in the same main-queue block.
The modes are off by default. They exist in the spike module for this measurement only.

| Mode | Foreground in the capture | Flash on screen (frames with no foreground) | Blur: largest difference to the screen | Liquid Glass: largest difference to the screen | Latency p50 / p95 |
| --- | --- | --- | --- | --- | --- |
| Default `layer.render(in:)` | No | None (979 of 979 frames show the foreground, iOS 18.4 and iOS 26.5) | 84.4 (silent before step 2) | 181 (silent before step 2) | 0.31 / 0.52 ms (18.4), 0.36 / 0.81 ms (26.5) |
| Root, `afterScreenUpdates: false` | Yes (2674 of 2674 and 3891 of 3891 samples were the foreground color) | None (358 and 361 frames) | 3.1 | 55 (`regular` on orange). 5 on white, black, blue. 14 at `edge`. 1 for `clear`. | 1.2 / 3.7 ms (18.4), 1.6 / 3.2 ms (26.5) |
| Root, `afterScreenUpdates: true` | No | **Yes: 467 of 911 frames (18.4), 524 of 867 frames (26.5)** | 3.1 | Same as above | 9.0 / 17.0 ms (18.4), 12.2 / 19.7 ms (26.5) |
| Window, `afterScreenUpdates: false` | Yes (971 of 971 and 1782 of 1782) | None (358 and 359 frames) | 0.6 | Same as above | 3.6 / 5.4 ms (18.4), 4.7 / 6.6 ms (26.5) |
| Window, `afterScreenUpdates: true` | No | **Yes: 420 of 911 frames (18.4), 510 of 869 frames (26.5)** | 0.6 | Same as above | 11.4 / 19.0 ms (18.4), 15.5 / 24.5 ms (26.5) |

Latency: 30 samples for each mode on `blur-light-50`, debug build, simulator. The flash data comes from a 5 second loop and `tools/flash-check.mjs`.

Conclusions from the measurement:

- `afterScreenUpdates: true` excludes the foreground from the capture, and the foreground disappears on screen. It fails the no-flash rule.
- `afterScreenUpdates: false` shows no flash, and it does not exclude the foreground. It reads the last committed frame.
- Thus no `drawHierarchy` mode satisfies exclusion and no-flash together.
- A window snapshot with `afterScreenUpdates: false` agreed with the screen for blur (difference 0.6 or less).
- No mode agreed with the screen for Liquid Glass `regular` (difference up to 55 on the simulator).
- Private APIs were not used and were not evaluated.

### Android: `PixelCopy` of the window (measured briefly, and documented behavior)

- Measured: `PixelCopy.request(window, ...)` for one pixel gave the foreground color at a point below the foreground (255, 0, 255). It does not exclude the foreground.
- Measured: at points that the label does not cover, `PixelCopy` agreed with the screenshot for `rn-filter-blur` at `edge` (difference 0.3). For the Dimezis blur the difference was 0.4 to 10.1, in the noise of that blur.
- Measured: latency p50 0.87 ms, p95 6.8 ms (30 samples, emulator, during a screen record).
- Documented behavior, not measured: `PixelCopy` copies the last frame that the window surface composited. To exclude the foreground, the application must draw a frame with no foreground. That frame is visible. Thus an exclusion fails the no-flash rule.

### Web

No compositor read is available to page script. The evaluation was not continued.

## Options for the owner

| Option | What the caller gets | Cost and risk |
| --- | --- | --- |
| A. Reject (implemented, the minimum outcome) | `UNSUPPORTED_CONTENT` with the effect name when a detected effect covers the point. Correct samples away from the effect. | No screen value for a label on blur or glass. Conservative: it rejects also when opaque content covers the effect. Effects that the detection cannot find stay silent (list above). |
| B. Opt-in compositor sample with no exclusion (iOS window snapshot `afterScreenUpdates: false`, Android `PixelCopy`) | The last displayed frame at the point, with blur. The adapter rejects if the point is in the foreground frame. The caller supplies a point next to the label. | Not a sample "below" the foreground. Latency 3.6 to 6.6 ms on the iOS simulators against 0.3 to 0.8 ms. It reads the last committed frame, thus a refresh must wait for one frame. Liquid Glass `regular` differed from the screen by up to 55 on the simulator. Needs physical-device data. Not built as a product path. |
| C. Compositor sample with exclusion (`afterScreenUpdates: true`, or a drawn frame with no foreground) | The screen color below the foreground | Fails the contract: the foreground disappears in 46% to 60% of the recorded frames. Not recommended. |
| D. Controlled component for effect content | A component that owns the background and the foreground declares its material | Not assessed. A later feature with its own contract. |

Decision (owner, 8 October 2026): option A applies to Contract v1.

Recommendation: keep option A for Contract v1.
Evaluate option B on physical devices before a decision, because the glass values and the latency come from simulators.
Do not select option C.

## Not done and not verified

- Physical devices. Liquid Glass on a device, "Reduce Transparency", and dark appearance.
- Liquid Glass interactive mode, `GlassContainer`, tint colors, and glass in system bars.
- Other blur libraries, SwiftUI materials, Android `RenderEffect` from application code, and `SurfaceView` content.
- Firefox. WebKit ground truth.
- Occlusion of an effect by opaque content (the detection rejects; a test case does not exist).
- Blur tints and intensities other than the three in the fixture.
