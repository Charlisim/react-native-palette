# palette-react-native

A React Native library that samples the rendered background below a foreground element.
The library then selects an opaque black or white foreground from that sample.

The library reads the pixels that are behind the element: an image, a gradient, or translucent layers.
It is not a wrapper that accepts a known color and returns black or white.

The package name `palette-react-native` is a placeholder.

## Status: scaffold and completed sampling spike

- The package has no capture backend. Spike native code exists only in the example application.
- The exported `sampleContrast` always rejects with the error code `CAPTURE_FAILED`.
- Only the shared TypeScript contrast core is implemented and tested.
- The package is private. It is not published to npm.
- The sampling spike is complete on simulators and one emulator. Refer to [docs/spike/README.md](docs/spike/README.md).
- The next step is delivery step 2: lock the sampling contract.

## Proposed API

This API is a proposal. The names and the behavior are not final.
Delivery step 2 locks the contract. Refer to [docs/sampling-contract.md](docs/sampling-contract.md).

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

## Support matrix

| Target | Status |
| --- | --- |
| iOS | planned, not verified |
| Android | planned, not verified |
| Web | planned, not verified |
| Expo | planned, not verified |

Minimum versions of React Native, Expo, and each operating system are not defined.

## Repository layout

| Path | Content |
| --- | --- |
| `src/index.ts` | Public exports. |
| `src/sampleContrast.ts` | Public asynchronous function. It has no capture adapter. |
| `src/types.ts` | Public types. |
| `src/errors.ts` | Error codes and the `PaletteError` class. |
| `src/core/` | Backdrop composition and WCAG contrast selection. No React import, no native import. |
| `src/adapters/` | Provisional `CaptureAdapter` interface. Platform adapters go here after the spike. |
| `example/` | Expo application with the spike fixture and the local native module `palette-sampler`. |
| `docs/` | Handoff, draft contract, acceptance matrix, open decisions, and spike brief. |

## Development

Use Node.js 24 and npm.

```sh
npm install
npm run typecheck
npm test
```

## Documentation

- [docs/HANDOFF.md](docs/HANDOFF.md): source of truth for the scope and the delivery sequence.
- [docs/sampling-contract.md](docs/sampling-contract.md): draft sampling contract.
- [docs/acceptance-matrix.md](docs/acceptance-matrix.md): acceptance checklist for each platform.
- [docs/open-decisions.md](docs/open-decisions.md): open decisions and blockers.
- [docs/spike/README.md](docs/spike/README.md): spike brief and report.

## Credit

This project continues the idea of [Charlisim/Palette-iOS](https://github.com/Charlisim/Palette-iOS), which has the MIT license.
This repository contains no code from that project at this time.

## License

MIT. Refer to [LICENSE](LICENSE).
