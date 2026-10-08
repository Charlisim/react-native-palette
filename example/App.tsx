import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { CaptureAdapter, CaptureSample } from 'palette-react-native/src/adapters/types';
import { PaletteError } from 'palette-react-native/src/errors';
import { createSampleContrast } from 'palette-react-native/src/sampleContrast';
import type { Foreground, SampleContrastResult } from 'palette-react-native/src/types';

import { createCaptureAdapter, type SamplerMode } from './modules/palette-sampler';
import { createViewShotAdapter } from './src/baseline/viewShotAdapter';
import {
  COMPOSITOR_MODES,
  EffectsPage,
  FX_PAGES,
  FX_ROOTS,
  glassAvailable,
  imagesOnPage,
  runEffectsLatency,
  runEffectsPage,
  useFxRefs,
  type FxRec,
} from './src/effects';
import {
  CLEAR,
  FOREGROUND,
  FRAME,
  MAGENTA,
  MAIN,
  OVERLAY,
  PRESETS,
  RESIDUAL,
  ROOT_TRANSFORM,
  SCROLL,
  SCROLL_BLOCKS,
  TRANSPARENT_CHILD,
  WHITE,
  css,
  expectedContain,
  expectedCover,
  expectedMain,
  expectedResidual,
  expectedScroll,
  type PresetId,
  type Pt,
  type Rgba8,
} from './src/fixture';

/** Contract v1 raster tolerance: maximum difference for each 8-bit channel. */
const TOLERANCE = 1;
/** Maximum difference of the capture point in logical units. */
const POINT_TOLERANCE = 0.5;
const LATENCY_N = 200;
const BASELINE_LATENCY_N = 30;
const FLASH_MS = 5000;
const IMAGES = Platform.OS === 'web' ? 4 : 3;

type RootId =
  | 'main'
  | 'scroll'
  | 'cover'
  | 'contain'
  | 'residual'
  | 'zero'
  | 'opacity'
  | 'flat'
  | 'cross'
  | 'rootTranslate'
  | 'rootScale'
  | 'rootRotate';
type FgId =
  | 'move'
  | 'child'
  | 'scroll'
  | 'cover1'
  | 'cover2'
  | 'contain1'
  | 'contain2'
  | 'contain3'
  | 'resid1'
  | 'resid2'
  | 'zero'
  | 'opacity'
  | 'flat'
  | 'cross'
  | 'unmount'
  | 'rootTranslate'
  | 'rootScale'
  | 'rootRotate';

type Expectation =
  | { kind: 'color'; capture: Pt; rgba8: Rgba8; foreground: Foreground }
  | { kind: 'error'; code: string; sampled?: Rgba8; messageIncludes?: string }
  | { kind: 'observe' };

interface Case {
  id: string;
  root: RootId;
  fg: FgId;
  preset?: PresetId;
  point?: Pt;
  backdrop?: string;
  mode?: SamplerMode;
  only?: readonly string[];
  expect: Expectation;
  /** The web adapter supports a smaller transform subset. */
  webExpect?: Expectation;
  special?: 'abort' | 'unmount';
  /** Text for the record of an observation. */
  hint?: string;
}

const color = (capture: Pt, rgba8: Rgba8, foreground: Foreground): Expectation => ({
  kind: 'color',
  capture,
  rgba8,
  foreground,
});
const main = (x: number, y: number, foreground: Foreground) => color({ x, y }, expectedMain({ x, y }), foreground);
const UNSUPPORTED: Expectation = { kind: 'error', code: 'UNSUPPORTED_CONTENT' };
const NATIVE = ['ios', 'android'];
const ROOT_LOCAL_HINT = 'root-local rule gives 0,0,0,255 at (55, 5); a screen-space mapping gives a different point';

const CASES: readonly Case[] = [
  { id: 'image-white', root: 'main', fg: 'move', preset: 'tl-white', expect: main(20, 20, 'black') },
  { id: 'image-black', root: 'main', fg: 'move', preset: 'tr-black', expect: main(220, 20, 'white') },
  { id: 'image-orange', root: 'main', fg: 'move', preset: 'bl-orange', expect: main(20, 250, 'black') },
  { id: 'image-blue', root: 'main', fg: 'move', preset: 'br-blue', expect: main(220, 250, 'white') },
  { id: 'overlay-on-white', root: 'main', fg: 'move', preset: 'overlay-white', expect: main(85, 90, 'black') },
  { id: 'overlay-on-black', root: 'main', fg: 'move', preset: 'overlay-black', expect: main(160, 90, 'white') },
  { id: 'overlay-on-orange', root: 'main', fg: 'move', preset: 'overlay-orange', expect: main(85, 180, 'white') },
  { id: 'overlay-on-blue', root: 'main', fg: 'move', preset: 'overlay-blue', expect: main(160, 180, 'white') },
  {
    id: 'explicit-point',
    root: 'main',
    fg: 'move',
    preset: 'explicit-point',
    point: { x: 30, y: 10 },
    expect: main(160, 30, 'white'),
  },
  { id: 'transparent-child', root: 'main', fg: 'child', expect: main(85, 265, 'black') },
  // Only the requested foreground is excluded. A different foreground is part of the background.
  {
    id: 'other-foreground-stays',
    root: 'main',
    fg: 'move',
    preset: 'over-child',
    expect: color({ x: 100, y: 275 }, MAGENTA, 'black'),
  },
  { id: 'transform-translate', root: 'main', fg: 'move', preset: 'translate', expect: main(220, 20, 'white') },
  {
    id: 'transform-scale',
    root: 'main',
    fg: 'move',
    preset: 'scale',
    point: { x: 45, y: 5 },
    expect: main(160, 35, 'white'),
    webExpect: UNSUPPORTED,
  },
  {
    id: 'transform-rotate',
    root: 'main',
    fg: 'move',
    preset: 'rotate',
    expect: main(165, 25, 'white'),
    webExpect: UNSUPPORTED,
  },
  // Contract v1: a perspective transform is not supported on a platform.
  { id: 'transform-perspective', root: 'main', fg: 'move', preset: 'perspective', expect: UNSUPPORTED },
  {
    id: 'scroll-offset',
    root: 'scroll',
    fg: 'scroll',
    expect: color({ x: 20, y: 50 }, expectedScroll({ x: 20, y: 50 }, SCROLL.offset), 'white'),
  },
  { id: 'cover-yellow', root: 'cover', fg: 'cover1', expect: color({ x: 20, y: 20 }, expectedCover({ x: 20, y: 20 }), 'black') },
  { id: 'cover-purple', root: 'cover', fg: 'cover2', expect: color({ x: 200, y: 100 }, expectedCover({ x: 200, y: 100 }), 'white') },
  { id: 'contain-red', root: 'contain', fg: 'contain1', expect: color({ x: 100, y: 10 }, expectedContain({ x: 100, y: 10 }), 'black') },
  { id: 'contain-letterbox', root: 'contain', fg: 'contain2', expect: color({ x: 5, y: 10 }, expectedContain({ x: 5, y: 10 }), 'black') },
  { id: 'contain-cyan', root: 'contain', fg: 'contain3', expect: color({ x: 160, y: 120 }, expectedContain({ x: 160, y: 120 }), 'black') },
  {
    id: 'residual-no-backdrop',
    root: 'residual',
    fg: 'resid1',
    expect: { kind: 'error', code: 'UNRESOLVED_BACKDROP', sampled: expectedResidual({ x: 10, y: 10 }) },
  },
  {
    id: 'residual-backdrop-white',
    root: 'residual',
    fg: 'resid1',
    backdrop: '#ffffff',
    expect: color({ x: 10, y: 10 }, CLEAR, 'black'),
  },
  {
    id: 'residual-backdrop-black',
    root: 'residual',
    fg: 'resid1',
    backdrop: '#000000',
    expect: color({ x: 10, y: 10 }, CLEAR, 'white'),
  },
  {
    id: 'residual-half-no-backdrop',
    root: 'residual',
    fg: 'resid2',
    expect: { kind: 'error', code: 'UNRESOLVED_BACKDROP', sampled: expectedResidual({ x: 120, y: 10 }) },
  },
  {
    id: 'residual-half-backdrop-white',
    root: 'residual',
    fg: 'resid2',
    backdrop: '#ffffff',
    expect: color({ x: 120, y: 10 }, expectedResidual({ x: 120, y: 10 }), 'black'),
  },
  { id: 'error-not-descendant', root: 'main', fg: 'resid1', expect: { kind: 'error', code: 'INVALID_VIEW_RELATIONSHIP' } },
  {
    id: 'error-point-outside',
    root: 'main',
    fg: 'move',
    preset: 'tl-white',
    point: { x: 1000, y: 0 },
    expect: { kind: 'error', code: 'INVALID_POINT' },
  },
  { id: 'error-zero-size-root', root: 'zero', fg: 'zero', expect: { kind: 'error', code: 'NOT_READY' } },
  {
    id: 'error-invalid-backdrop',
    root: 'main',
    fg: 'move',
    preset: 'tl-white',
    backdrop: '#fff',
    expect: { kind: 'error', code: 'INVALID_BACKDROP' },
  },
  // No `collapsable={false}`: React Native flattens the root. The message must name the cause.
  {
    id: 'error-flattened-root',
    root: 'flat',
    fg: 'flat',
    only: NATIVE,
    expect: { kind: 'error', code: 'INVALID_VIEW_RELATIONSHIP', messageIncludes: 'collapsable={false}' },
  },
  // Contract v1: the opacity of the capture root is not part of the sample.
  { id: 'root-opacity-excluded', root: 'opacity', fg: 'opacity', expect: color({ x: 10, y: 5 }, WHITE, 'black') },
  {
    id: 'error-cross-origin-image',
    root: 'cross',
    fg: 'cross',
    only: ['web'],
    expect: { kind: 'error', code: 'UNSUPPORTED_CONTENT' },
  },
  { id: 'observe-cross-origin-unchecked', root: 'cross', fg: 'cross', only: ['web'], mode: 'skipOriginCheck', expect: { kind: 'observe' } },
  {
    id: 'negative-control-no-exclusion',
    root: 'main',
    fg: 'move',
    preset: 'tl-white',
    mode: 'skipExclusion',
    expect: color({ x: 20, y: 20 }, MAGENTA, 'black'),
  },
  {
    id: 'restore-after-forced-error',
    root: 'main',
    fg: 'move',
    preset: 'tl-white',
    mode: 'failAfterHide',
    expect: { kind: 'error', code: 'CAPTURE_FAILED' },
  },
  {
    id: 'restore-after-abort',
    root: 'main',
    fg: 'move',
    preset: 'tl-white',
    special: 'abort',
    expect: { kind: 'error', code: 'ABORTED' },
  },
  {
    id: 'android-visibility-exclusion',
    root: 'main',
    fg: 'move',
    preset: 'tl-white',
    mode: 'visibility',
    only: ['android'],
    expect: main(20, 20, 'black'),
  },
  { id: 'observe-unmount-in-flight', root: 'residual', fg: 'unmount', special: 'unmount', expect: { kind: 'observe' } },
  // The transform of the capture root itself. Contract v1 does not define it. These cases record it.
  { id: 'observe-root-translate', root: 'rootTranslate', fg: 'rootTranslate', expect: { kind: 'observe' }, hint: ROOT_LOCAL_HINT },
  { id: 'observe-root-scale', root: 'rootScale', fg: 'rootScale', expect: { kind: 'observe' }, hint: ROOT_LOCAL_HINT },
  { id: 'observe-root-rotate', root: 'rootRotate', fg: 'rootRotate', expect: { kind: 'observe' }, hint: ROOT_LOCAL_HINT },
  // EXPERIMENTAL compositor modes. Magenta means that the foreground is in the capture.
  ...COMPOSITOR_MODES.map(
    (mode): Case => ({
      id: `observe-${mode}-exclusion`,
      root: 'main',
      fg: 'move',
      preset: 'tl-white',
      mode,
      expect: { kind: 'observe' },
      hint: 'excluded foreground gives 255,255,255,255; magenta means that the foreground is in the capture',
    }),
  ),
];

const MARKER_COLORS: Record<string, string> = {
  primary: '#00ffc8',
  baseline: '#ffc800',
  dhRootFalse: '#0064ff',
  dhRootTrue: '#78ff00',
  dhWindowFalse: '#00c864',
  dhWindowTrue: '#9664ff',
};

const BASELINE_CASES = ['image-white', 'image-blue', 'overlay-on-orange', 'explicit-point', 'transform-translate'];

const now = () => performance.now();
const round = (value: number) => Math.round(value * 1000) / 1000;
const frames = (count: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(count);
  });
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, inner) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner as object).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );
}

const to8 = (c: { r: number; g: number; b: number; a: number }): Rgba8 => [
  round(c.r * 255),
  round(c.g * 255),
  round(c.b * 255),
  round(c.a * 255),
];
const maxDelta = (a: Rgba8, b: Rgba8) => Math.max(...a.map((value, i) => Math.abs(value - b[i]!)));

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? NaN);
}

interface Rec {
  id: string;
  backend: string;
  expected: unknown;
  sampled?: Rgba8;
  resolved?: Rgba8;
  foreground?: Foreground;
  ratio?: number;
  capturePoint?: Pt;
  pixel?: Pt;
  scale?: number;
  error?: string;
  channelDelta?: number;
  pointDelta?: number;
  exclusion?: string;
  hiddenDuringCapture?: boolean;
  stateRestored?: boolean;
  rootMutations?: number;
  ms: number;
  pass: boolean | null;
  note?: string;
}

function Fg(props: { fgRef: React.Ref<View>; style?: StyleProp<ViewStyle>; textColor: string; testID?: string }) {
  return (
    <View ref={props.fgRef} collapsable={false} style={[styles.fg, props.style]} testID={props.testID}>
      <Text style={[styles.fgText, { color: props.textColor }]}>Aa</Text>
      <View style={styles.fgNested}>
        <View style={styles.fgNestedInner} />
      </View>
    </View>
  );
}

export default function App() {
  const adapter = useMemo(() => createCaptureAdapter(), []);
  const lastSample = useRef<CaptureSample | undefined>(undefined);
  const recordingAdapter = useMemo<CaptureAdapter>(
    () => ({
      async capture(request) {
        const sample = await adapter.capture(request);
        lastSample.current = sample;
        return sample;
      },
    }),
    [adapter],
  );
  const sampleContrast = useMemo(() => createSampleContrast(recordingAdapter), [recordingAdapter]);

  const rootRefs = useRef<Record<RootId, React.RefObject<View | null>>>({
    main: { current: null },
    scroll: { current: null },
    cover: { current: null },
    contain: { current: null },
    residual: { current: null },
    zero: { current: null },
    opacity: { current: null },
    flat: { current: null },
    cross: { current: null },
    rootTranslate: { current: null },
    rootScale: { current: null },
    rootRotate: { current: null },
  }).current;
  const fgRefs = useRef<Record<FgId, React.RefObject<View | null>>>({
    move: { current: null },
    child: { current: null },
    scroll: { current: null },
    cover1: { current: null },
    cover2: { current: null },
    contain1: { current: null },
    contain2: { current: null },
    contain3: { current: null },
    resid1: { current: null },
    resid2: { current: null },
    zero: { current: null },
    opacity: { current: null },
    flat: { current: null },
    cross: { current: null },
    unmount: { current: null },
    rootTranslate: { current: null },
    rootScale: { current: null },
    rootRotate: { current: null },
  }).current;
  const fxRefs = useFxRefs();
  const [fxPage, setFxPage] = useState<number | null>(null);
  const fxLoad = useRef<{ left: number; done: () => void } | null>(null);
  const onFxLoad = useCallback(() => {
    const pending = fxLoad.current;
    if (pending && (pending.left -= 1) <= 0) {
      pending.done();
    }
  }, []);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);

  const [preset, setPreset] = useState<PresetId>('tl-white');
  const [colors, setColors] = useState<Partial<Record<FgId, Foreground>>>({});
  const [loaded, setLoaded] = useState(0);
  const [records, setRecords] = useState<Rec[]>([]);
  const [status, setStatus] = useState('Waiting for layout and image load');
  const [marker, setMarker] = useState<string | null>(null);
  const [showUnmount, setShowUnmount] = useState(true);
  const [manual, setManual] = useState<string>('');
  const running = useRef(false);

  // Baseline only: JS exclusion with `opacity: 0`.
  const [baselineHidden, setBaselineHidden] = useState(false);
  const baselineCommit = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    baselineCommit.current?.();
    baselineCommit.current = null;
  }, [baselineHidden]);
  const viewShot = useMemo(
    () =>
      createViewShotAdapter?.({
        setExcluded: (_foreground, excluded) =>
          new Promise<void>((resolve) => {
            baselineCommit.current = resolve;
            setBaselineHidden(excluded);
          }),
      }),
    [],
  );
  const baselineSample = useMemo(() => (viewShot ? createSampleContrast(viewShot) : undefined), [viewShot]);

  const pulse = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    // A permanent native animation. Each display frame differs, so a screen record keeps each frame.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0.2, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Web only: the same fixture from a second origin. `127.0.0.1` and `localhost` are different origins.
  const [crossUri, setCrossUri] = useState<string | undefined>(undefined);
  const onImageLoad = useCallback(() => {
    setLoaded((count) => count + 1);
    if (Platform.OS === 'web') {
      const image = document.querySelector<HTMLImageElement>('[data-testid="root-main"] img');
      if (image?.src) {
        const url = new URL(image.src);
        url.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
        setCrossUri((previous) => previous ?? url.href);
      }
    }
  }, []);

  const moveTo = useCallback(async (next: PresetId) => {
    setPreset(next);
    await frames(3);
  }, []);

  const runCase = useCallback(
    async (c: Case): Promise<Rec> => {
      const expectation = Platform.OS === 'web' && c.webExpect ? c.webExpect : c.expect;
      if (c.preset) {
        await moveTo(c.preset);
      }
      const captureRoot = rootRefs[c.root];
      const foreground = fgRefs[c.fg];
      const inspect = () => adapter.inspect(foreground).then(stable, (error: unknown) => `inspect failed: ${String(error)}`);
      const stateBefore = await inspect();
      adapter.setMode(c.mode ?? 'normal');
      lastSample.current = undefined;

      let result: SampleContrastResult | undefined;
      let error: unknown;
      let note: string | undefined;
      const started = now();
      try {
        if (c.special === 'abort') {
          const controller = new AbortController();
          const pending = sampleContrast({ captureRoot, foreground, signal: controller.signal });
          controller.abort();
          result = await pending;
        } else if (c.special === 'unmount') {
          const pending = sampleContrast({ captureRoot, foreground, backdrop: '#ffffff' });
          setShowUnmount(false);
          const outcome = await Promise.race([
            pending.then(
              () => 'resolved',
              (reason: unknown) => `rejected ${reason instanceof PaletteError ? reason.code : String(reason)}`,
            ),
            sleep(3000).then(() => 'NOT SETTLED after 3000 ms'),
          ]);
          note = `request ${outcome}`;
        } else {
          result = await sampleContrast({ captureRoot, foreground, point: c.point, backdrop: c.backdrop });
        }
      } catch (caught) {
        error = caught;
      }
      const ms = round(now() - started);
      adapter.setMode('normal');
      if (c.special === 'abort') {
        // The native block completes after the rejection. Read the state after it.
        await sleep(100);
      }
      const stateAfter = c.special === 'unmount' ? stateBefore : await inspect();
      const detail = error === undefined && c.special !== 'unmount' ? adapter.lastDetail() : undefined;
      const sample = lastSample.current as CaptureSample | undefined;

      const rec: Rec = { id: c.id, backend: adapter.backend, expected: expectation, ms, pass: null, note: note ?? c.hint };
      if (sample) {
        rec.sampled = to8(sample.rgba);
        rec.capturePoint = { x: round(sample.capturePoint.x), y: round(sample.capturePoint.y) };
        rec.scale = sample.bitmapScale;
      }
      if (detail) {
        rec.pixel = detail.pixel;
        rec.exclusion = detail.exclusion;
        rec.hiddenDuringCapture = stable(detail.during) !== stable(detail.before);
        rec.rootMutations = detail.rootMutations;
        if (detail.rootMutationKinds?.length) rec.note = `mutations: ${detail.rootMutationKinds.join(' ')}`;
      }
      rec.stateRestored =
        stateBefore === stateAfter && (!detail || stable(detail.before) === stable(detail.after));
      if (result) {
        rec.resolved = to8(result.resolvedRGBA);
        rec.foreground = result.foreground;
        rec.ratio = round(result.contrastRatio);
        setColors((previous) => ({ ...previous, [c.fg]: result.foreground }));
      }
      if (error !== undefined) {
        rec.error = error instanceof PaletteError ? error.code : `UNEXPECTED ${String(error)}`;
        if (!(error instanceof PaletteError) || c.expect.kind === 'observe' || expectation.kind === 'error') {
          rec.note = String((error as Error)?.message ?? error).slice(0, 200);
        }
      }

      if (expectation.kind === 'color') {
        if (rec.sampled && rec.capturePoint && result) {
          rec.channelDelta = round(maxDelta(rec.sampled, expectation.rgba8));
          rec.pointDelta = round(
            Math.max(
              Math.abs(rec.capturePoint.x - expectation.capture.x),
              Math.abs(rec.capturePoint.y - expectation.capture.y),
            ),
          );
          rec.pass =
            rec.channelDelta <= TOLERANCE &&
            rec.pointDelta <= POINT_TOLERANCE &&
            rec.foreground === expectation.foreground &&
            rec.stateRestored;
        } else {
          rec.pass = false;
        }
      } else if (expectation.kind === 'error') {
        rec.pass = rec.error === expectation.code && rec.stateRestored;
        if (expectation.messageIncludes) {
          rec.pass = rec.pass && String((error as Error)?.message ?? '').includes(expectation.messageIncludes);
        }
        if (expectation.sampled) {
          rec.channelDelta = rec.sampled ? round(maxDelta(rec.sampled, expectation.sampled)) : undefined;
          rec.pass = rec.pass && rec.channelDelta !== undefined && rec.channelDelta <= TOLERANCE;
        }
      }
      return rec;
    },
    [adapter, fgRefs, moveTo, rootRefs, sampleContrast],
  );

  const runSuite = useCallback(async () => {
    if (running.current) {
      return;
    }
    running.current = true;
    const emit = (tag: string, payload: unknown) => console.log(`${tag} ${JSON.stringify(payload)}`);
    const all: Rec[] = [];
    try {
      setStatus('Running');
      setShowUnmount(true);
      scrollRef.current?.scrollTo({ y: SCROLL.offset, animated: false });
      await sleep(500);
      await frames(3);
      const environment = {
        platform: Platform.OS,
        platformVersion: Platform.Version,
        devicePixelRatio: PixelRatio.get(),
        backend: adapter.backend,
        tolerance: TOLERANCE,
        pointTolerance: POINT_TOLERANCE,
        scrollOffset: scrollOffset.current,
        userAgent: Platform.OS === 'web' ? navigator.userAgent : undefined,
      };
      emit('SPIKE_ENV', environment);

      for (const c of CASES) {
        if (c.only && !c.only.includes(Platform.OS)) {
          continue;
        }
        const rec = await runCase(c);
        all.push(rec);
        emit('SPIKE_CASE', rec);
        setRecords([...all]);
      }

      // Repeated captures: latency, correctness of each sample, and the final state.
      await moveTo('tl-white');
      const loopState = await adapter.inspect(fgRefs.move).then(stable);
      const request = { captureRoot: rootRefs.main, foreground: fgRefs.move };
      const repeat = Platform.OS === 'web' ? 30 : LATENCY_N;
      const total: number[] = [];
      const capture: number[] = [];
      let wrong = 0;
      let notRestored = 0;
      for (let i = 0; i < repeat; i += 1) {
        const started = now();
        // A rejection counts as a wrong sample. The loop continues.
        const result = await sampleContrast(request).catch(() => undefined);
        total.push(now() - started);
        const detail = adapter.lastDetail();
        capture.push(detail?.captureMs ?? NaN);
        if (!result || maxDelta(to8(result.sampledRGBA), WHITE) > TOLERANCE) wrong += 1;
        if (!detail || stable(detail.before) !== stable(detail.after)) notRestored += 1;
      }
      const latency = {
        backend: adapter.backend,
        n: repeat,
        p50: percentile(total, 50),
        p95: percentile(total, 95),
        max: round(Math.max(...total)),
        captureP50: percentile(capture, 50),
        captureP95: percentile(capture, 95),
        wrongSamples: wrong,
        notRestored,
        finalStateEqual: (await adapter.inspect(fgRefs.move).then(stable)) === loopState,
      };
      emit('SPIKE_LATENCY', latency);

      // Flash check: the marker is visible while the loop runs. A screen record covers this phase.
      setMarker('primary');
      await sleep(700);
      let flashSamples = 0;
      const flashEnd = now() + FLASH_MS;
      let flashWrong = 0;
      while (now() < flashEnd) {
        const result = await sampleContrast(request).catch(() => undefined);
        if (!result || maxDelta(to8(result.sampledRGBA), WHITE) > TOLERANCE) flashWrong += 1;
        flashSamples += 1;
      }
      await sleep(300);
      setMarker(null);
      await sleep(700);
      emit('SPIKE_FLASH', { backend: adapter.backend, durationMs: FLASH_MS, samples: flashSamples, wrongSamples: flashWrong });

      // EXPERIMENTAL. The same flash check for each compositor mode that hides the foreground (iOS).
      for (const mode of COMPOSITOR_MODES.filter((candidate) => candidate !== 'pixelCopy')) {
        adapter.setMode(mode);
        setMarker(mode);
        await sleep(700);
        let samples = 0;
        let magenta = 0;
        let errors = 0;
        const end = now() + FLASH_MS;
        while (now() < end) {
          const result = await sampleContrast(request).catch(() => undefined);
          if (!result) errors += 1;
          else if (maxDelta(to8(result.sampledRGBA), MAGENTA) <= TOLERANCE) magenta += 1;
          samples += 1;
        }
        adapter.setMode('normal');
        await sleep(300);
        setMarker(null);
        await sleep(700);
        emit('SPIKE_FLASH', { backend: `experimental-${mode}`, durationMs: FLASH_MS, samples, foregroundInSample: magenta, errors });
      }

      // Secondary comparison: react-native-view-shot with a JS `opacity: 0` exclusion.
      let baseline: unknown = 'not available on this platform';
      if (baselineSample && viewShot) {
        const baselineRecs: Rec[] = [];
        for (const id of BASELINE_CASES) {
          const c = CASES.find((candidate) => candidate.id === id)!;
          if (c.expect.kind !== 'color') continue;
          if (c.preset) await moveTo(c.preset);
          const started = now();
          const rec: Rec = { id, backend: 'view-shot-js-opacity', expected: c.expect, ms: 0, pass: false };
          try {
            const result = await baselineSample({ captureRoot: rootRefs[c.root], foreground: fgRefs[c.fg], point: c.point });
            rec.sampled = to8(result.sampledRGBA);
            rec.resolved = to8(result.resolvedRGBA);
            rec.foreground = result.foreground;
            rec.ratio = round(result.contrastRatio);
            rec.capturePoint = result.capturePoint;
            rec.channelDelta = round(maxDelta(rec.sampled, c.expect.rgba8));
            rec.pass = rec.channelDelta <= TOLERANCE && rec.foreground === c.expect.foreground;
            rec.note = JSON.stringify(viewShot.lastBitmap());
          } catch (error) {
            rec.error = error instanceof PaletteError ? error.code : String(error);
            rec.note = String((error as { cause?: unknown })?.cause ?? (error as Error)?.message);
          }
          rec.ms = round(now() - started);
          baselineRecs.push(rec);
          emit('SPIKE_BASELINE_CASE', rec);
        }
        await moveTo('tl-white');
        const baselineTotal: number[] = [];
        let baselineWrong = 0;
        let baselineErrors = 0;
        for (let i = 0; i < BASELINE_LATENCY_N; i += 1) {
          const started = now();
          try {
            const result = await baselineSample(request);
            if (maxDelta(to8(result.sampledRGBA), WHITE) > TOLERANCE) baselineWrong += 1;
          } catch {
            baselineErrors += 1;
          }
          baselineTotal.push(now() - started);
        }
        setMarker('baseline');
        await sleep(700);
        let baselineFlashSamples = 0;
        const baselineEnd = now() + FLASH_MS;
        while (now() < baselineEnd) {
          await baselineSample(request).catch(() => undefined);
          baselineFlashSamples += 1;
        }
        await sleep(300);
        setMarker(null);
        baseline = {
          backend: 'view-shot-js-opacity',
          cases: baselineRecs.length,
          passed: baselineRecs.filter((rec) => rec.pass).length,
          n: BASELINE_LATENCY_N,
          p50: percentile(baselineTotal, 50),
          p95: percentile(baselineTotal, 95),
          wrongSamples: baselineWrong,
          errors: baselineErrors,
          flashSamples: baselineFlashSamples,
        };
        emit('SPIKE_BASELINE', baseline);
      }

      // Blur and Liquid Glass fixture. A host script takes a screenshot at each `SPIKE_FX_SHOT` line.
      const fxRecs: FxRec[] = [];
      for (let page = 0; page < FX_PAGES.length; page += 1) {
        const defs = FX_PAGES[page]!;
        const loadedPage = new Promise<void>((resolve) => {
          fxLoad.current = { left: imagesOnPage(defs), done: resolve };
        });
        setFxPage(page);
        const loadState = await Promise.race([loadedPage.then(() => 'loaded'), sleep(5000).then(() => 'TIMEOUT')]);
        fxLoad.current = null;
        await sleep(1500);
        emit('SPIKE_FX_PAGE', { page, roots: defs.map((def) => def.id), images: loadState, glassAvailable });
        fxRecs.push(...(await runEffectsPage({ adapter, defs, refs: fxRefs, tolerance: TOLERANCE, emit })));
        if (page === 0) {
          await runEffectsLatency({ adapter, defs, refs: fxRefs, emit, count: 30 });
        }
        await sleep(500);
        emit('SPIKE_FX_SHOT', { page });
        await sleep(6000);
      }
      setFxPage(null);
      const fxJudged = fxRecs.filter((rec) => rec.pass !== null);
      const fx = {
        roots: FX_ROOTS.map((def) => def.id),
        cases: fxJudged.length,
        passed: fxJudged.filter((rec) => rec.pass).length,
        failed: fxJudged.filter((rec) => !rec.pass).map((rec) => rec.id),
        observations: fxRecs.length - fxJudged.length,
      };

      const judged = all.filter((rec) => rec.pass !== null);
      const summary = {
        ...environment,
        cases: judged.length,
        passed: judged.filter((rec) => rec.pass).length,
        failed: judged.filter((rec) => !rec.pass).map((rec) => rec.id),
        maxChannelDelta: Math.max(0, ...judged.filter((rec) => rec.pass).map((rec) => rec.channelDelta ?? 0)),
        maxPointDelta: Math.max(0, ...judged.filter((rec) => rec.pass).map((rec) => rec.pointDelta ?? 0)),
        latency,
        baseline,
        fx,
      };
      emit('SPIKE_RESULT', summary);
      (globalThis as { __SPIKE__?: unknown }).__SPIKE__ = { summary, records: all };
      setStatus(`Done: ${summary.passed}/${summary.cases} pass, effects ${fx.passed}/${fx.cases} pass`);
    } catch (error) {
      emit('SPIKE_RESULT', { fatal: String(error), stack: (error as Error)?.stack });
      setStatus(`Suite failure: ${String(error)}`);
    } finally {
      running.current = false;
    }
  }, [adapter, baselineSample, fgRefs, fxRefs, moveTo, rootRefs, runCase, sampleContrast, viewShot]);

  const autoRun = useRef(false);
  useEffect(() => {
    // Readiness: all images report `onLoad`. Layout is complete at that time.
    if (loaded >= IMAGES && !autoRun.current) {
      autoRun.current = true;
      void runSuite();
    }
  }, [loaded, runSuite]);

  const sampleManual = useCallback(
    async (next: PresetId) => {
      if (running.current) {
        return;
      }
      await moveTo(next);
      try {
        const result = await sampleContrast({ captureRoot: rootRefs.main, foreground: fgRefs.move });
        setColors((previous) => ({ ...previous, move: result.foreground }));
        setManual(
          `${next}: sampled ${to8(result.sampledRGBA).join(',')} -> ${result.foreground} (${round(result.contrastRatio)})`,
        );
      } catch (error) {
        setManual(`${next}: ${error instanceof PaletteError ? error.code : String(error)}`);
      }
    },
    [fgRefs, moveTo, rootRefs, sampleContrast],
  );

  const movable = PRESETS[preset] as { left: number; top: number; transform?: ViewStyle['transform'] };
  const text = (id: FgId) => colors[id] ?? 'gray';

  if (fxPage !== null) {
    return (
      <View style={styles.screen}>
        <EffectsPage defs={FX_PAGES[fxPage]!} refs={fxRefs} onLoad={onFxLoad} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          {/* Root A: image, translucent overlay, transparent child, movable foreground. */}
          <View ref={rootRefs.main} collapsable={false} style={styles.main} testID="root-main">
            <Image source={require('./assets/fixture.png')} resizeMode="stretch" fadeDuration={0} onLoad={onImageLoad} style={styles.fill} />
            <View style={styles.overlay} />
            <View collapsable={false} style={styles.transparentChild}>
              <Fg fgRef={fgRefs.child} style={{ left: 85, top: 115 }} textColor={text('child')} />
            </View>
            <Fg
              fgRef={fgRefs.move}
              style={{ left: movable.left, top: movable.top, transform: movable.transform ?? [], opacity: baselineHidden ? 0 : 1 }}
              textColor={text('move')}
              testID="fg-move"
            />
          </View>
          <View style={styles.side}>
            <View style={[styles.marker, marker !== null && { backgroundColor: MARKER_COLORS[marker] }]} />
            <Animated.View style={[styles.pulse, { opacity: pulse }]} />
          </View>
        </View>

        <Text style={styles.status} testID="status">{status}</Text>
        <View style={styles.buttons}>
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <Pressable key={id} style={styles.button} onPress={() => void sampleManual(id)}>
              <Text style={styles.buttonText}>{id}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.button, styles.run]} onPress={() => void runSuite()}>
            <Text style={styles.buttonText}>Run suite</Text>
          </Pressable>
        </View>
        <Text style={styles.status}>{manual}</Text>

        {/* Root S: the foreground is in scrolled content. */}
        <View ref={rootRefs.scroll} collapsable={false} style={styles.scrollRoot}>
          <ScrollView
            ref={scrollRef}
            scrollEventThrottle={16}
            onScroll={(event) => {
              scrollOffset.current = event.nativeEvent.contentOffset.y;
            }}
          >
            {SCROLL_BLOCKS.map((block, index) => (
              <View key={index} style={{ height: SCROLL.block, backgroundColor: css(block) }} />
            ))}
            <Fg fgRef={fgRefs.scroll} style={{ left: 20, top: 130 }} textColor={text('scroll')} />
          </ScrollView>
        </View>

        {/* Root C: `cover` in a frame that is not square. */}
        <View ref={rootRefs.cover} collapsable={false} style={styles.frame}>
          <Image source={require('./assets/bands.png')} resizeMode="cover" fadeDuration={0} onLoad={onImageLoad} style={styles.fill} />
          <Fg fgRef={fgRefs.cover1} style={{ left: 20, top: 20 }} textColor={text('cover1')} />
          <Fg fgRef={fgRefs.cover2} style={{ left: 200, top: 100 }} textColor={text('cover2')} />
        </View>

        {/* Root N: `contain`. The root background shows at the left and the right. */}
        <View ref={rootRefs.contain} collapsable={false} style={styles.frame}>
          <Image source={require('./assets/bands.png')} resizeMode="contain" fadeDuration={0} onLoad={onImageLoad} style={styles.fill} />
          <Fg fgRef={fgRefs.contain1} style={{ left: 100, top: 10 }} textColor={text('contain1')} />
          <Fg fgRef={fgRefs.contain2} style={{ left: 5, top: 10 }} textColor={text('contain2')} />
          <Fg fgRef={fgRefs.contain3} style={{ left: 160, top: 120 }} textColor={text('contain3')} />
        </View>

        {/* Root D: no painted background. The right half has a 50% black layer. */}
        <View ref={rootRefs.residual} collapsable={false} style={styles.residual}>
          <View style={styles.residualHalf} />
          <Fg fgRef={fgRefs.resid1} style={{ left: 10, top: 10 }} textColor={text('resid1')} />
          <Fg fgRef={fgRefs.resid2} style={{ left: 120, top: 10 }} textColor={text('resid2')} />
          {showUnmount ? <Fg fgRef={fgRefs.unmount} style={{ left: 10, top: 45 }} textColor="gray" /> : null}
        </View>

        <View style={styles.row}>
          <View ref={rootRefs.opacity} collapsable={false} style={styles.opacityRoot}>
            <Fg fgRef={fgRefs.opacity} style={{ left: 10, top: 5 }} textColor={text('opacity')} />
          </View>
          {/* No `collapsable={false}` and no background: React Native can flatten this view. */}
          <View ref={rootRefs.flat} style={styles.flatRoot}>
            <Fg fgRef={fgRefs.flat} style={{ left: 10, top: 5 }} textColor={text('flat')} />
          </View>
          <View ref={rootRefs.zero} collapsable={false} style={styles.zeroRoot}>
            <Fg fgRef={fgRefs.zero} style={{ left: 0, top: 0 }} textColor="gray" />
          </View>
        </View>

        {/* Roots with a transform on the root itself. The left half is white. The right half is black. */}
        <View style={styles.row}>
          {(
            [
              ['rootTranslate', [{ translateX: 20 }]],
              ['rootScale', [{ scale: 0.5 }]],
              ['rootRotate', [{ rotate: '180deg' }]],
            ] as const
          ).map(([id, transform]) => (
            <View key={id} ref={rootRefs[id]} collapsable={false} style={[styles.transformRoot, { transform }]}>
              <View style={styles.transformRootHalf} />
              <Fg fgRef={fgRefs[id]} style={styles.transformRootFg} textColor={text(id)} />
            </View>
          ))}
        </View>

        {Platform.OS === 'web' && crossUri ? (
          <View ref={rootRefs.cross} collapsable={false} style={styles.opacityRootPlain}>
            <Image source={{ uri: crossUri }} resizeMode="stretch" onLoad={onImageLoad} style={styles.fill} />
            {/* The sample point is on the black quadrant. The root background is white. */}
            <Fg fgRef={fgRefs.cross} style={{ left: 60, top: 5 }} textColor="gray" />
          </View>
        ) : null}

        <View style={styles.table}>
          {records.map((rec) => (
            <Text key={rec.id} style={[styles.cell, rec.pass === false && styles.fail]}>
              {rec.pass === null ? 'OBS ' : rec.pass ? 'PASS' : 'FAIL'} {rec.id}: {rec.sampled?.join(',') ?? '-'}
              {rec.foreground ? ` -> ${rec.foreground} ${rec.ratio}` : ''}
              {rec.error ? ` ${rec.error}` : ''}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eeeeee', paddingTop: 60 },
  content: { paddingHorizontal: 8, paddingBottom: 40, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  main: { width: MAIN.width, height: MAIN.height },
  overlay: {
    position: 'absolute',
    left: OVERLAY.left,
    top: OVERLAY.top,
    width: OVERLAY.width,
    height: OVERLAY.height,
    backgroundColor: `rgba(0,0,0,${OVERLAY.alpha})`,
  },
  transparentChild: {
    position: 'absolute',
    left: TRANSPARENT_CHILD.left,
    top: TRANSPARENT_CHILD.top,
    width: TRANSPARENT_CHILD.width,
    height: TRANSPARENT_CHILD.height,
  },
  fg: {
    position: 'absolute',
    width: FOREGROUND.width,
    height: FOREGROUND.height,
    backgroundColor: css(MAGENTA),
    justifyContent: 'center',
    alignItems: 'center',
  },
  fgText: { fontSize: 12, fontWeight: '700' },
  fgNested: { position: 'absolute', right: 2, top: 2, width: 12, height: 12, backgroundColor: '#00ff00' },
  fgNestedInner: { flex: 1, margin: 3, backgroundColor: '#ff0000' },
  side: { gap: 8 },
  marker: { width: 40, height: 40, backgroundColor: '#cccccc' },
  pulse: { width: 40, height: 40, backgroundColor: '#444444' },
  status: { fontSize: 12 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  button: { paddingHorizontal: 6, paddingVertical: 4, backgroundColor: '#333333' },
  run: { backgroundColor: '#0a5' },
  buttonText: { color: 'white', fontSize: 11 },
  scrollRoot: { width: SCROLL.width, height: SCROLL.height },
  frame: { width: FRAME.width, height: FRAME.height, backgroundColor: '#00ff00' },
  residual: { width: RESIDUAL.width, height: RESIDUAL.height },
  residualHalf: { position: 'absolute', left: 100, top: 0, width: 100, height: RESIDUAL.height, backgroundColor: 'rgba(0,0,0,0.5)' },
  opacityRoot: { width: 100, height: 40, backgroundColor: css(WHITE), opacity: 0.5 },
  opacityRootPlain: { width: 100, height: 40, backgroundColor: css(WHITE) },
  flatRoot: { width: 100, height: 40 },
  transformRoot: { width: ROOT_TRANSFORM.width, height: ROOT_TRANSFORM.height, backgroundColor: css(WHITE) },
  transformRootHalf: {
    position: 'absolute',
    left: ROOT_TRANSFORM.split,
    top: 0,
    width: ROOT_TRANSFORM.width - ROOT_TRANSFORM.split,
    height: ROOT_TRANSFORM.height,
    backgroundColor: '#000000',
  },
  transformRootFg: ROOT_TRANSFORM.fg,
  zeroRoot: { width: 0, height: 0 },
  table: { gap: 1 },
  cell: { fontSize: 10, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  fail: { color: '#c00000', fontWeight: '700' },
});
