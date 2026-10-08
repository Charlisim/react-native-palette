import type { CaptureAdapter, CaptureRequest, CaptureSample } from '../adapters/types';
import { PaletteError } from '../errors';
import { sampleContrast as publicSampleContrast } from '../index';
import { createSampleContrast } from '../sampleContrast';
import type { AbortSignalLike, RGBA, SampleContrastOptions } from '../types';

const refs = { captureRoot: { current: {} }, foreground: { current: {} } };

function fakeAdapter(rgba: RGBA) {
  const requests: CaptureRequest[] = [];
  const adapter: CaptureAdapter = {
    async capture(request): Promise<CaptureSample> {
      requests.push(request);
      return { rgba, capturePoint: { x: 40 + request.point.x, y: 120 + request.point.y }, bitmapScale: 3 };
    },
  };
  return { adapter, requests };
}

function fakeSignal(aborted = false) {
  const signal = {
    aborted,
    addEventListener() {},
    removeEventListener() {},
  };
  return signal satisfies AbortSignalLike;
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof PaletteError ? error.code : `unexpected: ${String(error)}`;
  }
  return 'resolved';
}

describe('sampleContrast without an adapter', () => {
  it('rejects with CAPTURE_FAILED', async () => {
    const error = await publicSampleContrast(refs).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaletteError);
    expect((error as PaletteError).code).toBe('CAPTURE_FAILED');
    expect((error as PaletteError).message).toMatch(/no capture adapter/i);
  });

  it('validates the input before the adapter check', async () => {
    expect(await codeOf(publicSampleContrast({ ...refs, point: { x: NaN, y: 0 } }))).toBe('INVALID_POINT');
    expect(await codeOf(publicSampleContrast({ ...refs, backdrop: '#fff' }))).toBe('UNRESOLVED_BACKDROP');
    expect(await codeOf(publicSampleContrast({ ...refs, signal: fakeSignal(true) }))).toBe('ABORTED');
  });
});

describe('sampleContrast with a fake adapter', () => {
  it('returns the result for an opaque sample', async () => {
    const yellow: RGBA = { r: 1, g: 1, b: 0, a: 1 };
    const { adapter, requests } = fakeAdapter(yellow);
    const result = await createSampleContrast(adapter)({ ...refs, point: { x: 2, y: 5 } });

    expect(result.sampledRGBA).toEqual(yellow);
    expect(result.resolvedRGBA).toEqual(yellow);
    expect(result.foreground).toBe('black');
    expect(result.contrastRatio).toBeCloseTo(19.556, 2);
    expect(result.capturePoint).toEqual({ x: 42, y: 125 });
    expect(result.scope).toBe('point');
    expect(Object.keys(result).sort()).toEqual(
      ['capturePoint', 'contrastRatio', 'foreground', 'resolvedRGBA', 'sampledRGBA', 'scope'],
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.captureRoot).toBe(refs.captureRoot);
    expect(requests[0]?.foreground).toBe(refs.foreground);
  });

  it('selects white for an opaque dark sample', async () => {
    const { adapter } = fakeAdapter({ r: 0, g: 0, b: 1, a: 1 });
    const result = await createSampleContrast(adapter)(refs);
    expect(result.foreground).toBe('white');
    expect(result.contrastRatio).toBeCloseTo(8.593, 2);
  });

  it('uses the top-left foreground point by default', async () => {
    const { adapter, requests } = fakeAdapter({ r: 1, g: 1, b: 1, a: 1 });
    await createSampleContrast(adapter)(refs);
    expect(requests[0]?.point).toEqual({ x: 0, y: 0 });
  });

  it('resolves a translucent sample against the backdrop', async () => {
    const sample: RGBA = { r: 0, g: 0, b: 0, a: 0.5 };
    const sampleContrast = createSampleContrast(fakeAdapter(sample).adapter);

    const overWhite = await sampleContrast({ ...refs, backdrop: '#ffffff' });
    expect(overWhite.sampledRGBA).toEqual(sample);
    expect(overWhite.resolvedRGBA).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
    expect(overWhite.foreground).toBe('black');

    const overBlack = await sampleContrast({ ...refs, backdrop: '#000000' });
    expect(overBlack.resolvedRGBA).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(overBlack.foreground).toBe('white');
    expect(overBlack.contrastRatio).toBeCloseTo(21, 10);
  });

  it('rejects a translucent sample without a backdrop', async () => {
    const { adapter } = fakeAdapter({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(await codeOf(createSampleContrast(adapter)(refs))).toBe('UNRESOLVED_BACKDROP');
  });

  it('rejects an aborted signal and does not call the adapter', async () => {
    const { adapter, requests } = fakeAdapter({ r: 1, g: 1, b: 1, a: 1 });
    const options: SampleContrastOptions = { ...refs, signal: fakeSignal(true) };
    expect(await codeOf(createSampleContrast(adapter)(options))).toBe('ABORTED');
    expect(requests).toHaveLength(0);
  });

  it('discards the result when the signal aborts during the capture', async () => {
    const signal = fakeSignal();
    const adapter: CaptureAdapter = {
      async capture() {
        signal.aborted = true;
        return { rgba: { r: 1, g: 1, b: 1, a: 1 }, capturePoint: { x: 0, y: 0 }, bitmapScale: 1 };
      },
    };
    expect(await codeOf(createSampleContrast(adapter)({ ...refs, signal }))).toBe('ABORTED');
  });

  it('passes the signal to the adapter', async () => {
    const { adapter, requests } = fakeAdapter({ r: 1, g: 1, b: 1, a: 1 });
    const signal = fakeSignal();
    await createSampleContrast(adapter)({ ...refs, signal });
    expect(requests[0]?.signal).toBe(signal);
  });

  it.each([
    { x: Infinity, y: 0 },
    { x: 0, y: -Infinity },
    { x: NaN, y: NaN },
  ])('rejects the point %j and does not call the adapter', async (point) => {
    const { adapter, requests } = fakeAdapter({ r: 1, g: 1, b: 1, a: 1 });
    expect(await codeOf(createSampleContrast(adapter)({ ...refs, point }))).toBe('INVALID_POINT');
    expect(requests).toHaveLength(0);
  });

  it('rejects an invalid backdrop and does not call the adapter', async () => {
    const { adapter, requests } = fakeAdapter({ r: 1, g: 1, b: 1, a: 1 });
    const sampleContrast = createSampleContrast(adapter);
    expect(await codeOf(sampleContrast({ ...refs, backdrop: '#ffffff80' }))).toBe('UNRESOLVED_BACKDROP');
    expect(await codeOf(sampleContrast({ ...refs, backdrop: 'white' }))).toBe('UNRESOLVED_BACKDROP');
    expect(requests).toHaveLength(0);
  });

  it('keeps the PaletteError of the adapter', async () => {
    const failure = new PaletteError('UNSUPPORTED_CONTENT', 'The renderer is not supported.');
    const adapter: CaptureAdapter = { capture: () => Promise.reject(failure) };
    await expect(createSampleContrast(adapter)(refs)).rejects.toBe(failure);
  });

  it('wraps an unknown adapter failure in CAPTURE_FAILED with the cause', async () => {
    const cause = new Error('native failure');
    const adapter: CaptureAdapter = { capture: () => Promise.reject(cause) };
    const error = await createSampleContrast(adapter)(refs).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaletteError);
    expect((error as PaletteError).code).toBe('CAPTURE_FAILED');
    expect((error as PaletteError).cause).toBe(cause);
  });

  it('rejects an invalid color from the adapter', async () => {
    const { adapter } = fakeAdapter({ r: NaN, g: 0, b: 0, a: 1 });
    expect(await codeOf(createSampleContrast(adapter)(refs))).toBe('CAPTURE_FAILED');
    const outOfRange = fakeAdapter({ r: 255, g: 0, b: 0, a: 1 }).adapter;
    expect(await codeOf(createSampleContrast(outOfRange)(refs))).toBe('CAPTURE_FAILED');
  });
});
