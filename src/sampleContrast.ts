import type { CaptureAdapter, CaptureSample } from './adapters/types';
import { isValidRGBA, parseBackdrop, resolveBackdrop } from './core/color';
import { chooseForeground } from './core/contrast';
import { PaletteError } from './errors';
import type {
  AbortSignalLike,
  Point,
  SampleContrastOptions,
  SampleContrastResult,
  ViewRef,
} from './types';

const DEFAULT_POINT: Point = { x: 0, y: 0 };

function assertFinitePoint(point: Point): void {
  if (
    point === null ||
    typeof point !== 'object' ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  ) {
    throw new PaletteError('INVALID_POINT', 'The point must contain finite numbers.');
  }
}

function isMounted(ref: ViewRef | null | undefined): boolean {
  return ref !== null && typeof ref === 'object' && ref.current !== null && ref.current !== undefined;
}

function assertViewRefs(options: SampleContrastOptions): void {
  if (!isMounted(options.captureRoot) || !isMounted(options.foreground)) {
    throw new PaletteError(
      'INVALID_VIEW_RELATIONSHIP',
      'The captureRoot and the foreground must be mounted view references.',
    );
  }
  if (options.captureRoot.current === options.foreground.current) {
    throw new PaletteError(
      'INVALID_VIEW_RELATIONSHIP',
      'The foreground must be a descendant of the captureRoot, not the same view.',
    );
  }
}

function isValidSample(sample: CaptureSample): boolean {
  return (
    sample !== null &&
    typeof sample === 'object' &&
    sample.rgba !== null &&
    typeof sample.rgba === 'object' &&
    isValidRGBA(sample.rgba) &&
    sample.capturePoint !== null &&
    typeof sample.capturePoint === 'object' &&
    Number.isFinite(sample.capturePoint.x) &&
    Number.isFinite(sample.capturePoint.y) &&
    Number.isFinite(sample.bitmapScale) &&
    sample.bitmapScale > 0
  );
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

/**
 * Binds the public function to a capture adapter. No platform adapter exists in the package yet.
 * Validation order: point, backdrop, view references, signal, adapter.
 */
export function createSampleContrast(adapter?: CaptureAdapter) {
  return async function sampleContrast(
    options: SampleContrastOptions,
  ): Promise<SampleContrastResult> {
    const point = options.point === undefined ? DEFAULT_POINT : options.point;
    assertFinitePoint(point);
    const backdrop = options.backdrop === undefined ? undefined : parseBackdrop(options.backdrop);
    assertViewRefs(options);
    assertNotAborted(options.signal);

    if (adapter === undefined) {
      throw new PaletteError('CAPTURE_FAILED', 'No capture adapter is implemented.');
    }

    const sample = await capture(adapter, options, point);
    // An adapter cannot always stop an in-flight capture. Discard the stale result.
    assertNotAborted(options.signal);

    if (!isValidSample(sample)) {
      throw new PaletteError('CAPTURE_FAILED', 'The capture adapter returned an invalid sample.');
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
