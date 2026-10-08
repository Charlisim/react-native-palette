import type { CaptureRequest, CaptureSample } from 'palette-react-native/src/adapters/types';
import { PaletteError } from 'palette-react-native/src/errors';
import type { ViewRef } from 'palette-react-native/src/types';

import { withAbort } from './abort';
import type { CaptureDetail, EffectHit, SamplerMode, SpikeCaptureAdapter } from './PaletteSampler.types';

// No top-level browser access and no top-level import of the DOM renderer. This file is safe for SSR.

function elementOf(view: ViewRef): HTMLElement {
  const element = view.current;
  if (typeof HTMLElement === 'undefined' || !(element instanceof HTMLElement) || !element.isConnected) {
    throw new PaletteError(
      'INVALID_VIEW_RELATIONSHIP',
      'A view reference is not a connected DOM element. On iOS and Android, set collapsable={false} on the view.',
    );
  }
  return element;
}

function snapshot(element: HTMLElement) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    transform: style.transform,
    pointerEvents: style.pointerEvents,
    rect: [rect.left, rect.top, rect.width, rect.height],
    ariaHidden: element.getAttribute('aria-hidden'),
    ignoreAttribute: element.getAttribute('data-html2canvas-ignore'),
    childIndex: element.parentElement ? Array.from(element.parentElement.children).indexOf(element) : -1,
  };
}

// The point mapping uses bounding rectangles. That is exact for translation only.
function assertTranslationOnly(foreground: HTMLElement, root: HTMLElement): void {
  for (let node: HTMLElement | null = foreground; node && node !== root; node = node.parentElement) {
    const transform = getComputedStyle(node).transform;
    if (transform && transform !== 'none') {
      const matrix = new DOMMatrixReadOnly(transform);
      if (!matrix.is2D || matrix.a !== 1 || matrix.b !== 0 || matrix.c !== 0 || matrix.d !== 1) {
        throw new PaletteError(
          'UNSUPPORTED_CONTENT',
          'The web adapter supports translation only between the foreground and the capture root.',
        );
      }
    }
  }
}

// The DOM renderer skips a cross-origin image without an error. Reject it before the capture.
function assertSameOriginImages(root: HTMLElement, foreground: HTMLElement): void {
  const urls: string[] = [];
  const visit = (element: Element) => {
    if (element === foreground) {
      return;
    }
    if (element instanceof HTMLImageElement && element.currentSrc) {
      urls.push(element.currentSrc);
    }
    const background = getComputedStyle(element).backgroundImage;
    for (const match of background.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (match[1]) {
        urls.push(match[1]);
      }
    }
    Array.from(element.children).forEach(visit);
  };
  visit(root);
  for (const url of urls) {
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      continue;
    }
    if (new URL(url, location.href).origin !== location.origin) {
      throw new PaletteError('UNSUPPORTED_CONTENT', `The capture root contains a cross-origin image: ${url}`);
    }
  }
}

// The DOM renderer does not draw `backdrop-filter` or `filter`. List the elements that have one.
function collectEffects(root: HTMLElement, foreground: HTMLElement, clientX: number, clientY: number): EffectHit[] {
  const hits: EffectHit[] = [];
  const active = (value: string | undefined) => value !== undefined && value !== '' && value !== 'none';
  const visit = (element: Element) => {
    if (element === foreground) {
      return;
    }
    const style = getComputedStyle(element);
    if (style.display === 'none') {
      return;
    }
    const backdrop =
      style.backdropFilter ?? (style as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter;
    const names = [
      active(backdrop) ? `backdrop-filter: ${backdrop}` : undefined,
      active(style.filter) ? `filter: ${style.filter}` : undefined,
    ].filter((name): name is string => name !== undefined);
    if (names.length > 0) {
      const rect = element.getBoundingClientRect();
      hits.push({
        name: names.join('; '),
        containsPoint:
          clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom,
      });
    }
    Array.from(element.children).forEach(visit);
  };
  visit(root);
  return hits;
}

/** Web backend: `html2canvas-pro` DOM render with `ignoreElements` and a one-pixel read. */
export function createCaptureAdapter(): SpikeCaptureAdapter {
  let mode: SamplerMode = 'normal';
  let detail: CaptureDetail | undefined;

  async function run(request: CaptureRequest, requestMode: SamplerMode): Promise<CaptureSample> {
    if (typeof document === 'undefined') {
      throw new PaletteError('CAPTURE_FAILED', 'No DOM is available.');
    }
    const started = performance.now();
    const root = elementOf(request.captureRoot);
    const foreground = elementOf(request.foreground);
    if (root === foreground || !root.contains(foreground)) {
      throw new PaletteError('INVALID_VIEW_RELATIONSHIP', 'The foreground is not a descendant of the capture root.');
    }
    const rootRect = root.getBoundingClientRect();
    const foregroundRect = foreground.getBoundingClientRect();
    if (rootRect.width <= 0 || rootRect.height <= 0 || foregroundRect.width <= 0 || foregroundRect.height <= 0) {
      throw new PaletteError('NOT_READY', 'The capture root or the foreground has a zero size.');
    }
    assertTranslationOnly(foreground, root);
    const captureX = foregroundRect.left - rootRect.left + request.point.x;
    const captureY = foregroundRect.top - rootRect.top + request.point.y;
    if (captureX < 0 || captureY < 0 || captureX >= rootRect.width || captureY >= rootRect.height) {
      throw new PaletteError('INVALID_POINT', `The mapped point (${captureX}, ${captureY}) is outside the capture root.`);
    }
    if (requestMode !== 'skipOriginCheck') {
      assertSameOriginImages(root, foreground);
    }

    const effects = collectEffects(root, foreground, rootRect.left + captureX, rootRect.top + captureY);
    const hit = requestMode === 'skipEffectCheck' ? undefined : effects.find((effect) => effect.containsPoint);
    if (hit) {
      throw new PaletteError(
        'UNSUPPORTED_CONTENT',
        `An element with an effect (${hit.name}) covers the sample point. The capture cannot render this effect.`,
      );
    }

    // Rounding rule: the physical pixel that contains the logical point.
    const scale = window.devicePixelRatio || 1;
    const pixelX = Math.floor(captureX * scale);
    const pixelY = Math.floor(captureY * scale);

    const before = snapshot(foreground);
    const mutations: string[] = [];
    const describe = (records: MutationRecord[]) =>
      records.forEach((record) =>
        mutations.push(`${record.type}:${record.attributeName ?? ''}:${(record.target as Element).tagName ?? 'text'}`),
      );
    const observer = new MutationObserver(describe);
    observer.observe(root, { attributes: true, childList: true, characterData: true, subtree: true });

    let data: Uint8ClampedArray;
    try {
      if (requestMode === 'failAfterHide') {
        throw new PaletteError('CAPTURE_FAILED', 'Forced failure (debug mode).');
      }
      const { default: html2canvas } = await import('html2canvas-pro');
      const canvas = await html2canvas(root, {
        backgroundColor: null,
        scale,
        x: pixelX / scale,
        y: pixelY / scale,
        width: 1,
        height: 1,
        logging: false,
        // The filter runs on the clone pass. The live DOM does not change.
        ignoreElements: (element) => requestMode !== 'skipExclusion' && element === foreground,
        // The opacity of the capture root is not part of the sample. Only the clone changes.
        onclone: (_document, clonedRoot) => {
          clonedRoot.style.opacity = '1';
        },
      });
      const context = canvas.getContext('2d');
      if (!context) {
        throw new PaletteError('CAPTURE_FAILED', 'The canvas context is not available.');
      }
      try {
        data = context.getImageData(0, 0, 1, 1).data;
      } catch (error) {
        throw new PaletteError('UNSUPPORTED_CONTENT', 'The canvas is tainted. The pixel is not readable.', {
          cause: error,
        });
      }
    } catch (error) {
      if (error instanceof PaletteError) {
        throw error;
      }
      throw new PaletteError('CAPTURE_FAILED', 'The DOM render failed.', { cause: error });
    } finally {
      describe(observer.takeRecords());
      observer.disconnect();
    }

    detail = {
      pixel: { x: pixelX, y: pixelY },
      scale,
      exclusion: requestMode === 'skipExclusion' ? 'none' : 'ignoreElements',
      before,
      during: before,
      after: snapshot(foreground),
      captureMs: performance.now() - started,
      rootMutations: mutations.length,
      rootMutationKinds: mutations,
      effects,
    };
    // `getImageData` returns straight alpha in the canvas color space (sRGB by default).
    return {
      rgba: {
        r: (data[0] ?? 0) / 255,
        g: (data[1] ?? 0) / 255,
        b: (data[2] ?? 0) / 255,
        a: (data[3] ?? 0) / 255,
      },
      capturePoint: { x: captureX, y: captureY },
      bitmapScale: scale,
    };
  }

  return {
    backend: 'web-html2canvas-pro',
    setMode(next) {
      mode = next;
    },
    lastDetail: () => detail,
    capture: (request) => withAbort(request.signal, run(request, mode)),
    inspect: async (view) => snapshot(elementOf(view)),
    async locate(view) {
      const rect = elementOf(view).getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height, scale: window.devicePixelRatio || 1 };
    },
  };
}
