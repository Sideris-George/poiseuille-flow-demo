import React, { useEffect, useMemo, useState } from 'react';
import TubeV2 from './components/TubeV2';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import './AppV2.css';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot } from 'recharts';
import { BASE, MURAL, PERICYTE_MAX_DIAMETER, vesselRadius, basePhys, constrictedLengthMm, compute, etaApparent, segRadius, mural, muralType, clampTone, switchMode, isSimple, inMode, fmtFlow, fmtRatio, sig, SLIDERS, TOGGLES } from './physics';

const range = (a, b, n, log) => Array.from({ length: n }, (_, i) => (log ? a * Math.pow(b / a, i / (n - 1)) : a + ((b - a) * i) / (n - 1)));

function Chart({ title, sub, data, xKey, yKey, color, marker, logY, logX, extraLines = [], children }) {
  return (
    <div className="chart">
      <h3>{title}<small>{sub}</small></h3>
      {children}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ bottom: 20, left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} type="number" scale={logX ? 'log' : 'linear'} domain={['dataMin', 'dataMax']} tickFormatter={v => sig(v)} label={{ value: xKey, position: 'insideBottom', offset: -10 }} />
          <YAxis scale={logY ? 'log' : 'linear'} domain={logY ? ['auto', 'auto'] : [0, 'auto']} tickFormatter={v => sig(v, 2)} width={60} />
          <Tooltip formatter={v => sig(v)} />
          {extraLines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} stroke="#9ca3af" strokeDasharray="5 4" strokeWidth={1.2} dot={false} isAnimationActive={false} />)}
          <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={3} dot={false} isAnimationActive={false} />
          {marker && <ReferenceDot x={marker.x} y={marker.y} r={6} fill={color} stroke="#fff" strokeWidth={2} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const modeFromUrl = () => (new URLSearchParams(window.location.search).get('mode') === 'advanced' ? 'advanced' : 'simple');

export default function AppV2() {
  const [state, setState] = useState(() => ({ ...BASE, mode: modeFromUrl() }));
  const [logR, setLogR] = useState(false);
  const mode = state.mode, simple = isSimple(state);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (mode === 'advanced') url.searchParams.set('mode', 'advanced'); else url.searchParams.delete('mode');
    window.history.replaceState(null, '', url.toString());
  }, [mode]);

  const phys = useMemo(() => compute(state), [state]);
  const ref = useMemo(() => basePhys(mode), [mode]);
  const set = (key, value) => setState(s => clampTone({ ...s, [key]: value }));
  const setMode = m => setState(s => switchMode(s, m));
  const reset = () => setState({ ...BASE, mode });
  const cell = mural(state);

  const rSeg = segRadius(state);
  const flow = fmtFlow(phys.Q_ulmin);
  const ratio = phys.Q / ref.Q;
  const unitScale = { 'mL/min': 1 / 1000, 'µL/min': 1, 'nL/min': 1000, 'pL/min': 1e6 }[flow.u];
  const qOf = patch => compute({ ...state, ...patch }).Q_ulmin * unitScale;
  const here = phys.Q_ulmin * unitScale;

  const radiusData = useMemo(() => (simple
    ? range(3, 10, 50).map(rs => ({ 'r (µm)': rs, Q: qOf({ rs }) }))
    : range(cell.toneMin, cell.toneMax, 50).map(tone => ({ 'radius under the cell (µm)': state.r0 * tone, Q: qOf({ tone }) }))), [state, unitScale, cell, simple]);
  const viscData = useMemo(() => (simple
    ? range(1, 10, 40).map(eta => ({ 'η (cP)': eta, Q: qOf({ eta }) }))
    : range(10, 70, 40).map(hct => ({ 'η (cP)': etaApparent(2 * rSeg, hct / 100, state.plasma, state.fl), Q: qOf({ hct }) }))), [state, unitScale, rSeg, simple]);
  const lengthData = useMemo(() => range(0.5, 10, 40).map(L => ({ 'L (mm)': L, Q: qOf({ L }) })), [state, unitScale]);
  const pressureData = useMemo(() => range(0, 100, 21).map(dP => ({ 'ΔP (mmHg)': dP, Q: dP === 0 ? 0 : qOf({ dP }) })), [state, unitScale]);
  const profileData = useMemo(() => range(-rSeg, rSeg, 41).map(x => ({ 'position from axis (µm)': x, 'v (mm/s)': phys.vmax_mms * (1 - (x * x) / (rSeg * rSeg)) })), [rSeg, phys]);
  const flData = useMemo(() => range(3, 1000, 60, true).map(D => ({ 'diameter (µm)': D, 'η (cP)': etaApparent(D, state.hct / 100, state.plasma, true), 'η at 25%': etaApparent(D, 0.25, state.plasma, true), 'η at 65%': etaApparent(D, 0.65, state.plasma, true) })), [state]);

  const transit = phys.transit_ms >= 1000 ? [sig(phys.transit_ms / 1000), 's'] : [sig(phys.transit_ms), 'ms'];
  const readouts = simple ? [
    ['Vessel either side', sig(vesselRadius(state)), 'µm'],
    ['Resistance ΔP/Q', sig(phys.R_mmHg_per_ulmin), 'mmHg per µL/min'],
    ['Mean velocity', sig(phys.vmean_mms), 'mm/s'],
    ['Centreline velocity', sig(phys.vmax_mms), 'mm/s'],
    ['Transit time', ...transit],
  ] : [
    ['Mural cell', cell.label, muralType(state) === 'pericyte' ? `≤ ${PERICYTE_MAX_DIAMETER} µm diameter` : `> ${PERICYTE_MAX_DIAMETER} µm diameter`],
    ['Radius under the cell', sig(rSeg), 'µm'],
    ['Constricted length', constrictedLengthMm(state) < 1 ? sig(constrictedLengthMm(state) * 1000) : sig(constrictedLengthMm(state)), constrictedLengthMm(state) < 1 ? 'µm of ' + state.L + ' mm' : 'mm (whole vessel)'],
    ['Apparent viscosity η', sig(phys.etaCP), 'cP under the cell'],
    ['Resistance ΔP/Q', sig(phys.R_mmHg_per_ulmin), 'mmHg per µL/min'],
    ['Share of resistance from the constriction', Math.round(phys.constrictionShare * 100), '%'],
    ['Mean velocity under the cell', sig(phys.vmean_mms), 'mm/s'],
    ['Centreline velocity', sig(phys.vmax_mms), 'mm/s'],
    ['Reynolds number', sig(phys.Re), phys.Re > 2000 ? 'turbulent' : 'laminar'],
    ['Wall shear stress', sig(phys.tau_Pa * 10), 'dyn/cm²'],
    ['Transit time', ...transit],
  ];

  return (
    <div className="pl"><div className="wrap">
      <div className="topbar">
        <h1>Poiseuille Lab</h1>
        <div className="modeswitch" role="group" aria-label="Model">
          <button className={simple ? 'on' : ''} onClick={() => setMode('simple')}>Simple</button>
          <button className={!simple ? 'on' : ''} onClick={() => setMode('advanced')}>Advanced</button>
        </div>
      </div>
      {simple && <h2 className="subtitle">Poiseuille’s Law Explorer: Parameter Dynamics & Hemodynamic Flow Simulation</h2>}
      <p className="lead">{simple
        ? 'Manipulate viscosity, pressure gradient, vessel length, and radius in real time to visualize laminar flow dynamics.'
        : 'The same vessel with the biology switched on: viscosity from haematocrit and the Fåhræus–Lindqvist effect, a pericyte or smooth muscle cell squeezing part of the vessel in series with the rest, pulsatile pressure, and the shear and Reynolds numbers that tell you when the law starts to strain.'}</p>
      <p className="byline">George (Yorgos) Sideris‑Lampretsas</p>

      <div className="hero">
        <BlockMath math={'Q = \\frac{\\pi r^4 \\Delta P}{8 \\eta L}'} />
        <div className="flow-big">
          <div className="n">{flow.v}</div>
          <div className="u">{flow.u} of blood</div>
          <div className="vs">{Math.abs(ratio - 1) < 0.005 ? 'this is the reference vessel' : <><b>{fmtRatio(ratio)}</b> the reference vessel</>}</div>
        </div>
        <p className="eq-live">
          {simple ? (
            <>= π · (<b className="c-r">{state.rs.toFixed(1)} µm</b>)⁴ · <b className="c-P">{state.dP} mmHg</b> ÷ (8 · <b className="c-eta">{state.eta.toFixed(2)} cP</b> · <b className="c-L">{state.L} mm</b>)</>
          ) : (
            <>Q = ΔP ÷ (R<sub>vessel</sub> + R<sub>constriction</sub>), each R = 8ηL ÷ πr⁴ — vessel at <b className="c-r">{state.r0} µm</b>, constriction at <b className="c-r">{sig(rSeg)} µm</b> over <b className="c-L">{constrictedLengthMm(state) < 1 ? sig(constrictedLengthMm(state) * 1000) + ' µm' : state.L + ' mm'}</b>, <b className="c-P">{state.dP} mmHg</b>
            &nbsp;— viscosity from <span className="c-eta">{state.hct}% haematocrit</span> in <span className="c-eta">{state.plasma.toFixed(2)} cP plasma</span>{state.fl ? `, corrected for a ${sig(2 * rSeg)} µm lumen` : ''}</>
          )}
        </p>
      </div>

      <div className="lab">
        <aside className="panel">
          <h3>{simple ? 'The four variables' : 'Vessel, mural cell and blood'}</h3>
          {SLIDERS.filter(c => inMode(c, mode) && (!c.showIf || state[c.showIf])).map(c => (
            <div className="ctl" key={c.key}>
              <label><span className={c.cls}>{c.dynamic ? `${cell.label} tone (segment ÷ vessel radius)` : c.label}</span><span className="v">{c.fmt ? c.fmt(state[c.key]) : state[c.key]} {c.unit}</span></label>
              <input type="range" min={c.dynamic ? cell.toneMin : c.min} max={c.dynamic ? cell.toneMax : c.max} step={c.step} value={state[c.key]} onChange={e => set(c.key, Number(e.target.value))} style={{ accentColor: `var(--${c.cls})` }} />
            </div>
          ))}
          <div className="toggles">
            {TOGGLES.filter(c => inMode(c, mode)).map(c => (
              <label key={c.key}><input type="checkbox" checked={state[c.key]} onChange={e => set(c.key, e.target.checked)} />{c.label}</label>
            ))}
          </div>
          <button className="btn" onClick={reset}>Reset to reference vessel</button>
        </aside>

        <div>
          <div className="stage">
            <div className="legend"><span><i style={{ background: '#d02a3f' }} />Red cells</span><span><i style={{ background: '#e8eaf0' }} />White cells</span><span><i style={{ background: '#e6c35a' }} />Platelets</span><span><i style={{ background: MURAL.pericyte.color }} />Pericyte</span><span><i style={{ background: MURAL.smc.color }} />Smooth muscle</span></div>
            <div className="hint">drag to orbit · scroll to zoom</div>
            <TubeV2 state={state} phys={phys} />
          </div>
          <div className="readouts">
            {readouts.map(([k, v, u]) => <div className="ro" key={k}><div className="k">{k}</div><div className="v">{v}<small>{u}</small></div></div>)}
          </div>
        </div>
      </div>

      <section>
        <h2>How each variable moves the flow</h2>
        <p className="sub">Every curve is drawn with the other sliders at their current values; the dot is where you are now.</p>
        <div className="charts">
          <Chart title={simple ? 'Flow vs radius' : 'Flow vs radius under the cell'} sub={simple ? 'fourth power' : `swept over the ${cell.label.toLowerCase()} range; in series with the uncovered vessel`} data={radiusData} xKey={simple ? 'r (µm)' : 'radius under the cell (µm)'} yKey="Q" color="#b5233a" logY={logR} marker={{ x: rSeg, y: here }}>
            <label className="opt"><input type="checkbox" checked={logR} onChange={e => setLogR(e.target.checked)} /> log scale</label>
          </Chart>
          <Chart title="Flow vs viscosity" sub={simple ? 'inverse' : 'inverse; swept by haematocrit'} data={viscData} xKey="η (cP)" yKey="Q" color="#2f6f8f" marker={{ x: phys.etaCP, y: here }} />
          <Chart title="Flow vs length" sub="inverse" data={lengthData} xKey="L (mm)" yKey="Q" color="#4f8a55" marker={{ x: state.L, y: here }} />
          <Chart title="Flow vs pressure drop" sub="linear" data={pressureData} xKey="ΔP (mmHg)" yKey="Q" color="#c9731c" marker={{ x: state.dP, y: here }} />
          <Chart title="Velocity across the lumen" sub="parabolic; centreline is twice the mean" data={profileData} xKey="position from axis (µm)" yKey="v (mm/s)" color="#9b1c31" />
          {!simple && <Chart title="Apparent viscosity vs diameter" sub="Fåhræus–Lindqvist; dashed = 25% and 65%" data={flData} xKey="diameter (µm)" yKey="η (cP)" color="#2f6f8f" logX extraLines={[{ key: 'η at 25%' }, { key: 'η at 65%' }]} marker={{ x: 2 * rSeg, y: etaApparent(2 * rSeg, state.hct / 100, state.plasma, true) }} />}
        </div>
      </section>

      <footer className="foot">Poiseuille Lab · George (Yorgos) Sideris‑Lampretsas</footer>
    </div></div>
  );
}