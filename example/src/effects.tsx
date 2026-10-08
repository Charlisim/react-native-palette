// Blur and Liquid Glass fixture. The report is in docs/spike/blur-and-glass.md.
import { BlurTargetView, BlurView, type BlurTint } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable, type GlassStyle } from 'expo-glass-effect';
import { useRef } from 'react';
import { Image, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PaletteError } from 'palette-react-native/src/errors';

import type { EffectHit, SamplerMode, ScreenRect, SpikeCaptureAdapter } from '../modules/palette-sampler';
import { FX, FX_POINTS, expectedFx, underBlack, type Pt, type Rgba8 } from './fixture';

type Kind = 'control' | 'blur' | 'blur-none' | 'glass' | 'rn-filter';
/** `background`: the effect is below the foreground. `foreground`: the foreground contains the effect. */
type Role = 'background' | 'foreground';

export interface FxRootDef {
  readonly id: string;
  readonly kind: Kind;
  readonly role: Role;
  readonly tint?: BlurTint;
  readonly intensity?: number;
  readonly glassStyle?: GlassStyle;
  readonly platforms?: readonly string[];
}

const ALL_ROOTS: readonly FxRootDef[] = [
  // A plain translucent panel. It validates the screenshot comparison method.
  { id: 'control', kind: 'control', role: 'background' },
  { id: 'blur-light-50', kind: 'blur', role: 'background', tint: 'light', intensity: 50 },
  { id: 'blur-dark-100', kind: 'blur', role: 'background', tint: 'dark', intensity: 100 },
  { id: 'blur-default-20', kind: 'blur', role: 'background', tint: 'default', intensity: 20 },
  // Android default of expo-blur: no blur, a translucent color only.
  { id: 'blur-none-light-50', kind: 'blur-none', role: 'background', tint: 'light', intensity: 50, platforms: ['android'] },
  { id: 'rn-filter-blur', kind: 'rn-filter', role: 'background', platforms: ['android', 'web'] },
  { id: 'glass-regular', kind: 'glass', role: 'background', glassStyle: 'regular' },
  { id: 'glass-clear', kind: 'glass', role: 'background', glassStyle: 'clear', platforms: ['ios'] },
  { id: 'fg-blur-light-50', kind: 'blur', role: 'foreground', tint: 'light', intensity: 50 },
  { id: 'fg-glass-regular', kind: 'glass', role: 'foreground', glassStyle: 'regular' },
];

export const FX_ROOTS = ALL_ROOTS.filter((def) => !def.platforms || def.platforms.includes(Platform.OS));
export const FX_PAGE_SIZE = 6;
export const FX_PAGES: readonly (readonly FxRootDef[])[] = Array.from(
  { length: Math.ceil(FX_ROOTS.length / FX_PAGE_SIZE) },
  (_unused, page) => FX_ROOTS.slice(page * FX_PAGE_SIZE, (page + 1) * FX_PAGE_SIZE),
);

export const glassAvailable = Platform.OS === 'ios' && isLiquidGlassAvailable();

/** True when the panel has an effect that the capture backend cannot render on this platform. */
export function effectActive(def: FxRootDef): boolean {
  switch (def.kind) {
    case 'blur':
    case 'rn-filter':
      return true;
    case 'glass':
      return glassAvailable;
    default:
      return false;
  }
}

type Ref = React.RefObject<View | null>;
export interface FxRefs {
  readonly root: Ref;
  /** `background`: the label. `foreground`: the container of the effect panel. */
  readonly fg: Ref;
  /** `foreground` only: the label in the effect panel. */
  readonly inner: Ref;
  readonly target: Ref;
}

export function useFxRefs(): Record<string, FxRefs> {
  return useRef(
    Object.fromEntries(
      ALL_ROOTS.map((def) => [
        def.id,
        { root: { current: null }, fg: { current: null }, inner: { current: null }, target: { current: null } },
      ]),
    ) as Record<string, FxRefs>,
  ).current;
}

const fixture = require('../assets/fixture.png');
const filterStyle = (Platform.OS === 'web' ? { filter: 'blur(6px)' } : { filter: [{ blur: 6 }] }) as ViewStyle;

function Label(props: { labelRef: Ref; left: number; top: number }) {
  return (
    <View
      ref={props.labelRef}
      collapsable={false}
      style={[styles.label, { left: props.left, top: props.top }]}
    >
      <Text style={styles.labelText}>Aa</Text>
    </View>
  );
}

function Panel(props: { def: FxRootDef; refs: FxRefs; style: ViewStyle; onLoad: () => void; children?: React.ReactNode }) {
  const { def, refs, style, children } = props;
  switch (def.kind) {
    case 'control':
      return <View style={[style, styles.controlPanel]}>{children}</View>;
    case 'blur':
      return (
        <BlurView tint={def.tint} intensity={def.intensity} blurTarget={refs.target} blurMethod="dimezisBlurView" style={style}>
          {children}
        </BlurView>
      );
    case 'blur-none':
      return (
        <BlurView tint={def.tint} intensity={def.intensity} style={style}>
          {children}
        </BlurView>
      );
    case 'glass':
      return (
        <GlassView glassEffectStyle={def.glassStyle} style={style}>
          {children}
        </GlassView>
      );
    case 'rn-filter':
      return (
        <View style={[style, filterStyle]}>
          <Image source={fixture} resizeMode="stretch" fadeDuration={0} onLoad={props.onLoad} style={styles.fill} />
          {children}
        </View>
      );
  }
}

function FxRoot(props: { def: FxRootDef; refs: FxRefs; onLoad: () => void }) {
  const { def, refs, onLoad } = props;
  const { panel, label } = FX;
  return (
    <View ref={refs.root} collapsable={false} style={styles.root} testID={`fx-${def.id}`}>
      <BlurTargetView ref={refs.target} style={styles.fill}>
        <Image source={fixture} resizeMode="stretch" fadeDuration={0} onLoad={onLoad} style={styles.fill} />
      </BlurTargetView>
      {def.role === 'background' ? (
        <>
          <Panel def={def} refs={refs} style={styles.panel} onLoad={onLoad} />
          <Label labelRef={refs.fg} left={label.left} top={label.top} />
        </>
      ) : (
        <View ref={refs.fg} collapsable={false} style={styles.panelBox}>
          <Panel def={def} refs={refs} style={styles.panelFill} onLoad={onLoad}>
            <Label labelRef={refs.inner} left={label.left - panel.left} top={label.top - panel.top} />
          </Panel>
        </View>
      )}
    </View>
  );
}

/** Count of `onLoad` events that a page gives. */
export const imagesOnPage = (defs: readonly FxRootDef[]) =>
  defs.reduce((count, def) => count + (def.kind === 'rn-filter' ? 2 : 1), 0);

export function EffectsPage(props: { defs: readonly FxRootDef[]; refs: Record<string, FxRefs>; onLoad: () => void }) {
  return (
    <View style={styles.page}>
      {props.defs.map((def) => (
        <View key={def.id}>
          <FxRoot def={def} refs={props.refs[def.id]!} onLoad={props.onLoad} />
          <Text style={styles.caption}>{def.id}</Text>
        </View>
      ))}
    </View>
  );
}

type FxExpectation =
  | { kind: 'color'; rgba8: Rgba8 }
  | { kind: 'error'; code: string }
  | { kind: 'observe' };

export interface FxRec {
  id: string;
  root: string;
  role: Role;
  point: string;
  /** `raw`: no effect detection. `normal`: default path. `inner`: the label in the panel is the foreground. */
  variant: string;
  effectActive: boolean;
  expected: FxExpectation;
  sampled?: Rgba8;
  error?: string;
  message?: string;
  pixel: Pt;
  effects?: readonly EffectHit[];
  ms: number;
  pass: boolean | null;
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const to8 = (c: { r: number; g: number; b: number; a: number }): Rgba8 => [
  round(c.r * 255),
  round(c.g * 255),
  round(c.b * 255),
  round(c.a * 255),
];
const maxDelta = (a: Rgba8, b: Rgba8) => Math.max(...a.map((value, i) => Math.abs(value - b[i]!)));

/** EXPERIMENTAL compositor modes. They are observations only. */
export const COMPOSITOR_MODES: readonly SamplerMode[] =
  Platform.OS === 'ios'
    ? ['dhRootFalse', 'dhRootTrue', 'dhWindowFalse', 'dhWindowTrue']
    : Platform.OS === 'android'
      ? ['pixelCopy']
      : [];

interface Variant {
  readonly name: string;
  readonly mode: SamplerMode;
  readonly fg: Ref;
  readonly origin: { readonly left: number; readonly top: number };
  readonly expected: FxExpectation;
}

function variantsFor(def: FxRootDef, refs: FxRefs, point: (typeof FX_POINTS)[number]): Variant[] {
  const { panel, label } = FX;
  const image = expectedFx(point);
  const active = effectActive(def);
  const rejected = active && point.underPanel;
  const unsupported: FxExpectation = { kind: 'error', code: 'UNSUPPORTED_CONTENT' };
  const observe: FxExpectation = { kind: 'observe' };
  const variants: Variant[] = [];
  if (def.role === 'background') {
    const fg = { fg: refs.fg, origin: label };
    // The color below a panel with no effect: known for the control, measured for the others.
    const plain: FxExpectation =
      def.kind === 'control'
        ? { kind: 'color', rgba8: point.underPanel ? underBlack(image, 0.5) : image }
        : def.kind === 'blur-none' && point.underPanel
          ? observe
          : { kind: 'color', rgba8: image };
    variants.push({ name: 'raw', mode: 'skipEffectCheck', ...fg, expected: observe });
    variants.push({ name: 'normal', mode: 'normal', ...fg, expected: rejected ? unsupported : plain });
    for (const mode of COMPOSITOR_MODES) {
      variants.push({ name: mode, mode, ...fg, expected: observe });
    }
  } else {
    // The foreground contains the effect. The capture excludes it and returns the image pixel.
    variants.push({ name: 'normal', mode: 'normal', fg: refs.fg, origin: panel, expected: { kind: 'color', rgba8: image } });
    // The caller passes the label. The effect panel stays in the capture.
    const inner = { fg: refs.inner, origin: label };
    variants.push({ name: 'inner-raw', mode: 'skipEffectCheck', ...inner, expected: observe });
    variants.push({
      name: 'inner',
      mode: 'normal',
      ...inner,
      expected: rejected ? unsupported : { kind: 'color', rgba8: image },
    });
    for (const mode of COMPOSITOR_MODES) {
      variants.push({ name: `inner-${mode}`, mode, ...inner, expected: observe });
    }
  }
  return variants;
}

export async function runEffectsPage(args: {
  adapter: SpikeCaptureAdapter;
  defs: readonly FxRootDef[];
  refs: Record<string, FxRefs>;
  tolerance: number;
  emit: (tag: string, payload: unknown) => void;
}): Promise<FxRec[]> {
  const { adapter, defs, refs, tolerance, emit } = args;
  const recs: FxRec[] = [];
  for (const def of defs) {
    const rootRefs = refs[def.id]!;
    const rect: ScreenRect | string = await adapter.locate(rootRefs.root).catch((error: unknown) => String(error));
    emit('SPIKE_FX_ROOT', { root: def.id, kind: def.kind, role: def.role, effectActive: effectActive(def), rect });
    for (const point of FX_POINTS) {
      for (const variant of variantsFor(def, rootRefs, point)) {
        adapter.setMode(variant.mode);
        const started = performance.now();
        const scale = typeof rect === 'string' ? 1 : rect.scale;
        const rec: FxRec = {
          id: `${def.id}/${point.id}/${variant.name}`,
          root: def.id,
          role: def.role,
          point: point.id,
          variant: variant.name,
          effectActive: effectActive(def),
          expected: variant.expected,
          pixel: { x: Math.floor(point.x * scale), y: Math.floor(point.y * scale) },
          ms: 0,
          pass: null,
        };
        try {
          const sample = await adapter.capture({
            captureRoot: rootRefs.root,
            foreground: variant.fg,
            point: { x: point.x - variant.origin.left, y: point.y - variant.origin.top },
          });
          rec.sampled = to8(sample.rgba);
          const detail = adapter.lastDetail();
          if (detail) {
            rec.pixel = detail.pixel;
            rec.effects = detail.effects;
          }
        } catch (error) {
          rec.error = error instanceof PaletteError ? error.code : `UNEXPECTED ${String(error)}`;
          rec.message = String((error as Error)?.message ?? error).slice(0, 240);
        }
        rec.ms = round(performance.now() - started);
        adapter.setMode('normal');
        if (variant.expected.kind === 'color') {
          rec.pass = rec.sampled !== undefined && maxDelta(rec.sampled, variant.expected.rgba8) <= tolerance;
        } else if (variant.expected.kind === 'error') {
          rec.pass = rec.error === variant.expected.code && /effect/i.test(rec.message ?? '');
        }
        recs.push(rec);
        emit('SPIKE_FX', rec);
      }
    }
  }
  return recs;
}

/** Latency of one sample for each mode, on the first root with an active blur. */
export async function runEffectsLatency(args: {
  adapter: SpikeCaptureAdapter;
  defs: readonly FxRootDef[];
  refs: Record<string, FxRefs>;
  emit: (tag: string, payload: unknown) => void;
  count: number;
}): Promise<void> {
  const def = args.defs.find((candidate) => candidate.kind === 'blur' && candidate.role === 'background');
  if (!def) {
    return;
  }
  const rootRefs = args.refs[def.id]!;
  const percentile = (values: number[], p: number) => {
    const sorted = [...values].sort((a, b) => a - b);
    return round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? NaN);
  };
  const runs: [string, SamplerMode, (typeof FX_POINTS)[number]][] = [
    ['normal (point not below the effect)', 'normal', FX_POINTS[5]],
    ['skipEffectCheck (point below the effect)', 'skipEffectCheck', FX_POINTS[0]],
    ...COMPOSITOR_MODES.map((mode): [string, SamplerMode, (typeof FX_POINTS)[number]] => [mode, mode, FX_POINTS[0]]),
  ];
  for (const [name, mode, point] of runs) {
    args.adapter.setMode(mode);
    const total: number[] = [];
    const native: number[] = [];
    let errors = 0;
    for (let i = 0; i < args.count; i += 1) {
      const started = performance.now();
      try {
        await args.adapter.capture({
          captureRoot: rootRefs.root,
          foreground: rootRefs.fg,
          point: { x: point.x - FX.label.left, y: point.y - FX.label.top },
        });
        native.push(args.adapter.lastDetail()?.captureMs ?? NaN);
      } catch {
        errors += 1;
      }
      total.push(performance.now() - started);
    }
    args.adapter.setMode('normal');
    args.emit('SPIKE_FX_LATENCY', {
      root: def.id,
      mode: name,
      n: args.count,
      errors,
      p50: percentile(total, 50),
      p95: percentile(total, 95),
      nativeP50: percentile(native, 50),
      nativeP95: percentile(native, 95),
    });
  }
}

const styles = StyleSheet.create({
  page: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 8 },
  root: { width: FX.size, height: FX.size },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  panel: {
    position: 'absolute',
    left: FX.panel.left,
    top: FX.panel.top,
    width: FX.panel.width,
    height: FX.panel.height,
    borderRadius: FX.panel.radius,
    overflow: 'hidden',
  },
  panelBox: {
    position: 'absolute',
    left: FX.panel.left,
    top: FX.panel.top,
    width: FX.panel.width,
    height: FX.panel.height,
  },
  panelFill: { flex: 1, borderRadius: FX.panel.radius, overflow: 'hidden' },
  controlPanel: { backgroundColor: 'rgba(0,0,0,0.5)' },
  label: {
    position: 'absolute',
    width: FX.label.width,
    height: FX.label.height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: { fontSize: 12, fontWeight: '700', color: '#808080' },
  caption: { fontSize: 9, height: 12 },
});
