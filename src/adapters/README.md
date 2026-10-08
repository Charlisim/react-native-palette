# Platform adapters

No adapter exists. The `ios`, `android`, and `web` adapters go in this directory after the sampling spike.

`types.ts` contains the provisional `CaptureAdapter` interface. The spike can change it.

Each adapter must own these responsibilities:

- **View access.** Resolve the two view references. Do all native view operations on the UI thread.
- **Exclusion and restoration.** Exclude the full foreground subtree from the capture. Restore the state after success, error, cancellation, and unmount.
- **Point mapping.** Map the foreground-local point to capture-root coordinates and then to one bitmap pixel.
- **Decode.** Identify channel order, premultiplied alpha, color space, and bitmap scale. Return normalized sRGB with straight alpha.
- **Bitmap ownership and cleanup.** Release each bitmap and each capture file. Do not return bitmap data to the shared core.
- **Explicit failure.** Reject with a `PaletteError`. Do not return a black sample for absent or unsupported content.

The web adapter must also keep browser imports separate and safe for server-side render.

The shared core owns backdrop composition and contrast selection. An adapter does not do them.
