import type { AbortSignalLike, Point, RGBA, ViewRef } from '../types';

// Contract v1 did not change this interface. Delivery step 3 makes it final.

export interface CaptureRequest {
  readonly captureRoot: ViewRef;
  /** The adapter excludes this subtree from the capture and restores it afterwards. */
  readonly foreground: ViewRef;
  /** Foreground-local point in logical units. The adapter maps it to capture space. */
  readonly point: Point;
  readonly signal?: AbortSignalLike;
}

export interface CaptureSample {
  /** One decoded pixel. Normalized sRGB, straight alpha. */
  readonly rgba: RGBA;
  /** Sampled position in capture-root logical units. */
  readonly capturePoint: Point;
  /** Physical bitmap pixels for each logical unit. */
  readonly bitmapScale: number;
}

export interface CaptureAdapter {
  /** Rejects with a `PaletteError` when the capture is not possible. */
  capture(request: CaptureRequest): Promise<CaptureSample>;
}
