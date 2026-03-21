import React, { useState } from 'react';
import Tube from './components/Tube';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function App() {
  // Relative multipliers
  const [radiusFactor, setRadiusFactor] = useState(1);   // 0.5–5
  const [viscosityFactor, setViscosityFactor] = useState(1); // 0.1–10
  const [lengthFactor, setLengthFactor] = useState(1);   // 0.5–5
  const [deltaP, setDeltaP] = useState(50);             // mmHg
  const [showRBCs, setShowRBCs] = useState(true);
  const [showWBCs, setShowWBCs] = useState(true);

  // Base constants
  const baseRadius = 1;
  const baseViscosity = 1;
  const baseLength = 10;
  const baseFlow = 1;

  // Compute current scaled values
  const radius = baseRadius * radiusFactor;
  const viscosity = baseViscosity * viscosityFactor;
  const length = baseLength * lengthFactor;
  const flowFactor = (Math.PI * Math.pow(radius, 4) * deltaP) / (8 * viscosity * length);
  const flow = baseFlow * flowFactor;

  // --- DATA GENERATION FOR GRAPHS ---

  // 1. Flow vs Radius (Quartic: r^4)
  const radiusData = Array.from({ length: 20 }, (_, i) => {
    const rF = 0.5 + i * 0.25;
    const Q = baseFlow * (Math.PI * Math.pow(rF, 4) * deltaP) / (8 * viscosity * length);
    return { x: rF.toFixed(2), flow: parseFloat(Q.toFixed(2)) };
  });

  // 2. Flow vs Viscosity (Inverse: 1/η)
  const viscosityData = Array.from({ length: 20 }, (_, i) => {
    const vF = 0.5 + i * 0.5;
    const Q = baseFlow * (Math.PI * Math.pow(radius, 4) * deltaP) / (8 * vF * length);
    return { x: vF.toFixed(2), flow: parseFloat(Q.toFixed(2)) };
  });

  // 3. Flow vs Length (Inverse: 1/L)
  const lengthData = Array.from({ length: 20 }, (_, i) => {
    const lF = 0.5 + i * 0.25;
    const Q = baseFlow * (Math.PI * Math.pow(radius, 4) * deltaP) / (8 * viscosity * (baseLength * lF));
    return { x: lF.toFixed(2), flow: parseFloat(Q.toFixed(2)) };
  });

  // 4. Flow vs Pressure (Linear: ΔP)
  const pressureData = Array.from({ length: 20 }, (_, i) => {
    const p = 10 + i * 5;
    const Q = baseFlow * (Math.PI * Math.pow(radius, 4) * p) / (8 * viscosity * length);
    return { x: p, flow: parseFloat(Q.toFixed(2)) };
  });

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center space-y-8">
      <h1 className="text-4xl font-extrabold text-gray-800">Poiseuille's Law Explorer</h1>

      {/* Equation Section */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <BlockMath math={'Q = \\frac{\\pi r^4 \\Delta P}{8 \\eta L}'} />
      </div>

      {/* Controls Container */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 rounded-2xl shadow-lg">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Radius factor: {radiusFactor.toFixed(2)}</label>
            <input type="range" min="0.5" max="5" step="0.05" value={radiusFactor} onChange={e => setRadiusFactor(Number(e.target.value))} className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer mt-2"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Viscosity (η) factor: {viscosityFactor.toFixed(2)}</label>
            <input type="range" min="0.1" max="10" step="0.1" value={viscosityFactor} onChange={e => setViscosityFactor(Number(e.target.value))} className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer mt-2"/>
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Length factor: {lengthFactor.toFixed(2)}</label>
            <input type="range" min="0.5" max="5" step="0.1" value={lengthFactor} onChange={e => setLengthFactor(Number(e.target.value))} className="w-full h-2 bg-yellow-200 rounded-lg appearance-none cursor-pointer mt-2"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">ΔP (Pressure): {deltaP} mmHg</label>
            <input type="range" min="10" max="100" step="5" value={deltaP} onChange={e => setDeltaP(Number(e.target.value))} className="w-full h-2 bg-red-200 rounded-lg appearance-none cursor-pointer mt-2"/>
          </div>
        </div>
      </div>

      {/* Toggles & Speed Display */}
      <div className="flex flex-col items-center space-y-4">
        <div className="text-2xl font-bold text-blue-700 bg-blue-50 px-6 py-2 rounded-full border-2 border-blue-200">
          Current Flow Q = {flow.toFixed(2)} units
        </div>
        <div className="space-x-4">
          <button onClick={() => setShowRBCs(!showRBCs)} className={`px-6 py-2 rounded-lg font-semibold transition ${showRBCs ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {showRBCs ? 'Hide RBCs' : 'Show RBCs'}
          </button>
          <button onClick={() => setShowWBCs(!showWBCs)} className={`px-6 py-2 rounded-lg font-semibold transition ${showWBCs ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {showWBCs ? 'Hide WBCs' : 'Show WBCs'}
          </button>
        </div>
      </div>

      {/* 3D Simulation View */}
      <div className="w-full max-w-5xl h-[450px] bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
        <Tube
          radius={radius}
          length={length}
          viscosity={viscosity}
          flow={flowFactor}
          showRBCs={showRBCs}
          showWBCs={showWBCs}
        />
      </div>

      {/* Analysis Graphs Grid */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">

        {/* Radius Chart */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="text-center font-bold text-gray-700 mb-2"> Flow Q vs Radius (Exponential)</h3>
          <ResponsiveContainer width="30%" height={250}>
            <LineChart data={radiusData} margin={{ bottom: 20, left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" label={{ value: 'Radius', position: 'insideBottom', offset: -10 }} />
              <YAxis label={{ value: 'Flow', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Line type="monotone" dataKey="flow" stroke="#2563eb" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Viscosity Chart */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="text-center font-bold text-gray-700 mb-2"> Flow Q vs Viscosity (Inverse)</h3>
          <ResponsiveContainer width="30%" height={250}>
            <LineChart data={viscosityData} margin={{ bottom: 20, left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" label={{ value: 'Viscosity', position: 'insideBottom', offset: -10 }} />
              <YAxis label={{ value: 'Flow', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Line type="monotone" dataKey="flow" stroke="#10b981" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Length Chart */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="text-center font-bold text-gray-700 mb-2"> Flow Q vs Length (Inverse)</h3>
          <ResponsiveContainer width="30%" height={250}>
            <LineChart data={lengthData} margin={{ bottom: 20, left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" label={{ value: 'Length', position: 'insideBottom', offset: -10 }} />
              <YAxis label={{ value: 'Flow', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Line type="monotone" dataKey="flow" stroke="#f59e0b" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pressure Chart */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="text-center font-bold text-gray-700 mb-2"> Flow Q vs Pressure (Linear)</h3>
          <ResponsiveContainer width="30%" height={250}>
            <LineChart data={pressureData} margin={{ bottom: 20, left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" label={{ value: 'ΔP', position: 'insideBottom', offset: -10 }} />
              <YAxis label={{ value: 'Flow', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Line type="monotone" dataKey="flow" stroke="#ef4444" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}

export default App;