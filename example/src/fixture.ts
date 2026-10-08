// Fixture definition. The expected pixels come from this file, not from a capture.

export type Rgba8 = readonly [number, number, number, number];
export interface Pt {
  readonly x: number;
  readonly y: number;
}

export const MAGENTA: Rgba8 = [255, 0, 255, 255];
export const WHITE: Rgba8 = [255, 255, 255, 255];
export const BLACK: Rgba8 = [0, 0, 0, 255];
export const ORANGE: Rgba8 = [255, 149, 0, 255];
export const BLUE: Rgba8 = [0, 0, 255, 255];
export const RED: Rgba8 = [255, 0, 0, 255];
export const YELLOW: Rgba8 = [255, 255, 0, 255];
export const PURPLE: Rgba8 = [128, 0, 128, 255];
export const CYAN: Rgba8 = [0, 255, 255, 255];
export const GREEN: Rgba8 = [0, 255, 0, 255];
export const CLEAR: Rgba8 = [0, 0, 0, 0];

export const css = (c: Rgba8) => `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`;

/** Source-over of a black layer with the given alpha. The result is not rounded. */
export function underBlack(color: Rgba8, alpha: number): Rgba8 {
  return [color[0] * (1 - alpha), color[1] * (1 - alpha), color[2] * (1 - alpha), 255];
}

// Root A: `fixture.png` (four quadrants) stretched to the full root, plus a 50% black overlay.
export const MAIN = { width: 300, height: 300 };
export const OVERLAY = { left: 75, top: 75, width: 150, height: 150, alpha: 0.5 };
export const TRANSPARENT_CHILD = { left: 0, top: 150, width: 150, height: 150 };

export function expectedMain(p: Pt): Rgba8 {
  const quadrant = p.y < 150 ? (p.x < 150 ? WHITE : BLACK) : p.x < 150 ? ORANGE : BLUE;
  const inOverlay =
    p.x >= OVERLAY.left &&
    p.x < OVERLAY.left + OVERLAY.width &&
    p.y >= OVERLAY.top &&
    p.y < OVERLAY.top + OVERLAY.height;
  return inOverlay ? underBlack(quadrant, OVERLAY.alpha) : quadrant;
}

// Root S: a ScrollView with four flat blocks of 100 logical units each.
export const SCROLL = { width: 300, height: 200, offset: 80, block: 100 };
export const SCROLL_BLOCKS: readonly Rgba8[] = [ORANGE, BLUE, WHITE, BLACK];

export function expectedScroll(p: Pt, offset: number): Rgba8 {
  return SCROLL_BLOCKS[Math.floor((p.y + offset) / SCROLL.block)] ?? CLEAR;
}

// Roots C and N: `bands.png` (four horizontal bands) in a 300x150 frame with a green background.
export const FRAME = { width: 300, height: 150 };
export const BANDS: readonly Rgba8[] = [RED, YELLOW, PURPLE, CYAN];

/** `cover`: the image is 300x300 and centered. The frame shows the image rows 75..225. */
export function expectedCover(p: Pt): Rgba8 {
  const displayed = Math.max(FRAME.width, FRAME.height);
  const imageY = p.y + (displayed - FRAME.height) / 2;
  return BANDS[Math.floor(imageY / (displayed / 4))] ?? CLEAR;
}

/** `contain`: the image is 150x150 and centered. The root background shows at the left and the right. */
export function expectedContain(p: Pt): Rgba8 {
  const displayed = Math.min(FRAME.width, FRAME.height);
  const left = (FRAME.width - displayed) / 2;
  if (p.x < left || p.x >= left + displayed) {
    return GREEN;
  }
  return BANDS[Math.floor(p.y / (displayed / 4))] ?? CLEAR;
}

// Root D: no painted background. The right half has a 50% black layer.
export const RESIDUAL = { width: 200, height: 60 };
export const expectedResidual = (p: Pt): Rgba8 => (p.x < 100 ? CLEAR : [0, 0, 0, 127.5]);

export const FOREGROUND = { width: 60, height: 30 };

export interface Preset {
  readonly left: number;
  readonly top: number;
  readonly transform?: readonly ({ translateX: number } | { scale: number } | { rotate: string })[];
}

/** Positions of the movable foreground in root A. */
export const PRESETS = {
  'tl-white': { left: 20, top: 20 },
  'tr-black': { left: 220, top: 20 },
  'bl-orange': { left: 20, top: 250 },
  'br-blue': { left: 220, top: 250 },
  'overlay-white': { left: 85, top: 90 },
  'overlay-black': { left: 160, top: 90 },
  'overlay-orange': { left: 85, top: 180 },
  'overlay-blue': { left: 160, top: 180 },
  'explicit-point': { left: 130, top: 20 },
  translate: { left: 20, top: 20, transform: [{ translateX: 200 }] },
  scale: { left: 100, top: 40, transform: [{ scale: 2 }] },
  rotate: { left: 120, top: 40, transform: [{ rotate: '90deg' }] },
  'over-child': { left: 100, top: 275 },
} satisfies Record<string, Preset>;

export type PresetId = keyof typeof PRESETS;
