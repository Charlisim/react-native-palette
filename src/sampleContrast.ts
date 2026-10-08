import type { CaptureAdapter, CaptureSample } from './adapters/types';
import { isValidRGBA, parseBackdrop, resolveBackdrop } from './core/color';
import { chooseForeground } from './core/contrast';
import { PaletteError } from './errors';
import type { AbortSignalLike, Point, SampleContrastOptions, SampleContrastResult } from './types';

const DEFAULT_POINT: Point = { x: 0, y: 0 };

function assertFinitePoint(point: Point): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new PaletteError('INVALID_POINT', 'The point must contain finite numbers.');
  }
}

function assertNotAborted(signal: AbortSignalLike | undefined): void {
  if (signal?.aborted) {
    throw new PaletteError('ABORTED', 'The request was aborted.');
  }
}

async function capture(
  adapter: CaptureAdapter,
  options: SampleContrastOptions,
  point: Point,
): Promise<CaptureSample> {
  try {
    return await adapter.capture({
      captureRoot: options.captureRoot,
      foreground: options.foreground,
      point,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof PaletteError) {
      throw error;
    }
    throw new PaletteError('CAPTURE_FAILED', 'The capture adapter failed.', { cause: error });
  }
}

/** Binds the public function to a capture adapter. No platform adapter exists yet. */
export function createSampleContrast(adapter?: CaptureAdapter) {
  return async function sampleContrast(
    options: SampleContrastOptions,
  ): Promise<SampleContrastResult> {
    const point = options.point ?? DEFAULT_POINT;
    assertFinitePoint(point);
    const backdrop = options.backdrop === undefined ? undefined : parseBackdrop(options.backdrop);
    assertNotAborted(options.signal);

    if (adapter === undefined) {
      throw new PaletteError('CAPTURE_FAILED', 'No capture adapter is implemented.');
    }

    const sample = await capture(adapter, options, point);
    // An adapter cannot always stop an in-flight capture. Discard the stale result.
    assertNotAborted(options.signal);

    if (!isValidRGBA(sample.rgba)) {
      throw new PaletteError('CAPTURE_FAILED', 'The capture adapter returned an invalid color.');
    }

    const resolvedRGBA = resolveBackdrop(sample.rgba, backdrop);
    const { foreground, contrastRatio } = chooseForeground(resolvedRGBA);
    return {
      sampledRGBA: sample.rgba,
      resolvedRGBA,
      foreground,
      contrastRatio,
      capturePoint: sample.capturePoint,
      scope: 'point',
    };
  };
}

export const sampleContrast = createSampleContrast();
