# Platform adapters

No adapter exists in the package. The `ios`, `android`, and `web` adapters go in this directory in delivery step 3.
The spike adapters in `example/modules/palette-sampler/` follow [Contract v1](../../docs/sampling-contract.md).

`types.ts` contains the `CaptureAdapter` interface. Step 1 and step 2 did not change it. Step 3 makes it final.

Each adapter must own these responsibilities:

- **View access.** Resolve the two view references. Do all native view operations on the UI thread.
- **Exclusion and restoration.** Exclude the full foreground subtree from the capture. Restore the state after success, error, cancellation, and unmount.
- **Point mapping.** Map the foreground-local point to capture-root coordinates and then to one bitmap pixel.
- **Decode.** Identify channel order, premultiplied alpha, color space, and bitmap scale. Return normalized sRGB with straight alpha.
- **Bitmap ownership and cleanup.** Release each bitmap and each capture file. Do not return bitmap data to the shared core.
- **Explicit failure.** Reject with a `PaletteError`. Do not return a black sample for absent or unsupported content.
- **Root opacity.** Do not include the opacity of the capture root in the sample.
- **Effects.** If a detected blur, glass, or filter effect covers the sample point, reject with `UNSUPPORTED_CONTENT`. Name the effect in the message.

The web adapter must also keep browser imports separate and safe for server-side render.

The shared core owns backdrop composition and contrast selection. An adapter does not do them.
