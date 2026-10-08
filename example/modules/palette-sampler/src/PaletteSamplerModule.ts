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
}

export default requireNativeModule<PaletteSamplerModule>('PaletteSampler');
