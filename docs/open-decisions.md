# Open decisions and blockers

The source is [HANDOFF.md](HANDOFF.md).
The delivery steps are those in the handoff section "Delivery sequence".
Delivery step 2 resolved the contract decisions. The locked contract is [sampling-contract.md](sampling-contract.md) (Contract v1).

## Blocker

No blocker stops step 3.
No physical device is tested. The web adapter is not stable in WebKit.
The native module framework (decision 6) is open. Compare the two frameworks before step 3 starts.

## Resolved decisions

| # | Decision | Resolution | Resolved in |
| --- | --- | --- | --- |
| 1 | Capture backend | A custom native module that renders one pixel in one UI-thread transaction. `react-native-view-shot` with a JS exclusion failed the contract. | Step 1 |
| 2 | Native exclusion strategy | iOS: `layer.isHidden` in one `CATransaction` in one main-queue block. Android: `transitionAlpha = 0` in one UI-thread message. | Step 1 |
| 3 | Ancestor and backdrop boundary | The sample describes the content inside the `captureRoot`. The opacity and the transforms of the root itself, and ancestor effects, are out of scope. The root opacity is not in the sample on the three platforms. | Step 2 (owner) |
| 5 | Generic sampler or controlled component | Generic sampler with a stated supported-content subset. A controlled component stays a possible later feature for content that the capture cannot render. | Step 1 |
| 7 | Expo Go compatibility | Not promised. The backend has custom native code. | Step 1 |
| 8 | Raster rounding rule | `pixel = floor(logical * scale)` on the mapped capture-root point. | Step 2 (owner) |
| 9 | Sampling footprint | Exactly one physical pixel. | Step 2 (owner) |
| 10 | Raster tolerance | +/-1 for each 8-bit channel. The suite uses 1. | Step 2 (owner) |
| 11 | Supported transforms | Translate, scale, rotate on iOS and Android. Translate only on web. Perspective gives `UNSUPPORTED_CONTENT`. | Step 2 (owner) |
| 13 | Error semantics | `INVALID_BACKDROP` for a backdrop that is not an opaque `#rrggbb` value. `UNRESOLVED_BACKDROP` only for a translucent sample and no backdrop. Opaque means alpha exactly 1. A tie selects black. | Step 2 (owner) |
| 22 | View flattening | `collapsable={false}` is required on the two references. `INVALID_VIEW_RELATIONSHIP` names it as the probable cause. | Step 2 (owner) |
| 23 | Blur, Liquid Glass, and filter content in v1 | Not supported. An adapter rejects with `UNSUPPORTED_CONTENT` when a detected effect covers the sample point. | Step 2 (owner selected option A of [spike/blur-and-glass.md](spike/blur-and-glass.md)) |

## Open decisions

| # | Decision | Notes | Owner | Resolve in |
| --- | --- | --- | --- | --- |
| 4 | Web backend and web subset | `html2canvas-pro` is the experimental candidate. Chromium passed. WebKit gave 2 wrong samples in 35 cases in each run. Firefox was not executed. The subset is: translation only, same-origin images, no `backdrop-filter`, no `filter`. | open | Step 3 |
| 6 | Native module framework | Open. Expo Modules API or TurboModule. Compare with a small TurboModule proof before step 3. The spike used Expo Modules API as a convenience only. | open | Before step 3 |
| 12 | Final API names | Contract v1 uses `sampleContrast`, `PaletteError`, and the type names in `src/types.ts`. The owner did not confirm the names explicitly. A rename needs a new contract version. | open | Step 3 |
| 14 | `CaptureAdapter` interface | `src/adapters/types.ts` was sufficient in step 1 and step 2. Step 3 makes it final. | open | Step 3 |
| 15 | Hook and convenience component API | Add them only after the low-level API works. | open | Step 4 |
| 16 | Performance budget | Simulator and emulator measurements exist. Set a budget from measurements on named hardware. | open | Step 3 |
| 17 | Minimum supported versions | React Native, Expo SDK, iOS, Android, browsers, Node.js. Validate the current versions again at that time. | open | Step 5 |
| 18 | Repository name | The GitHub repository under Charlisim does not exist. | open | Step 5 |
| 19 | npm package name, scope, and owner access | `palette-react-native` is a placeholder. `"private": true` prevents an accidental publish. | open | Step 5 |
| 20 | Build output and package exports | `main` and `types` point at `src/index.ts`. No build tool is selected. | open | Step 5 |
| 21 | Release process | No release workflow exists. Trusted publishing with provenance is preferred where available. | open | Step 5 |
| 24 | Opt-in compositor sample for blur and Liquid Glass (option B) | The owner selected option A for Contract v1. Option B stays a possible later feature. Measure it on physical devices before a decision. Options and measurements are in [spike/blur-and-glass.md](spike/blur-and-glass.md). | open | After v1 |
| 25 | Transform of the `captureRoot` itself | iOS and Android sample the root-local point. Web reports a `capturePoint` in screen-space units for scale and rotate. No rule is locked. | open | Step 3 |
| 26 | Replacement for `findNodeHandle` | The spike adapter reads the view tag with `findNodeHandle`. Step 3 must confirm the supported replacement. | open | Step 3 |

## Scaffold choices

These values are in the shared core. Contract v1 locks the first five rows.

| Choice | Value | State |
| --- | --- | --- |
| `Foreground` type | `'black' \| 'white'` | Locked in v1 |
| `backdrop` input | `#rrggbb` string only | Locked in v1 |
| Opaque test | Alpha is exactly 1 | Locked in v1 |
| Tie rule | Black | Locked in v1 |
| Invalid `backdrop` | `INVALID_BACKDROP` | Locked in v1 |
| Linearization threshold | 0.03928 (WCAG 2.x text). The sRGB standard uses 0.04045. No 8-bit channel value is between the two thresholds. | In v1. The owner did not confirm it explicitly. |
| Invalid sample from an adapter | `CAPTURE_FAILED` | In v1 |
| Absent or `null` reference, or the same view two times | `INVALID_VIEW_RELATIONSHIP` from the shared core, before the adapter call | In v1. Added in step 2. |
| Validation sequence | `point`, `backdrop`, references, `signal`, adapter | In v1. Added in step 2. |
| View reference type | Local structural type `{ readonly current: unknown }` | Open (decision 14) |
| Signal type | Local structural subset of `AbortSignal` | Open (decision 14) |

Do not block step 3 on names or on publication.
