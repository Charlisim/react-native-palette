import { NativeModule, requireNativeModule } from 'expo';

export interface NativeSample {
  r: number;
  g: number;
  b: number;
  a: number;
  captureX: number;
  captureY: number;
  pixelX: number;
  pixelY: number;
  scale: number;
  exclusion: string;
  effects?: { name: string; containsPoint: boolean }[];
  before: unknown;
  during: unknown;
  after: unknown;
  nativeMs: number;
}

declare class PaletteSamplerModule extends NativeModule<{}> {
  sampleAsync(
    rootTag: number,
    foregroundTag: number,
    x: number,
    y: number,
    mode: string,
  ): Promise<NativeSample>;
  inspectAsync(tag: number): Promise<unknown>;
  locateAsync(tag: number): Promise<{ x: number; y: number; width: number; height: number; scale: number }>;
  /** Android only. */
  pixelCopyAsync(rootTag: number, foregroundTag: number, x: number, y: number): Promise<NativeSample>;
}

export default requireNativeModule<PaletteSamplerModule>('PaletteSampler');
