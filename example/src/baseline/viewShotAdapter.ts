import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import UPNG from 'upng-js';
import type { CaptureAdapter } from 'palette-react-native/src/adapters/types';
import { PaletteError } from 'palette-react-native/src/errors';
import type { ViewRef } from 'palette-react-native/src/types';

// Baseline for comparison only. The handoff does not accept this exclusion method as safe.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(text: string): ArrayBuffer {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let offset = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (ALPHABET.indexOf(clean.charAt(i)) << 18) |
      (ALPHABET.indexOf(clean.charAt(i + 1)) << 12) |
      ((ALPHABET.indexOf(clean.charAt(i + 2)) & 63) << 6) |
      (ALPHABET.indexOf(clean.charAt(i + 3)) & 63);
    if (offset < bytes.length) bytes[offset++] = (n >> 16) & 255;
    if (offset < bytes.length) bytes[offset++] = (n >> 8) & 255;
    if (offset < bytes.length) bytes[offset++] = n & 255;
  }
  return bytes.buffer;
}

export interface ViewShotHooks {
  /** JS state change to `opacity: 0`. It resolves after the React commit. */
  setExcluded(foreground: ViewRef, excluded: boolean): Promise<void>;
}

export interface ViewShotAdapter extends CaptureAdapter {
  lastBitmap(): { width: number; height: number; base64Length: number } | undefined;
}

export function createViewShotAdapter(hooks: ViewShotHooks): ViewShotAdapter {
  let bitmap: { width: number; height: number; base64Length: number } | undefined;
  return {
    lastBitmap: () => bitmap,
    async capture(request) {
      const root = request.captureRoot.current as View | null;
      const foreground = request.foreground.current as View | null;
      if (!root || !foreground) {
        throw new PaletteError('INVALID_VIEW_RELATIONSHIP', 'A view reference is not mounted.');
      }
      // `measureLayout` does not include transforms.
      const layout = await new Promise<{ x: number; y: number }>((resolve, reject) => {
        foreground.measureLayout(
          root,
          (x, y) => resolve({ x, y }),
          () => reject(new PaletteError('INVALID_VIEW_RELATIONSHIP', 'measureLayout failed.')),
        );
      });
      const rootWidth = await new Promise<number>((resolve) => {
        root.measure((_x, _y, width) => resolve(width));
      });
      await hooks.setExcluded(request.foreground, true);
      let base64: string;
      try {
        base64 = await captureRef(root, { format: 'png', result: 'base64' });
      } finally {
        await hooks.setExcluded(request.foreground, false);
      }
      const image = UPNG.decode(decodeBase64(base64));
      const rgba = new Uint8Array(UPNG.toRGBA8(image)[0]!);
      bitmap = { width: image.width, height: image.height, base64Length: base64.length };
      const scale = image.width / rootWidth;
      const capturePoint = { x: layout.x + request.point.x, y: layout.y + request.point.y };
      const px = Math.floor(capturePoint.x * scale);
      const py = Math.floor(capturePoint.y * scale);
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) {
        throw new PaletteError('INVALID_POINT', 'The point is outside the bitmap.');
      }
      const i = (py * image.width + px) * 4;
      // PNG stores straight alpha.
      return {
        rgba: { r: rgba[i]! / 255, g: rgba[i + 1]! / 255, b: rgba[i + 2]! / 255, a: rgba[i + 3]! / 255 },
        capturePoint,
        bitmapScale: scale,
      };
    },
  };
}
