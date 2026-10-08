# Example application (sampling spike)

This Expo application is the fixture of the sampling spike (delivery step 1).
The report is in [docs/spike/README.md](../docs/spike/README.md).
This application is not the demonstration of delivery step 4.

## Contents

| Path | Purpose |
| --- | --- |
| `App.tsx` | Fixture screen and the automated suite. |
| `src/fixture.ts` | Fixture geometry and the expected pixel values. |
| `src/baseline/` | Comparison adapter: `react-native-view-shot` with a JS `opacity: 0` exclusion. |
| `modules/palette-sampler/` | Local Expo module. Swift, Kotlin, and a web variant of the capture adapter. |
| `scripts/generate-fixtures.mjs` | Writes `assets/fixture.png` and `assets/bands.png`. |
| `metro.config.js` | Lets Metro resolve `palette-react-native/src/*` from the repository root. |

The application imports `createSampleContrast` from the root `src/` directory.
The application is not an npm workspace of the root package.
The `ios/` and `android/` directories are prebuild output. Git ignores them. Do not edit them.

## Versions

Expo SDK 57 (`expo` 57.0.27), React Native 0.86.3, React 19.2.3, New Architecture on.
The application needs a development build. Expo Go does not contain the local native module.

## Requirements

- Node.js 24 and npm.
- iOS: Xcode and CocoaPods.
- Android: Android SDK, an emulator or a device, and JDK 17.

## Install

1. Open a terminal in this directory.
2. Run `npm install`.
3. If you changed the fixture definition, run `node scripts/generate-fixtures.mjs`.
4. Run `npx expo prebuild`.

## Run on iOS

1. Set `LANG=en_US.UTF-8`.
2. Run `npx expo run:ios`.

## Run on Android

1. Set `ANDROID_HOME` to the Android SDK directory.
2. Set `JAVA_HOME` to a JDK 17 directory.
3. Start an emulator or connect a device.
4. Run `npx expo run:android`.

## Run on web

1. Run `npx expo start --web`.
2. Open the URL that the command shows.

## Automated suite

The suite starts after all images report `onLoad`.
The suite writes one line for each case to the JavaScript console. Metro shows these lines.

| Line prefix | Content |
| --- | --- |
| `SPIKE_ENV` | Platform, OS version, device pixel ratio, backend, and tolerances. |
| `SPIKE_CASE` | Expected value, sampled RGBA, resolved RGBA, foreground, ratio, capture point, and result. |
| `SPIKE_LATENCY` | p50 and p95 of repeated samples. |
| `SPIKE_FLASH` | Count of samples in the loop for the screen record. |
| `SPIKE_BASELINE_CASE`, `SPIKE_BASELINE` | Results of the view-shot comparison (iOS and Android only). |
| `SPIKE_RESULT` | Totals and the list of failed cases. |

The screen shows the same results in a table.
The buttons move the foreground of the first fixture and sample one time.
The `Run suite` button starts the suite again.

## Flash check

1. Start a screen record (`xcrun simctl io <udid> recordVideo <file>` or `adb shell screenrecord <file>`).
2. Start the application.
3. Stop the record after the `SPIKE_RESULT` line.
4. Run `node ../docs/spike/tools/flash-check.mjs <file> <downscale>`.

The top-right square changes color while a sample loop runs.
The tool counts the magenta foreground pixels in each recorded frame of each loop.
