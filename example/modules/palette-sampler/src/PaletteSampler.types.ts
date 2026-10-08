import type { CaptureAdapter } from 'palette-react-native/src/adapters/types';
import type { ViewRef } from 'palette-react-native/src/types';

/**
 * Debug modes of the spike.
 * - `normal`: default exclusion of the platform.
 * - `skipExclusion`: negative control. The foreground stays in the capture.
 * - `failAfterHide`: forced failure after the exclusion. It tests the restoration.
 * - `visibility`: Android only. Exclusion with `View.INVISIBLE` as an alternative to `transitionAlpha`.
 * - `skipOriginCheck`: web only. No cross-origin check before the DOM render. It shows the renderer behavior.
 */
export type SamplerMode = 'normal' | 'skipExclusion' | 'failAfterHide' | 'visibility' | 'skipOriginCheck';

/** Diagnostic data of the last completed capture. It is not part of `CaptureAdapter`. */
export interface CaptureDetail {
  readonly pixel: { readonly x: number; readonly y: number };
  readonly scale: number;
  readonly exclusion: string;
  /** Foreground state before, during, and after the exclusion. */
  readonly before: unknown;
  readonly during: unknown;
  readonly after: unknown;
  /** Time in the native or DOM capture, in milliseconds. */
  readonly captureMs: number;
  /** Web only. Count of DOM mutations in the capture root subtree during the capture. */
  readonly rootMutations?: number;
  /** Web only. Type, attribute, and target of each mutation. */
  readonly rootMutationKinds?: readonly string[];
}

export interface SpikeCaptureAdapter extends CaptureAdapter {
  readonly backend: string;
  setMode(mode: SamplerMode): void;
  lastDetail(): CaptureDetail | undefined;
  /** Reads the present state of a view. It does not capture. */
  inspect(view: ViewRef): Promise<unknown>;
}
