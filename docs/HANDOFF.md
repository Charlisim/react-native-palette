# Palette for React Native — implementation handoff

Date: 7 October 2026. Audience: the engineer or team implementing the new library.

## Goal and scope

Build a React Native library that chooses an opaque black or white foreground by **sampling the rendered background underneath a foreground element**. The value is reading what is actually behind the element: an image, a gradient, translucent layers, or a transparent container over another painted surface.

The caller should not have to identify the dominant color of an image or manually reduce a view hierarchy to a `backgroundColor` string. The library must return the sampled background and its contrast decision, so applications can assign the foreground and inspect the result.

The intended project is a separate GitHub repository under **Charlisim**, with an npm package, English public documentation, an example application, automated verification, and a release workflow. iOS and Android are required targets. Web is desired, with its supported rendering subset stated explicitly. Expo compatibility matters; Expo Go compatibility must not be assumed.

The current request is to prepare this handoff. No React Native repository, implementation, or npm publication has been created.

## Confirmed intent and recommendation

Carlos identified rendered-background sampling as the distinguishing feature of his original library. A wrapper that accepts a known color and returns black or white does not satisfy this project.

Existing color utilities should be reused where useful. Earlier research recommended reuse for **known solid colors**; that recommendation does not cover this clarified sampling requirement. Image palette extraction also does not meet it: a photo's dominant color may be unrelated to the pixels directly underneath a label.

Recommended MVP: a low-level asynchronous sampling API plus shared TypeScript contrast logic. Prove capture, foreground exclusion, transparency, and coordinate mapping before adding a hook or component. Prefer a small implementation with explicit platform adapters; a large theming system or domain architecture would add little value here.

The contracts below are proposed implementation requirements. API names and capture backends remain recommendations rather than approved implementation decisions.

## Reference implementation and current evidence

- Original project: [Charlisim/Palette-iOS](https://github.com/Charlisim/Palette-iOS).
- Modernization: [PR #3](https://github.com/Charlisim/Palette-iOS/pull/3), now merged. Its `verify` CI job passed for head commit `863b4ad8ca8729bf6237f2f8d0ac45dac5477b64`.
- Reference code: [Palette.swift](https://github.com/Charlisim/Palette-iOS/blob/863b4ad8ca8729bf6237f2f8d0ac45dac5477b64/Palette/Palette.swift), [UIView pixel sampler](https://github.com/Charlisim/Palette-iOS/blob/863b4ad8ca8729bf6237f2f8d0ac45dac5477b64/Palette/UIView%2BColorAtPoint.swift), and [tests](https://github.com/Charlisim/Palette-iOS/blob/863b4ad8ca8729bf6237f2f8d0ac45dac5477b64/PaletteTests/PaletteTests.swift).
- The Swift library converts foreground coordinates into background coordinates, temporarily excludes the foreground layer, samples initialized sRGB pixel storage, restores visibility, and selects the greater WCAG black/white contrast ratio.
- Local validation of the multicolor follow-up: 22 tests / 38 executions on iOS 27, plus Swift and Objective-C builds and real simulator captures. Earlier modernization validation also covered Swift 6.3.3 and 6.4.
- The reference implementation composites residual sample transparency over the resolved system background. It does **not** establish that every real ancestor backdrop is captured. The new library must specify that boundary rather than inherit an implicit system-color assumption.
- No React Native sampling backend has been validated. The earlier 12-case TinyColor experiment validated JavaScript contrast and explicit alpha composition only.

## Required sampling contract

### 1. Capture scope and actual backdrop

Require an explicit `captureRoot` containing the relevant painted background and the foreground. Both references must be mounted in the same supported view hierarchy and rendering surface. A transparent immediate parent is insufficient if the image or solid surface behind it lies outside the captured subtree.

The developer selects the smallest ancestor that contains the necessary background layers. The library samples their rendered composition, not their declared styles. The capture root's own opacity or transforms and ancestor effects outside that root must either be included by the adapter or rejected/documented as unsupported; ordinary subtree capture must not be marketed as the final screen compositor.

If the captured pixel remains translucent, resolve it only against an explicitly supplied **opaque sRGB backdrop**. If none is available, report `UNRESOLVED_BACKDROP`; do not silently assume white, black, or the device theme. An explicit backdrop is a caller-provided boundary value, not a claim that the library discovered outside pixels.

Example: a transparent card over a photograph must be captured with a root containing the photograph. A 50%-black overlay over that photograph must influence the sample. A view with no own background must still produce the correct choice when the painted backdrop is within the capture root.

### 2. Foreground exclusion and restoration

Exclude the entire foreground subtree from the capture. Sampling the text's own pixels would create a feedback loop and is incorrect. Retain other background content in its original paint order.

Exclusion must preserve layout, transforms, opacity, visibility, accessibility, hit testing, and sibling order. Restore state after success, errors, cancellation, and unmounting. A visible flash, collapsed row, or disappearing label is a failure.

Do not assume that setting React state to `opacity: 0`, awaiting a screenshot, and restoring it is safe: that can span rendered frames. Native exclusion may need a platform-side capture transaction. A separate background-only layer is an alternative for a controlled component, but must not be presented as support for arbitrary existing view trees without proving equivalent composition.

### 3. Position and pixel representation

Recommend the foreground's local top-left bounds point as the default, matching the Swift API. Permit an explicit local point for other anchors. This point is not necessarily the first painted glyph.

Map that point through nested offsets, scroll position, supported transforms, and capture-root coordinates. Keep logical layout units separate from physical bitmap pixels. Define raster rounding and the sampling footprint; use the same documented rule on all adapters. Reject non-finite coordinates, empty bounds, detached references, and points outside the supported captured area.

Decode into normalized sRGB RGBA. Identify channel order, premultiplied alpha, color-space conversion, and actual bitmap scale before reading a pixel. Preserve transparency until backdrop resolution. Do not replace missing or unsupported content with an unexplained black sample. If an adapter cannot reliably detect an unsupported renderer, restrict its advertised supported content rather than promise universal detection.

### 4. Contrast selection

After resolving an opaque sRGB background, compute WCAG relative luminance using linearized channels and select the larger contrast ratio against opaque black and white. Specify deterministic ties, preferably black to match the Swift reference.

Return the selected foreground and ratio alongside the sampled/resolved background. Keep the contrast calculation independent of React and native capture. TinyColor or an equivalent existing utility can supply this calculation; verify its alpha behavior and accepted inputs rather than duplicating an entire color parser.

A single-point result describes that sample only. It does not certify contrast across a photograph, gradient, or the full text region. Region sampling, minimum contrast across an area, scrims, and custom foreground palettes are later features requiring separate contracts.

### 5. Readiness and asynchronous behavior

Capture after non-zero layout and relevant image loading have completed. `onLayout` alone does not establish image readiness. Provide explicit refresh/invalidation for changes in background content, image source, crop/resize mode, dimensions, scroll position, or appearance.

Start with explicit refresh; do not continuously screenshot every render or frame. A later hook should coalesce refreshes, discard stale completions, and expose pending/error states. Do not invent automatic detection of every native visual change.

Resolve or reject every request. Cancellation and unmounting must release resources and prevent stale foreground application. If cancellation cannot stop an in-flight native capture, suppress its result and finish cleanup. Keep image decoding and expensive work off the JS/UI hot path where the platform allows it.

## Proposed API shape

Illustrative contract, not implementation-ready bindings:

```ts
const result = await sampleContrast({
  captureRoot: screenBackgroundRef,
  foreground: titleRef,
  point: { x: 0, y: 0 }, // foreground-local logical units
  // backdrop: '#ffffff', // only for residual transparency; must be opaque
  signal,
});

// The application applies this to its Text, icon, or other foreground.
setForegroundColor(result.foreground);
```

A successful result should contain `sampledRGBA`, `resolvedRGBA`, `foreground`, `contrastRatio`, the sampled position in capture coordinates, and an indication that the result applies to a point. Do not expose full bitmap data by default.

Use structured errors such as `NOT_READY`, `INVALID_VIEW_RELATIONSHIP`, `INVALID_POINT`, `UNRESOLVED_BACKDROP`, `UNSUPPORTED_CONTENT`, `CAPTURE_FAILED`, and `ABORTED`. Preserve the underlying cause where useful. A convenience component may use an explicit fallback color, but must expose the failure; returning fallback as if it were a successful sample is incorrect.

## Platform architecture and trade-offs

Use a shared TypeScript core for RGBA normalization, backdrop composition, luminance, contrast choice, public types, and request state. Keep capture/measurement/decoding behind small iOS, Android, and web adapters. Native operations touching views must use the appropriate UI thread; bitmap ownership and cleanup belong to the adapter.

Evaluate existing primitives before implementing custom native capture. [Expo documents react-native-view-shot](https://docs.expo.dev/versions/latest/sdk/captureRef/) as a capture library included in Expo Go. Its documentation explains logical versus physical pixel sizing. This establishes a useful primitive, not proof of the exclusion and backdrop contract required here.

The [view-shot README](https://github.com/gre/react-native-view-shot) documents platform differences, unsupported special renderers, and web capture through `html2canvas-pro`. A capture can also be blank without rejecting. Thus capturing and decoding an image is not sufficient evidence that the background was represented correctly.

| Target | Required proof | Packaging implication |
| --- | --- | --- |
| iOS | Static UIView/RN views and images, clipping/transforms, alpha composition, foreground exclusion without visible changes | Reuse or extend a capture backend only after verification; Swift reference is useful but not a universal screenshot backend. |
| Android | Equivalent visible composition, density/channel mapping, scroll offsets, restoration, and documented surface restrictions | Validate the current RN architecture and view resolution; test optimized/collapsible view trees. |
| Web | Supported DOM/CSS/image rendering, point mapping, exclusion without live DOM mutation, readable canvas pixels | Keep browser imports separate and SSR-safe. Document cross-origin image and canvas restrictions and unsupported CSS. |
| Expo | Installation and execution on the chosen SDK and runtime | Custom native code requires a development build. Promise Expo Go only if the complete selected path works with its included modules. |

A DOM renderer is not an exact browser screenshot. [html2canvas documents that it reconstructs supported DOM/CSS and that cross-origin content can prevent pixel reads](https://html2canvas.hertzen.com/documentation). Validate the specific selected web backend separately. Do not bypass browser restrictions or silently substitute a solid color when an image cannot be sampled.

For an Expo-first custom module, evaluate [Expo Modules API](https://docs.expo.dev/modules/overview/). A TurboModule is an alternative if plain RN integration without the Expo modules runtime is a priority. Choose after the sampling spike, with installation complexity and maintenance cost recorded. Do not select a native framework merely to perform the shared color math.

Web may launch as experimental if parity is incomplete; label that explicitly. Video, live camera, GPU surfaces, blur/material effects, arbitrary portals, animated presentation-state capture, and unrelated external windows are outside the initial guaranteed subset.

## Acceptance and evidence matrix

Use deterministic image fixtures and pixel expectations, not just visually plausible foreground labels. Test the sampling result and rendered foreground assignment separately.

| Scenario | Required result |
| --- | --- |
| Opaque sRGB fixtures: red `#ff0000`, orange `#ff9500`, yellow `#ffff00`, green `#00ff00`, cyan `#00ffff` | Actual sampled background and black foreground; match known RGBA within a stated raster tolerance. |
| Opaque sRGB fixtures: blue `#0000ff` and purple `#800080` | Actual sampled background and white foreground. |
| Image with separate light/dark areas | Moving the foreground between areas changes the selected foreground; an unrelated dominant image color does not determine the result. |
| Cropped/scaled image (`cover` and `contain`) | Sampling follows displayed crop, scale, and any letterboxing/background, not source-image coordinates alone. |
| Transparent child over an image inside capture root | Image pixels determine the result even when the child's declared background is absent or transparent. |
| Translucent overlay over the same image | Sample matches the composited visible color; foreground changes when that composition crosses the contrast boundary. |
| Residual transparent root | Explicit opaque backdrop resolves it; absence produces `UNRESOLVED_BACKDROP`. |
| Foreground text, opaque foreground panel, and foreground descendants | None contaminates the sample; layout and original state survive capture. |
| Nested layout, scrolling, high density, supported transforms and clipping | The correct physical pixel is sampled; unsupported mappings fail explicitly. |
| Theme, image-load and background changes | Refresh gives the new result; older asynchronous captures cannot overwrite it. |
| Failure, cancellation, unmount, repeated captures | No stuck hidden views, hanging requests, retained bitmaps or capture-file accumulation. |
| Web image/canvas access restriction or unsupported renderer | Explicit limitation/error; no fabricated success. |

Run shared unit tests and real platform integration tests. Validate iOS and Android separately; simulators/emulators do not establish physical-device behavior. Validate the supported web subset in at least two browser engines before advertising general web support. Run cancellation, restoration and resource tests under repeated refreshes.

Profile a bounded fixture on named hardware: capture dimensions, pixel density, p50/p95 end-to-end latency, UI/JS blocking, and memory growth. Set a concrete performance budget after the spike. Reading one pixel does not imply the backend only renders or allocates one pixel.

## Delivery sequence

1. **Sampling spike.** Build one image + transparent overlay + movable foreground fixture. Prove point mapping, exclusion, composition, and restoration on iOS and Android; assess web. Compare backend alternatives and record supported content and runtime constraints.
2. **Contract and shared core.** Lock coordinate/footprint/alpha/error semantics and test known colors, transparency, invalid inputs, and deterministic ties.
3. **Platform adapters.** Implement the smallest verified capture/measurement/decoding path. Add integration tests for the acceptance matrix and resource cleanup.
4. **Convenience API and demo.** Add a hook only after the low-level API works. The example must demonstrate images, transparency, gradients, moving samples, recomputation and visible errors, alongside solid colors. Add real platform screenshots to the English README.
5. **Package and release.** Create the separate Charlisim repository, confirm npm package name/scope availability and owner access, ship TypeScript declarations and Metro/web-compatible exports, and provide an Expo example and explicit platform/runtime support matrix. Verify an npm tarball in a clean consumer app; do not validate only workspace source imports. Configure CI and a repeatable npm release process, ideally trusted publishing/provenance where available. Preserve the original MIT attribution where original code is reused.

Revalidate current RN, Expo, OS and dependency versions at implementation time. Do not hard-code the research snapshot as a permanent compatibility promise. README and npm metadata must distinguish implemented/verified support from experimental or planned support.

## Open decisions and blockers

There is no validated cross-platform sampler yet. Resolve the capture backend, native exclusion strategy, actual ancestor/backdrop boundary, and web subset in the spike. Repository/package names, npm scope/access, minimum supported versions, and benchmark budgets remain open.

Do not block the spike on naming or publishing. If a generic arbitrary-view sampler cannot satisfy the restoration/composition contract, propose a controlled background/foreground component with its narrower scope stated explicitly; do not quietly weaken the contract.

## Suggested Skills

When available to the implementing agent, use `carlos-mental-model` to trace the actual rendering pipeline, `react-native-build-debugger` for RN/Expo platform failures, and `code-review` before release. Use equivalent debugging/review workflows if those local skills are unavailable. No particular agent tool or private workspace is required to understand this handoff.

## Exact next action

Give the implementing engineer or agent this prompt:

> Read this handoff and the linked Palette-iOS source. Start with the sampling spike, not a color-only npm wrapper. Demonstrate an image-backed view with a transparent/translucent overlay and a movable foreground, sampling the actual rendered background while excluding that foreground. Verify iOS and Android, assess the web adapter, and return the observed RGBA/contrast results, foreground-restoration evidence, capture limitations, and the recommended backend. Resolve the public sampling contract before implementing and publishing the package.
