# Open decisions and blockers

The source is [HANDOFF.md](HANDOFF.md).
No decision in this file is made. The scaffold does not select an answer for any of them.
The delivery steps are those in the handoff section "Delivery sequence".

## Blocker

The sampling spike (step 1) is complete on two iOS simulators, one Android emulator, and headless browsers.
A native sampler passed capture, foreground exclusion, composition, and point mapping there.
No physical device is tested. The web adapter is not stable in WebKit.
The report is in [spike/README.md](spike/README.md).

## Decisions

| # | Decision | Notes | Owner | Resolved in |
| --- | --- | --- | --- | --- |
| 1 | Capture backend | Compare existing primitives, for example `react-native-view-shot`, with custom native capture. | open | Step 1 |
| 2 | Native exclusion strategy | A React state change to `opacity: 0` is not accepted as safe. A platform-side capture transaction is one alternative. | open | Step 1 |
| 3 | Ancestor and backdrop boundary | Define which effects outside the `captureRoot` the capture includes, rejects, or lists as unsupported. | open | Step 1 |
| 4 | Web backend and web subset | Define the supported DOM, CSS, and image content. Web can start as experimental. | open | Step 1 |
| 5 | Generic sampler or controlled component | If a generic sampler cannot satisfy the contract, propose a controlled component with a smaller stated scope. | open | Step 1 |
| 6 | Native module framework | Expo Modules API or TurboModule. Record the installation complexity and the maintenance cost. | open | Step 1 (recommendation), step 3 (final) |
| 7 | Expo Go compatibility | Promise Expo Go only if the full selected path works with its included modules. | open | Step 1 |
| 8 | Raster rounding rule | Same rule on all adapters. | open | Step 2 |
| 9 | Sampling footprint | Same rule on all adapters. | open | Step 2 |
| 10 | Raster tolerance | Tolerance for the fixture comparison in the acceptance matrix. | open | Step 2 |
| 11 | Supported transforms | Unsupported mappings must fail explicitly. | open | Step 2 |
| 12 | Final API names | `sampleContrast` and the type names are proposals. | open | Step 2 |
| 13 | Error semantics | Includes the code for an invalid `backdrop` string and the opaque threshold. | open | Step 2 |
| 14 | `CaptureAdapter` interface | `src/adapters/types.ts` is provisional. | open | Step 2 (draft), step 3 (final) |
| 15 | Hook and convenience component API | Add them only after the low-level API works. | open | Step 4 |
| 16 | Performance budget | Set a budget from measurements on named hardware. | open | Step 1 (measurements), step 3 (budget) |
| 17 | Minimum supported versions | React Native, Expo SDK, iOS, Android, browsers, Node.js. Validate the current versions again at that time. | open | Step 5 |
| 18 | Repository name | The GitHub repository under Charlisim does not exist. | open | Step 5 |
| 19 | npm package name, scope, and owner access | `palette-react-native` is a placeholder. `"private": true` prevents an accidental publish. | open | Step 5 |
| 20 | Build output and package exports | `main` and `types` point at `src/index.ts`. No build tool is selected. | open | Step 5 |
| 21 | Release process | No release workflow exists. Trusted publishing with provenance is preferred where available. | open | Step 5 |

## Spike inputs (step 1)

These rows are inputs from the spike evidence. They are not locked decisions.
The numbers refer to the table above. The evidence is in [spike/README.md](spike/README.md).

| # | Spike input |
| --- | --- |
| 1 | Use a custom native module that renders one pixel in one UI-thread transaction. `react-native-view-shot` with a JS exclusion failed the contract. |
| 2 | iOS: set `layer.isHidden` in a `CATransaction` and render in the same main-queue block. Android: set `transitionAlpha` to 0 and draw in the same UI-thread message. No recorded frame lost the foreground. |
| 3 | The capture is a subtree render. The opacity of the capture root is in the sample on iOS and web, and not on Android. Step 2 must select one rule. Ancestor effects are not in the sample. |
| 4 | `html2canvas-pro` with `ignoreElements` passed in Chromium. It gave intermittent wrong samples in WebKit. Firefox was not executed. Treat web as experimental. The subset is: translation only, same-origin images. |
| 5 | The generic sampler satisfied the contract for the tested content. A controlled component is a fallback for content that the render cannot draw. |
| 6 | The spike used Expo Modules API as a convenience. It did not build a TurboModule. Refer to the trade-off in the report. |
| 7 | Do not promise Expo Go. The recommended backend has custom native code. The Expo Go path (`react-native-view-shot`) failed the contract. |
| 8 | `pixel = floor(logical * scale)` on the mapped capture-root point worked on the three adapters. |
| 9 | One physical pixel worked for flat fixtures. Region sampling is not assessed. |
| 10 | The maximum observed difference was 0.5 for each 8-bit channel. A tolerance of 1 is sufficient for the fixtures. |
| 11 | Translate, scale, and rotate passed on iOS and Android. Web supports translate only. Perspective is rejected, but that path was not exercised. |
| 14 | The provisional `CaptureAdapter` interface was sufficient. The spike did not change it. |
| 16 | Simulator and emulator measurements are in the report. No physical-device measurement exists. |

Other inputs:

- Each reference must have a native view. React Native can flatten a view that has no paint. `collapsable={false}` prevents that.
- The capture excludes only the requested foreground. A different foreground at the sample point is background content.

## Scaffold choices to confirm

These choices exist only so that the shared core compiles and has tests. Step 2 can change each of them.

| Choice | Current value |
| --- | --- |
| `Foreground` type | `'black' \| 'white'` |
| `backdrop` input | `#rrggbb` string only |
| Opaque test | Alpha is exactly 1 |
| Tie rule | Black |
| Linearization threshold | 0.03928 (WCAG 2.x text) |
| Invalid `backdrop` string | `UNRESOLVED_BACKDROP` |
| Invalid color from an adapter | `CAPTURE_FAILED` |
| View reference type | Local structural type `{ readonly current: unknown }` |
| Signal type | Local structural subset of `AbortSignal` |

Do not block the spike on names or on publication.
