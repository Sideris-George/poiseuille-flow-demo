import React, { useState } from 'react';
import Tube from './components/Tube';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

function App() {
  // Relative multipliers
  const [radiusFactor, setRadiusFactor] = useState(1);   // 0.5–5
  const [viscosityFactor, setViscosityFactor] = useState(1); // 0.1–10
  const [lengthFactor, setLengthFactor] = useState(1);   // 0.5–5
  const [deltaP, setDeltaP] = useState(50);             // mmHg
  const [showRBCs, setShowRBCs] = useState(true);
  const [showWBCs, setShowWBCs] = useState(true);

  // Base constants
  const baseRadius = 1;     // arbitrary base radius unit
  const baseViscosity = 1;  // base η
  const baseLength = 10;    // cm
  const baseFlow = 1;       // Q₀

  // Compute scaled values
  const radius = baseRadius * radiusFactor;
  const viscosity = baseViscosity * viscosityFactor;
  const length = baseLength * lengthFactor;
  const flowFactor = (Math.PI * Math.pow(radius, 4) * deltaP) / (8 * viscosity * length); // relative Q
  const flow = baseFlow * flowFactor;

  // Flow vs radius graph (relative Q)
  const data = Array.from({ length: 20 }, (_, i) => {
    const radFactor = 0.5 + i * 0.25; // 0.5–5
    const Q = baseFlow * (Math.pow(radFactor, 4) * deltaP) / (8 * viscosity * length);
    return { radius: radFactor.toFixed(2), flow: Q.toFixed(2) };
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center space-y-6">
      <h1 className="text-3xl font-bold">Poiseuille's Law Explorer</h1>

      {/* Equation */}
      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <BlockMath
          math={'Q = \\frac{\\pi r^4 \\Delta P}{8 \\eta L}'}
          style={{ transform: 'scale(2)', display: 'inline-block' }}
        />
      </div>

      {/* Sliders */}
      <div className="w-full max-w-2xl space-y-4">
        <div>
          <label>Radius factor (0.5–5): {radiusFactor.toFixed(2)}</label>
          <input type="range" min="0.5" max="5" step="0.05" value={radiusFactor} onChange={e => setRadiusFactor(Number(e.target.value))} className="w-full"/>
        </div>
        <div>
          <label>Viscosity factor (0.1–10): {viscosityFactor.toFixed(2)}</label>
          <input type="range" min="0.1" max="10" step="0.1" value={viscosityFactor} onChange={e => setViscosityFactor(Number(e.target.value))} className="w-full"/>
        </div>
        <div>
          <label>Length factor (0.5–5): {lengthFactor.toFixed(2)}</label>
          <input type="range" min="0.5" max="5" step="0.1" value={lengthFactor} onChange={e => setLengthFactor(Number(e.target.value))} className="w-full"/>
        </div>
        <div>
          <label>ΔP (mmHg): {deltaP}</label>
          <input type="range" min="10" max="100" step="5" value={deltaP} onChange={e => setDeltaP(Number(e.target.value))} className="w-full"/>
        </div>
      </div>

      {/* Flow display */}
      <div className="text-xl font-semibold">
        Flow Q = {flow.toFixed(2)} × Q₀
      </div>

      {/* RBC & WBC toggles */}
      <div className="space-x-4">
        <button onClick={() => setShowRBCs(prev => !prev)} className="px-4 py-2 bg-blue-600 text-white rounded">
          {showRBCs ? 'Hide RBCs' : 'Show RBCs'}
        </button>
        <button onClick={() => setShowWBCs(prev => !prev)} className="px-4 py-2 bg-green-600 text-white rounded">
          {showWBCs ? 'Hide WBCs' : 'Show WBCs'}
        </button>
      </div>

      {/* 3D Tube */}
      <div className="w-full max-w-2xl min-h-[450px] mb-6">
        <Tube
          radius={radius}
          length={length}
          viscosity={viscosity}
          flow={flowFactor}   // relative flow controls speed
          showRBCs={showRBCs}
          showWBCs={showWBCs}
        />
      </div>

      {/* Flow vs radius graph */}
      <div className="w-full max-w-2xl min-h-[400px] mb-6">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
            <XAxis dataKey="radius" label={{ value: 'Radius factor', position: 'insideBottom', dy: 20 }} />
            <YAxis label={{ value: 'Flow (×Q₀)', angle: -90, position: 'insideLeft', dx: -20 }} />
            <Tooltip />
            <Line type="monotone" dataKey="flow" stroke="#2563eb" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default App;
