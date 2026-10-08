import { findNodeHandle } from 'react-native';
import type { CaptureRequest, CaptureSample } from 'palette-react-native/src/adapters/types';
import { PaletteError, type PaletteErrorCode } from 'palette-react-native/src/errors';
import type { ViewRef } from 'palette-react-native/src/types';

import { withAbort } from './abort';
import type { CaptureDetail, SamplerMode, SpikeCaptureAdapter } from './PaletteSampler.types';
import PaletteSamplerModule from './PaletteSamplerModule';

const CODES: readonly PaletteErrorCode[] = [
  'NOT_READY',
  'INVALID_VIEW_RELATIONSHIP',
  'INVALID_POINT',
  'UNSUPPORTED_CONTENT',
  'CAPTURE_FAILED',
];

function toPaletteError(error: unknown): PaletteError {
  const message = error instanceof Error ? error.message : String(error);
  const fromField = (error as { code?: unknown } | null)?.code;
  const fromMessage = /\[([A-Z_]+)\]/.exec(message)?.[1];
  const code = CODES.find((known) => known === fromField) ?? CODES.find((known) => known === fromMessage);
  return new PaletteError(code ?? 'CAPTURE_FAILED', message, { cause: error });
}

function tagOf(view: ViewRef): number {
  const tag = view.current == null ? null : findNodeHandle(view.current as never);
  if (typeof tag !== 'number') {
    throw new PaletteError('INVALID_VIEW_RELATIONSHIP', 'A view reference is not mounted.');
  }
  return tag;
}

/** Native backend: one UI-thread transaction and a one-pixel render. */
export function createCaptureAdapter(): SpikeCaptureAdapter {
  let mode: SamplerMode = 'normal';
  let detail: CaptureDetail | undefined;

  async function run(request: CaptureRequest, requestMode: SamplerMode): Promise<CaptureSample> {
    const rootTag = tagOf(request.captureRoot);
    const foregroundTag = tagOf(request.foreground);
    let native;
    try {
      native = await PaletteSamplerModule.sampleAsync(
        rootTag,
        foregroundTag,
        request.point.x,
        request.point.y,
        requestMode,
      );
    } catch (error) {
      throw toPaletteError(error);
    }
    detail = {
      pixel: { x: native.pixelX, y: native.pixelY },
      scale: native.scale,
      exclusion: native.exclusion,
      before: native.before,
      during: native.during,
      after: native.after,
      captureMs: native.nativeMs,
    };
    return {
      rgba: { r: native.r, g: native.g, b: native.b, a: native.a },
      capturePoint: { x: native.captureX, y: native.captureY },
      bitmapScale: native.scale,
    };
  }

  return {
    backend: 'native-one-pixel',
    setMode(next) {
      mode = next;
    },
    lastDetail: () => detail,
    // The native call is one synchronous UI-thread block. An abort cannot stop it.
    // The native block always restores the foreground before it returns.
    capture: (request) => withAbort(request.signal, run(request, mode)),
    async inspect(view) {
      try {
        return await PaletteSamplerModule.inspectAsync(tagOf(view));
      } catch (error) {
        throw toPaletteError(error);
      }
    },
  };
}
