import { PaletteError } from '../errors';
import type { RGBA } from '../types';

const OPAQUE_HEX = /^#[0-9a-fA-F]{6}$/;

/** Parses an opaque `#rrggbb` sRGB backdrop. Every other form is invalid. */
export function parseBackdrop(backdrop: string): RGBA {
  if (typeof backdrop !== 'string' || !OPAQUE_HEX.test(backdrop)) {
    throw new PaletteError(
      'UNRESOLVED_BACKDROP',
      `The backdrop must be an opaque "#rrggbb" sRGB color. Received: ${String(backdrop)}`,
    );
  }
  const channel = (offset: number) => parseInt(backdrop.slice(offset, offset + 2), 16) / 255;
  return { r: channel(1), g: channel(3), b: channel(5), a: 1 };
}

export function isValidRGBA(color: RGBA): boolean {
  return [color.r, color.g, color.b, color.a].every(
    (channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1,
  );
}

export function isOpaque(color: RGBA): boolean {
  return color.a === 1;
}

/**
 * Returns an opaque color for the contrast selection.
 * An opaque sample is returned unchanged.
 * A translucent sample is composited source-over the opaque backdrop.
 */
export function resolveBackdrop(sample: RGBA, backdrop?: RGBA): RGBA {
  if (isOpaque(sample)) {
    return sample;
  }
  if (backdrop === undefined) {
    throw new PaletteError(
      'UNRESOLVED_BACKDROP',
      'The sample is translucent and no backdrop was supplied.',
    );
  }
  if (!isOpaque(backdrop)) {
    throw new PaletteError('UNRESOLVED_BACKDROP', 'The backdrop must be opaque.');
  }
  const over = (source: number, destination: number) =>
    source * sample.a + destination * (1 - sample.a);
  return {
    r: over(sample.r, backdrop.r),
    g: over(sample.g, backdrop.g),
    b: over(sample.b, backdrop.b),
    a: 1,
  };
}
