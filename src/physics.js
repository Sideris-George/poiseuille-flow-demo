// Pure functions and data — no React here, so this is easy to unit-test.

// Two models share one state object.
//  simple:   textbook Poiseuille. r, η, L, ΔP are set directly; the vessel is uniform.
//  advanced: η from haematocrit + plasma via the Pries fit, a mural cell constricting part
//            of the vessel in series with the rest, pulsatile pressure, extra readouts.
export const BASE = {
  mode: 'simple',
  r0: 5,       // radius of the vessel either side of the mural cell (µm); slider range 1–10
  tone: 1.0,   // advanced only: radius under the cell as a fraction of r0 (0.6 = constriction, 1.1 = maximal dilation)
  eta: 1.52,   // simple only: blood viscosity set directly (cP). 1.52 is what advanced gives at reset.
  L: 5, dP: 30, hct: 45, plasma: 1.2,
  fl: true, pulse: false, hr: 72, profile: true,
  rbc: true, wbc: true, plt: true, speed: 1,
};
export const isSimple = s => s.mode === 'simple';

// Mural cell follows vessel diameter: pericytes cover capillaries up to ~12 µm diameter,
// smooth muscle cells cover arterioles above that. Their contractile ranges differ:
// toneMin/toneMax set the contractile range of each cell (the tone slider reads these, not SLIDERS).
export const PERICYTE_MAX_DIAMETER = 12;
export const MURAL = {
  pericyte: { label: 'Pericyte', toneMin: 0.6, toneMax: 1.1, color: '#2fa37a' },
  smc: { label: 'Smooth muscle', toneMin: 0.6, toneMax: 1.1, color: '#c7692a' },
};
export const muralType = s => (2 * s.r0 <= PERICYTE_MAX_DIAMETER ? 'pericyte' : 'smc');
export const mural = s => MURAL[muralType(s)];
export const clampTone = s => ({ ...s, tone: Math.min(mural(s).toneMax, Math.max(mural(s).toneMin, s.tone)) });
export const segRadius = s => (isSimple(s) ? s.r0 : s.r0 * s.tone);

// How much of the vessel the mural cell actually squeezes. A pericyte only pinches the
// stretch under its soma and processes (~20 µm); smooth muscle covers the arteriole
// continuously, so its tone applies to the whole length.
export const PERICYTE_CONSTRICTION_UM = 20;
export const constrictedLengthMm = s => (isSimple(s) ? s.L : muralType(s) === 'pericyte' ? Math.min(s.L, PERICYTE_CONSTRICTION_UM / 1000) : s.L);

// Pries, Neuhaus & Gaehtgens (1992) in-vitro fit. D in µm, H as a fraction, plasma in cP.
export function etaApparent(D, H, plasma, useFL) {
  const d = useFL ? D : 1000;
  const e45 = 220 * Math.exp(-1.3 * d) + 3.2 - 2.44 * Math.exp(-0.06 * Math.pow(d, 0.645));
  const g = 1 / (1 + 1e-11 * Math.pow(d, 12));
  const C = (0.8 + Math.exp(-0.075 * d)) * (-1 + g) + g;
  const rel = 1 + (e45 - 1) * (Math.pow(1 - H, C) - 1) / (Math.pow(0.55, C) - 1);
  return plasma * rel;
}

export function compute(s) {
  const rum = segRadius(s), r0 = s.r0 * 1e-6, r = rum * 1e-6;
  const L = s.L * 1e-3, Lc = constrictedLengthMm(s) * 1e-3, Lu = L - Lc, dP = s.dP * 133.322;
  const simple = isSimple(s);
  const etaCP = simple ? s.eta : etaApparent(2 * rum, s.hct / 100, s.plasma, s.fl);    // in the constricted stretch
  const eta0CP = simple ? s.eta : etaApparent(2 * s.r0, s.hct / 100, s.plasma, s.fl);  // in the uncovered vessel
  const eta = etaCP * 1e-3, eta0 = eta0CP * 1e-3;
  const Rc = 8 * eta * Lc / (Math.PI * Math.pow(r, 4));                     // Pa·s/m³
  const Ru = 8 * eta0 * Lu / (Math.PI * Math.pow(r0, 4));
  const Q = dP / (Rc + Ru);
  const vmean = Q / (Math.PI * r * r), vmean0 = Q / (Math.PI * r0 * r0);
  return {
    Q, etaCP, eta0CP,
    Q_ulmin: Q * 1e9 * 60,
    R_mmHg_per_ulmin: s.dP / (Q * 1e9 * 60),
    constrictionShare: Rc / (Rc + Ru),
    vmean_mms: vmean * 1e3,
    vmax_mms: 2 * vmean * 1e3,
    vmean0_mms: vmean0 * 1e3,
    Re: 1060 * vmean * 2 * r / eta,
    tau_Pa: 4 * eta * Q / (Math.PI * Math.pow(r, 3)),
    transit_ms: (Lu / vmean0 + Lc / vmean) * 1e3,
  };
}

// Reference ("reset") flow for each model, so the ×ratio readout always compares like with like.
export const basePhys = mode => compute({ ...BASE, mode });

// Haematocrit that reproduces a given viscosity at this diameter (bisection), used when
// switching simple → advanced so the number on screen does not jump.
export function hctForEta(eta, D, plasma, useFL) {
  let lo = 0.10, hi = 0.70;
  if (etaApparent(D, lo, plasma, useFL) >= eta) return 10;
  if (etaApparent(D, hi, plasma, useFL) <= eta) return 70;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (etaApparent(D, mid, plasma, useFL) < eta) lo = mid; else hi = mid; }
  return Math.round(((lo + hi) / 2) * 100);
}

// Convert state between the two models, carrying the visible numbers across.
export function switchMode(s, mode) {
  if (mode === s.mode) return s;
  if (mode === 'simple') return { ...s, mode, tone: 1, eta: Number(compute(s).etaCP.toFixed(2)), pulse: false };
  return clampTone({ ...s, mode, hct: hctForEta(s.eta, 2 * s.r0, s.plasma, s.fl) });
}

export function pulseWave(phase) {
  const x = phase - Math.floor(phase);
  return Math.pow(Math.max(0, Math.sin(2 * Math.PI * x)), 1.5) - 0.3;
}

export const sig = (v, n = 3) => (v === 0 ? '0' : String(Number(v.toPrecision(n))));
export function fmtFlow(ulmin) {
  if (ulmin >= 1000) return { v: sig(ulmin / 1000), u: 'mL/min' };
  if (ulmin >= 0.1) return { v: sig(ulmin), u: 'µL/min' };
  if (ulmin >= 1e-4) return { v: sig(ulmin * 1000), u: 'nL/min' };
  return { v: sig(ulmin * 1e6), u: 'pL/min' };
}
export const fmtRatio = x => (x >= 1 ? `×${sig(x)}` : `×${sig(x, 2)} (1/${sig(1 / x)})`);

// `modes` lists where a control appears; omitted = both.
export const SLIDERS = [
  { key: 'r0', label: 'Radius r', unit: 'µm', min: 3, max: 10, step: 1, cls: 'c-r', advLabel: 'Vessel radius' },
  { key: 'tone', label: 'Mural cell tone (segment ÷ vessel radius)', unit: '×', min: 0.6, max: 1.1, step: 0.01, cls: 'c-r', fmt: v => v.toFixed(2), dynamic: true, modes: ['advanced'] },
  { key: 'eta', label: 'Viscosity η', unit: 'cP', min: 1, max: 10, step: 0.05, cls: 'c-eta', fmt: v => v.toFixed(2), modes: ['simple'] },
  { key: 'L', label: 'Length L', unit: 'mm', min: 0.5, max: 10, step: 0.5, cls: 'c-L', fmt: v => v.toFixed(1) },
  { key: 'dP', label: 'Pressure drop ΔP', unit: 'mmHg', min: 5, max: 100, step: 1, cls: 'c-P' },
  { key: 'hct', label: 'Haematocrit', unit: '%', min: 10, max: 70, step: 1, cls: 'c-eta', modes: ['advanced'] },
  { key: 'plasma', label: 'Plasma viscosity', unit: 'cP', min: 1, max: 3, step: 0.05, cls: 'c-eta', fmt: v => v.toFixed(2), modes: ['advanced'] },
  { key: 'hr', label: 'Heart rate', unit: 'bpm', min: 40, max: 180, step: 1, cls: 'c-P', showIf: 'pulse', modes: ['advanced'] },
  { key: 'speed', label: 'Playback speed', unit: '×', min: 1, max: 60, step: 1, cls: 'c-misc' },
];

export const TOGGLES = [
  { key: 'fl', label: 'Fåhræus–Lindqvist effect', modes: ['advanced'] },
  { key: 'pulse', label: 'Pulsatile pressure', modes: ['advanced'] },
  { key: 'profile', label: 'Velocity-profile arrows' },
  { key: 'rbc', label: 'Red cells' },
  { key: 'wbc', label: 'White cells' },
  { key: 'plt', label: 'Platelets' },
];
export const inMode = (c, mode) => !c.modes || c.modes.includes(mode);

