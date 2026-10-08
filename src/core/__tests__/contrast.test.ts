import type { RGBA } from '../../types';
import { parseBackdrop, resolveBackdrop } from '../color';
import { chooseForeground, contrastRatio, relativeLuminance, selectByRatio } from '../contrast';

const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: RGBA = { r: 1, g: 1, b: 1, a: 1 };

describe('relativeLuminance', () => {
  it('returns 0 for black and 1 for white', () => {
    expect(relativeLuminance(BLACK)).toBe(0);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 12);
  });

  it('linearizes the channels', () => {
    expect(relativeLuminance(parseBackdrop('#ff0000'))).toBeCloseTo(0.2126, 12);
    expect(relativeLuminance(parseBackdrop('#808080'))).toBeCloseTo(0.21586, 5);
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black against white, in each order', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 10);
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 10);
  });

  it('returns 1 for equal colors', () => {
    expect(contrastRatio(WHITE, WHITE)).toBe(1);
    expect(contrastRatio(BLACK, BLACK)).toBe(1);
  });
});

describe('chooseForeground', () => {
  it.each(['#ff0000', '#ff9500', '#ffff00', '#00ff00', '#00ffff'])(
    'selects black for %s',
    (hex) => {
      const background = parseBackdrop(hex);
      const choice = chooseForeground(background);
      expect(choice.foreground).toBe('black');
      expect(choice.contrastRatio).toBe(contrastRatio(background, BLACK));
      expect(choice.contrastRatio).toBeGreaterThan(contrastRatio(background, WHITE));
    },
  );

  it.each(['#0000ff', '#800080'])('selects white for %s', (hex) => {
    const background = parseBackdrop(hex);
    const choice = chooseForeground(background);
    expect(choice.foreground).toBe('white');
    expect(choice.contrastRatio).toBe(contrastRatio(background, WHITE));
    expect(choice.contrastRatio).toBeGreaterThan(contrastRatio(background, BLACK));
  });

  it.each([
    ['#ff0000', 5.252],
    ['#ffff00', 19.556],
    ['#0000ff', 8.593],
    ['#800080', 9.418],
  ])('returns the known WCAG ratio for %s', (hex, expected) => {
    expect(chooseForeground(parseBackdrop(hex)).contrastRatio).toBeCloseTo(expected, 2);
  });

  it('selects black with ratio 21 for white', () => {
    const choice = chooseForeground(WHITE);
    expect(choice.foreground).toBe('black');
    expect(choice.contrastRatio).toBeCloseTo(21, 10);
  });

  it('selects white with ratio 21 for black', () => {
    const choice = chooseForeground(BLACK);
    expect(choice.foreground).toBe('white');
    expect(choice.contrastRatio).toBeCloseTo(21, 10);
  });

  it('selects black for 50% black over white', () => {
    const background = resolveBackdrop({ r: 0, g: 0, b: 0, a: 0.5 }, WHITE);
    const choice = chooseForeground(background);
    expect(choice.foreground).toBe('black');
    expect(choice.contrastRatio).toBeCloseTo(5.28, 2);
  });

  it('changes the selection at the luminance where the two ratios are equal', () => {
    // Equal ratios occur at luminance sqrt(1.05 * 0.05) - 0.05. Gray #757575 is below, #767676 is above.
    expect(chooseForeground(parseBackdrop('#757575')).foreground).toBe('white');
    expect(chooseForeground(parseBackdrop('#767676')).foreground).toBe('black');
  });

  it('rejects a background that is not opaque', () => {
    expect(() => chooseForeground({ r: 1, g: 1, b: 1, a: 0.5 })).toThrow(RangeError);
    expect(() => chooseForeground({ r: 1, g: 1, b: 1, a: 0 })).toThrow(RangeError);
  });
});

describe('selectByRatio', () => {
  it('selects black for a tie', () => {
    expect(selectByRatio(4.5, 4.5)).toEqual({ foreground: 'black', contrastRatio: 4.5 });
  });

  it('selects the larger ratio', () => {
    expect(selectByRatio(4.6, 4.5)).toEqual({ foreground: 'black', contrastRatio: 4.6 });
    expect(selectByRatio(4.5, 4.6)).toEqual({ foreground: 'white', contrastRatio: 4.6 });
  });
});
