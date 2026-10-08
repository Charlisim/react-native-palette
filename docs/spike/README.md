# Sampling spike (delivery step 1)

**Status: not started.**
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

# Spike report (template)

Replace each `TBD`. Do not delete a section. Write `not assessed` when a section has no data.

## Environment

| Item | Value |
| --- | --- |
| Date | TBD |
| Author | TBD |
| React Native version | TBD |
| Expo SDK version | TBD |
| Runtime (development build or Expo Go) | TBD |
| Architecture (New Architecture on or off) | TBD |

## Fixture description

- Image source and dimensions: TBD
- Known pixel values and their positions: TBD
- Overlay color and alpha: TBD
- Foreground content and positions tested: TBD
- Capture root: TBD

## Backend alternatives compared

| Alternative | Exclusion method | Platforms | Works in Expo Go | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD | TBD |

## Observed RGBA and contrast results

One row for each sample. Add one table for each platform.

### iOS

Device and OS version: TBD. Physical device or simulator: TBD.

| Sample position | Expected RGBA | Sampled RGBA | Resolved RGBA | Foreground | Contrast ratio | Match |
| --- | --- | --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD | TBD | TBD |

### Android

Device and OS version: TBD. Physical device or emulator: TBD.

| Sample position | Expected RGBA | Sampled RGBA | Resolved RGBA | Foreground | Contrast ratio | Match |
| --- | --- | --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD | TBD | TBD |

### Web

Browser engines and versions: TBD.

| Sample position | Expected RGBA | Sampled RGBA | Resolved RGBA | Foreground | Contrast ratio | Match |
| --- | --- | --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD | TBD | TBD |

## Foreground-restoration evidence

| Check | iOS | Android | Web |
| --- | --- | --- | --- |
| No visible flash (frame capture or screen record) | TBD | TBD | TBD |
| Layout is the same before and after | TBD | TBD | TBD |
| Opacity, visibility, and transforms are the same | TBD | TBD | TBD |
| Accessibility and hit tests are the same | TBD | TBD | TBD |
| State is restored after an error | TBD | TBD | TBD |
| State is restored after cancellation | TBD | TBD | TBD |
| State is restored after unmount | TBD | TBD | TBD |

Evidence links: TBD

## Capture limitations

| Platform | Unsupported content | Detection (explicit error or silent) | Notes |
| --- | --- | --- | --- |
| iOS | TBD | TBD | TBD |
| Android | TBD | TBD | TBD |
| Web | TBD | TBD | TBD |

Effects outside the capture root (opacity, transforms, ancestor effects): TBD

## Recommended backend

- Recommendation: TBD
- Native module framework recommendation: TBD
- Installation complexity: TBD
- Maintenance cost: TBD
- Rejected alternatives and the reason for each: TBD
- Generic sampler or controlled component: TBD

## Performance measurements

| Platform | Device | Capture size (logical) | Density | p50 | p95 | UI block | JS block | Memory growth |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iOS | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Android | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Web | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

Number of captures for each measurement: TBD
Proposed performance budget: TBD

## Contract inputs for step 2

- Raster rounding rule: TBD
- Sampling footprint: TBD
- Raster tolerance: TBD
- Supported transforms: TBD
- Changes to the `CaptureAdapter` interface: TBD
