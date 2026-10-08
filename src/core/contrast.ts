import type { Foreground, RGBA } from '../types';
import { isOpaque } from './color';

export interface ForegroundChoice {
  readonly foreground: Foreground;
  readonly contrastRatio: number;
}

const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: RGBA = { r: 1, g: 1, b: 1, a: 1 };

// WCAG 2.x sRGB linearization.
function linearize(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance. Alpha is ignored. */
export function relativeLuminance(color: RGBA): number {
  return (
    0.2126 * linearize(color.r) + 0.7152 * linearize(color.g) + 0.0722 * linearize(color.b)
  );
}

/** WCAG 2.x contrast ratio in the range 1..21. The argument order has no effect. */
export function contrastRatio(a: RGBA, b: RGBA): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Selects the larger ratio. A tie selects black. */
export function selectByRatio(blackRatio: number, whiteRatio: number): ForegroundChoice {
  return blackRatio >= whiteRatio
    ? { foreground: 'black', contrastRatio: blackRatio }
    : { foreground: 'white', contrastRatio: whiteRatio };
}

/** Selects black or white for an opaque background. */
export function chooseForeground(opaqueBackground: RGBA): ForegroundChoice {
  if (!isOpaque(opaqueBackground)) {
    throw new RangeError('chooseForeground requires an opaque background. Resolve the backdrop first.');
  }
  return selectByRatio(
    contrastRatio(opaqueBackground, BLACK),
    contrastRatio(opaqueBackground, WHITE),
  );
}
