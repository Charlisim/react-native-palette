import { PaletteError } from '../../errors';
import type { RGBA } from '../../types';
import { parseBackdrop, resolveBackdrop } from '../color';

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof PaletteError ? error.code : `unexpected: ${String(error)}`;
  }
  return undefined;
}

describe('parseBackdrop', () => {
  it('parses an opaque #rrggbb color', () => {
    expect(parseBackdrop('#ffffff')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseBackdrop('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(parseBackdrop('#FF9500')).toEqual({ r: 1, g: 149 / 255, b: 0, a: 1 });
  });

  it.each([
    '#fff',
    '#ffffff80',
    '#ffff',
    'ffffff',
    'white',
    'rgb(255, 255, 255)',
    'rgba(255, 255, 255, 0.5)',
    '#gggggg',
    ' #ffffff',
    '#ffffff\n',
    '',
  ])('rejects %j', (input) => {
    expect(codeOf(() => parseBackdrop(input))).toBe('UNRESOLVED_BACKDROP');
  });

  it('rejects a value that is not a string', () => {
    expect(codeOf(() => parseBackdrop(0xffffff as unknown as string))).toBe('UNRESOLVED_BACKDROP');
  });
});

describe('resolveBackdrop', () => {
  const white: RGBA = { r: 1, g: 1, b: 1, a: 1 };

  it('returns an opaque sample unchanged', () => {
    const sample: RGBA = { r: 0.2, g: 0.4, b: 0.6, a: 1 };
    expect(resolveBackdrop(sample)).toBe(sample);
    expect(resolveBackdrop(sample, white)).toBe(sample);
  });

  it('composites 50% black over white', () => {
    const resolved = resolveBackdrop({ r: 0, g: 0, b: 0, a: 0.5 }, white);
    expect(resolved).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
  });

  it('returns the backdrop for a fully transparent sample', () => {
    expect(resolveBackdrop({ r: 1, g: 0, b: 0, a: 0 }, white)).toEqual(white);
  });

  it('composites with straight alpha', () => {
    const resolved = resolveBackdrop({ r: 1, g: 0, b: 0, a: 0.25 }, { r: 0, g: 0, b: 1, a: 1 });
    expect(resolved).toEqual({ r: 0.25, g: 0, b: 0.75, a: 1 });
  });

  it('throws UNRESOLVED_BACKDROP for a translucent sample without a backdrop', () => {
    expect(codeOf(() => resolveBackdrop({ r: 0, g: 0, b: 0, a: 0.5 }))).toBe('UNRESOLVED_BACKDROP');
    expect(codeOf(() => resolveBackdrop({ r: 0, g: 0, b: 0, a: 0 }))).toBe('UNRESOLVED_BACKDROP');
  });

  it('rejects a translucent backdrop', () => {
    expect(
      codeOf(() => resolveBackdrop({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 1, g: 1, b: 1, a: 0.5 })),
    ).toBe('UNRESOLVED_BACKDROP');
  });
});
