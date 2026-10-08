/** sRGB color. Each channel is in the range 0..1. Alpha is straight (not premultiplied). */
export interface RGBA {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** Position in logical layout units. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Selected foreground color. Each value is a valid React Native color string. */
export type Foreground = 'black' | 'white';

/** Structural view reference. A React ref object satisfies this type. */
export interface ViewRef {
  readonly current: unknown;
}

/** Structural subset of `AbortSignal`. A standard `AbortSignal` satisfies this type. */
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

export interface SampleContrastOptions {
  /** Ancestor that contains the painted background and the foreground. */
  readonly captureRoot: ViewRef;
  /** View that the capture excludes. */
  readonly foreground: ViewRef;
  /** Foreground-local point in logical units. The default is the top-left bounds point. */
  readonly point?: Point;
  /** Opaque `#rrggbb` sRGB color. It resolves residual transparency only. */
  readonly backdrop?: string;
  readonly signal?: AbortSignalLike;
}

export interface SampleContrastResult {
  /** Color that the capture returned, before backdrop resolution. */
  readonly sampledRGBA: RGBA;
  /** Opaque color that the contrast selection used. */
  readonly resolvedRGBA: RGBA;
  readonly foreground: Foreground;
  /** WCAG 2.x contrast ratio between `foreground` and `resolvedRGBA`. */
  readonly contrastRatio: number;
  /** Sampled position in capture-root logical units. */
  readonly capturePoint: Point;
  /** The result describes one point only. */
  readonly scope: 'point';
}
