# palette-react-native

A React Native library that samples the rendered background below a foreground element.
The library then selects an opaque black or white foreground from that sample.

The library reads the pixels that are behind the element: an image, a gradient, or translucent layers.
It is not a wrapper that accepts a known color and returns black or white.

The package name `palette-react-native` is a placeholder.

## Status: locked contract and shared core, no platform adapter

- The sampling contract is locked as Contract v1. Refer to [docs/sampling-contract.md](docs/sampling-contract.md).
- The package has no capture backend. Spike native code exists only in the example application.
- The exported `sampleContrast` validates its input and then rejects with the error code `CAPTURE_FAILED`.
- Only the shared TypeScript core is implemented and tested: input validation, backdrop composition, and contrast selection.
- The package is private. It is not published to npm.
- The spike adapters passed the contract suite on two iOS simulators, one Android emulator, and headless Chromium. No physical device is tested.
- Blur, Liquid Glass, and filter effects are not supported. Refer to [docs/spike/blur-and-glass.md](docs/spike/blur-and-glass.md).
- The native module framework is not selected. Refer to [docs/open-decisions.md](docs/open-decisions.md).
- The next step is delivery step 3: platform adapters in the package.

## API (Contract v1)

The behavior is locked in [docs/sampling-contract.md](docs/sampling-contract.md).
The owner did not confirm the names explicitly. A rename needs a new contract version.

```ts
const result = await sampleContrast({
  captureRoot: screenBackgroundRef,
  foreground: titleRef,
  point: { x: 0, y: 0 }, // foreground-local logical units
  // backdrop: '#ffffff', // only for residual transparency; must be opaque
  signal,
});

// The application applies this value to its Text, icon, or other foreground.
setForegroundColor(result.foreground);
```

Set `collapsable={false}` on the `captureRoot` view and on the foreground view.
React Native can remove a view that has no paint. A removed view gives `INVALID_VIEW_RELATIONSHIP`.

Error codes: `INVALID_POINT`, `INVALID_BACKDROP`, `INVALID_VIEW_RELATIONSHIP`, `ABORTED`, `NOT_READY`, `UNSUPPORTED_CONTENT`, `UNRESOLVED_BACKDROP`, `CAPTURE_FAILED`.
The contract gives the exact condition for each code.

## Support matrix

| Target | Status |
| --- | --- |
| iOS | No adapter in the package. Spike adapter: contract suite passed on simulators (iOS 18.4 and 26.5). Not verified on a device. |
| Android | No adapter in the package. Spike adapter: contract suite passed on one emulator (API 35). Not verified on a device. |
| Web | No adapter in the package. Experimental spike adapter: passed in Chromium, not stable in WebKit, not run in Firefox. |
| Expo | Development build only. Expo Go is not supported. |

Minimum versions of React Native, Expo, and each operating system are not defined.

## Repository layout

| Path | Content |
| --- | --- |
| `src/index.ts` | Public exports. |
| `src/sampleContrast.ts` | Public asynchronous function and input validation. It has no capture adapter. |
| `src/types.ts` | Public types. |
| `src/errors.ts` | Error codes and the `PaletteError` class. |
| `src/core/` | Backdrop composition and WCAG contrast selection. No React import, no native import. |
| `src/adapters/` | `CaptureAdapter` interface. Platform adapters go here in step 3. |
| `example/` | Expo application with the spike fixture and the local native module `palette-sampler`. |
| `docs/` | Handoff, locked contract, acceptance matrix, open decisions, and spike reports. |

## Development

Use Node.js 24 and npm.

```sh
npm install
npm run typecheck
npm test
```

## Documentation

- [docs/HANDOFF.md](docs/HANDOFF.md): source of truth for the scope and the delivery sequence.
- [docs/sampling-contract.md](docs/sampling-contract.md): locked sampling contract (Contract v1).
- [docs/acceptance-matrix.md](docs/acceptance-matrix.md): acceptance checklist for each platform.
- [docs/open-decisions.md](docs/open-decisions.md): open decisions and blockers.
- [docs/spike/README.md](docs/spike/README.md): spike brief and report, with the step 2 addendum.
- [docs/spike/blur-and-glass.md](docs/spike/blur-and-glass.md): behavior with blur and Liquid Glass, and the options.

## Credit

This project continues the idea of [Charlisim/Palette-iOS](https://github.com/Charlisim/Palette-iOS), which has the MIT license.
This repository contains no code from that project at this time.

## License

MIT. Refer to [LICENSE](LICENSE).
