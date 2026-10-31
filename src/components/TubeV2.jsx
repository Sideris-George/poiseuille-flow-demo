import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { pulseWave, segRadius, muralType, MURAL } from '../physics';

const K_VIS = 1.2, V_CAP = 520;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function makeSeg(p0, dir, len, rFn) {
  dir = dir.clone().normalize();
  const n1 = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  n1.sub(dir.clone().multiplyScalar(n1.dot(dir))).normalize();
  const n2 = new THREE.Vector3().crossVectors(dir, n1);
  return { p0: p0.clone(), dir, len, rAt: rFn, n1, n2, q: 1, next: [] };
}
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// Vessel: inlet → mural-cell segment with a radius profile → outlet. Display radii equal real
// radii in µm; lengths are compressed to fit on screen. A pericyte pinches only the stretch
// under its body; smooth muscle sets the radius of the whole segment.
export function buildSegments(state) {
  const r0 = state.r0, r = segRadius(state), type = muralType(state);
  const Lin = 150, Lt = clamp(50 * state.L, 80, 500), totalLen = Lin + Lt + Lin;
  const somaR = Math.max(2.5, Math.min(5, r0 * 0.35));
  const c = Lt / 2;
  // half-width of the fully constricted zone and width of its shoulders
  const hw = type === 'pericyte' ? Math.max(10, somaR * 2.6) : Lt / 2 - 28;
  const shoulder = type === 'pericyte' ? Math.max(8, somaR * 2) : 26;
  const window = s => smooth(1 - (Math.abs(s - c) - hw) / shoulder);
  const rMid = s => r0 + (r - r0) * window(s);
  let x = -totalLen / 2;
  const X = new THREE.Vector3(1, 0, 0);
  const s0 = makeSeg(new THREE.Vector3(x, 0, 0), X, Lin, () => r0); x += Lin;
  const s1 = makeSeg(new THREE.Vector3(x, 0, 0), X, Lt, rMid); x += Lt;
  const s2 = makeSeg(new THREE.Vector3(x, 0, 0), X, Lin, () => r0);
  s0.next = [{ i: 1, w: 1 }]; s1.next = [{ i: 2, w: 1 }]; s2.next = [{ i: 0, w: 1 }];
  return { segs: [s0, s1, s2], totalLen, somaR, type, hw, shoulder };
}

function Segment({ seg }) {
  const geo = useMemo(() => {
    const N = 96, pts = [];
    for (let i = 0; i <= N; i++) { const s = (i / N) * seg.len; pts.push(new THREE.Vector2(seg.rAt(s), s - seg.len / 2)); }
    return new THREE.LatheGeometry(pts, 40);
  }, [seg]);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), seg.dir), [seg]);
  const pos = useMemo(() => seg.p0.clone().addScaledVector(seg.dir, seg.len / 2), [seg]);
  return (
    <group position={pos} quaternion={q}>
      <mesh geometry={geo}>
        <meshPhysicalMaterial color="#f0a4b0" transparent opacity={0.22} roughness={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh geometry={geo}>
        <meshBasicMaterial color="#f5c3cb" wireframe transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// Smooth muscle: circumferential bands along the whole segment, each sitting on the local wall.
function SmoothMuscle({ seg }) {
  const x0 = seg.p0.x, rRef = seg.rAt(0);
  const band = Math.max(1.2, Math.min(4, rRef * 0.12));
  const pitch = band * 3.2;
  const n = Math.max(3, Math.floor((seg.len - 2 * pitch) / pitch));
  const start = x0 + (seg.len - (n - 1) * pitch) / 2;
  const c = MURAL.smc.color;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const s = start + i * pitch - x0;
        return (
          <mesh key={i} position={[x0 + s, 0, 0]} rotation={[0, Math.PI / 2, i * 0.35]}>
            <torusGeometry args={[seg.rAt(s) + band * 0.55, band * 0.5, 10, 56, Math.PI * 1.85]} />
            <meshStandardMaterial color={c} roughness={0.55} emissive="#3a1d0a" emissiveIntensity={0.25} />
          </mesh>
        );
      })}
    </group>
  );
}

// Pericyte: a soma on the outside of the waist it creates, with two processes wrapping the vessel.
function Pericyte({ seg, somaR }) {
  const sMid = seg.len / 2, xm = seg.p0.x + sMid;
  const proc = Math.max(0.5, somaR * 0.22);
  const c = MURAL.pericyte.color;
  return (
    <group position={[xm, 0, 0]}>
      <mesh position={[0, seg.rAt(sMid) + somaR * 0.7, 0]} scale={[1.6, 0.8, 1.1]}>
        <sphereGeometry args={[somaR, 20, 16]} />
        <meshStandardMaterial color={c} roughness={0.5} emissive="#0e3b2c" emissiveIntensity={0.35} />
      </mesh>
      {[-1, 1].map(side => {
        const dx = side * somaR * 1.9;
        return (
          <mesh key={side} position={[dx, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[seg.rAt(sMid + dx) + proc * 0.6, proc, 10, 48, Math.PI * 1.25]} />
            <meshStandardMaterial color="#3bbf8f" roughness={0.5} emissive="#0e3b2c" emissiveIntensity={0.25} />
          </mesh>
        );
      })}
    </group>
  );
}

function rbcPoints() {
  const R0 = 3.9, pts = [], N = 16;
  const prof = rho => 0.5 * R0 * Math.sqrt(1 - rho * rho) * (0.207 + 2.003 * rho * rho - 1.123 * rho ** 4);
  for (let i = 0; i <= N; i++) pts.push(new THREE.Vector2((i / N) * R0, prof(i / N)));
  for (let i = N; i >= 0; i--) pts.push(new THREE.Vector2((i / N) * R0, -prof(i / N)));
  return pts;
}

function Cells({ state, phys, segs }) {
  const rbcRef = useRef(), wbcRef = useRef(), pltRef = useRef(), arrowsRef = useRef([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const clockRef = useRef(0);
  const latest = useRef({ state, phys, segs });
  latest.current = { state, phys, segs };

  // Particles are rebuilt only when geometry or counts change.
  const particles = useMemo(() => {
    const vols = segs.map(s => Math.PI * ((s.rAt(0) + s.rAt(s.len / 2)) / 2) ** 2 * s.len);
    const vol = vols.reduce((a, b) => a + b, 0);
    const nR = state.rbc ? clamp(Math.round(1.05e-4 * (state.hct / 100) * vol), 30, 900) : 0;
    const nW = state.wbc ? clamp(Math.round(nR / 40) + 2, 2, 60) : 0;
    const nP = state.plt ? clamp(Math.round(nR / 2), 10, 400) : 0;
    const pick = () => { let u = Math.random() * vol; for (let i = 0; i < segs.length; i++) { u -= vols[i]; if (u <= 0) return i; } return 0; };
    const out = [];
    const add = (kind, n) => { for (let i = 0; i < n; i++) { const si = pick(); out.push({ kind, seg: si, s: Math.random() * segs[si].len, rho: Math.sqrt(Math.random()) * 0.93, theta: Math.random() * Math.PI * 2, ph: Math.random() * 6.28, ph2: Math.random() * 6.28, spin: 0.4 + Math.random() * 1.2 }); } };
    add(0, nR); add(1, nW); add(2, nP);
    return { list: out, nR, nW, nP };
  }, [segs, state.hct, state.rbc, state.wbc, state.plt]);

  useEffect(() => {
    if (rbcRef.current) rbcRef.current.count = particles.nR;
    if (wbcRef.current) wbcRef.current.count = particles.nW;
    if (pltRef.current) pltRef.current.count = particles.nP;
  }, [particles]);

  const arrows = useMemo(() => Array.from({ length: 9 }, () => new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 10, 0x7fd3ff, 6, 4)), []);

  useFrame((_, delta) => {
    const { state, phys, segs } = latest.current;
    const dt = Math.min(0.05, delta); clockRef.current += dt; const t = clockRef.current;
    const pf = state.pulse ? 1 + 0.55 * pulseWave(t * state.hr / 60) : 1;
    const Qum = phys.Q * 1e18 * pf;
    const rTest = segRadius(state);
    const scR = Math.min(1, 0.85 * rTest / 3.9), scW = Math.min(1, 0.8 * rTest / 6);
    let iR = 0, iW = 0, iP = 0;
    for (const pt of particles.list) {
      const seg = segs[pt.seg];
      const rP = seg.rAt(pt.s);
      const vmm = Qum * seg.q / (Math.PI * rP * rP) / 1000;
      const vis = Math.min(V_CAP, vmm * K_VIS * state.speed);
      const prof = state.fl && rTest < 12 ? 1.3 : 2 * (1 - pt.rho * pt.rho) + 0.08;
      pt.s += vis * prof * dt;
      if (pt.s > seg.len) {
        pt.s -= seg.len; let u = Math.random(); let ni = seg.next[0].i;
        for (const n of seg.next) { u -= n.w; if (u <= 0) { ni = n.i; break; } }
        pt.seg = ni; if (pt.s > segs[ni].len) pt.s = Math.random() * segs[ni].len;
      }
      const cellR = pt.kind === 0 ? 3.9 * scR : pt.kind === 1 ? 6 * scW : 1.3;
      const rad = Math.max(0, rP - cellR * 1.05) * pt.rho;
      p.copy(seg.p0).addScaledVector(seg.dir, pt.s).addScaledVector(seg.n1, rad * Math.cos(pt.theta)).addScaledVector(seg.n2, rad * Math.sin(pt.theta));
      dummy.position.copy(p);
      if (pt.kind === 0) { dummy.rotation.set(pt.ph + t * pt.spin * 0.4, pt.ph2, t * pt.spin * 0.7); dummy.scale.setScalar(scR); dummy.updateMatrix(); rbcRef.current.setMatrixAt(iR++, dummy.matrix); }
      else if (pt.kind === 1) { dummy.rotation.set(t * pt.spin * 0.3, pt.ph, t * pt.spin * 0.2); dummy.scale.setScalar(scW * (1 + 0.06 * Math.sin(t * 2 + pt.ph))); dummy.updateMatrix(); wbcRef.current.setMatrixAt(iW++, dummy.matrix); }
      else { dummy.rotation.set(pt.ph, t * pt.spin, pt.ph2); dummy.scale.setScalar(1); dummy.updateMatrix(); pltRef.current.setMatrixAt(iP++, dummy.matrix); }
    }
    rbcRef.current.instanceMatrix.needsUpdate = true;
    wbcRef.current.instanceMatrix.needsUpdate = true;
    pltRef.current.instanceMatrix.needsUpdate = true;

    if (state.profile) {
      const seg = segs[1];
      const vis = Math.min(V_CAP, (Qum / (Math.PI * rTest * rTest) / 1000) * K_VIS * state.speed);
      const maxLen = Math.min(seg.len * 0.8, vis * 0.7 + 6);
      const xm = seg.p0.x + seg.len / 2 - maxLen / 2;
      arrows.forEach((a, i) => { const rho = -0.9 + i * 0.225; const len = Math.max(2, maxLen * (1 - rho * rho)); a.position.set(xm, rho * rTest, 0); a.setLength(len, Math.min(6, len * 0.5), 3); });
    }
  });

  const rbcGeom = useMemo(() => new THREE.LatheGeometry(rbcPoints(), 20), []);

  return (
    <>
      <instancedMesh ref={rbcRef} args={[rbcGeom, undefined, 900]}>
        <meshStandardMaterial color="#d02a3f" roughness={0.55} metalness={0.05} />
      </instancedMesh>
      <instancedMesh ref={wbcRef} args={[undefined, undefined, 60]}>
        <icosahedronGeometry args={[6, 1]} />
        <meshStandardMaterial color="#e8eaf0" roughness={0.8} flatShading />
      </instancedMesh>
      <instancedMesh ref={pltRef} args={[undefined, undefined, 400]}>
        <cylinderGeometry args={[1.3, 1.3, 0.5, 10]} />
        <meshStandardMaterial color="#e6c35a" roughness={0.6} />
      </instancedMesh>
      <group visible={state.profile}>{arrows.map((a, i) => <primitive key={i} object={a} />)}</group>
    </>
  );
}

// Re-frame the camera only when the vessel changes size; otherwise leave the user's zoom alone.
function Framer({ totalLen, r0 }) {
  const { camera, controls } = useThree();
  const active = useRef(true);
  useEffect(() => { active.current = true; }, [totalLen, r0]);
  useFrame(() => {
    if (!active.current) return;
    const target = controls ? controls.target : new THREE.Vector3();
    const want = Math.max(totalLen * 0.85, r0 * 7, 260);
    const cur = camera.position.distanceTo(target);
    if (Math.abs(cur - want) > 1) camera.position.sub(target).setLength(lerp(cur, want, 0.06)).add(target);
    else active.current = false;
  });
  return null;
}

export default function TubeV2({ state, phys }) {
  const { segs, totalLen, somaR, type } = useMemo(() => buildSegments(state), [state.r0, state.tone, state.L, state.mode]);
  return (
    <Canvas camera={{ position: [140, 260, 520], fov: 45, near: 1, far: 5000 }} style={{ height: 460, width: '100%', background: '#101319' }}>
      <fog attach="fog" args={['#101319', 900, 2200]} />
      <hemisphereLight args={['#fff2e6', '#2a1a22', 0.9]} />
      <directionalLight position={[200, 300, 250]} intensity={0.8} />
      <directionalLight position={[-250, -100, -200]} intensity={0.35} color="#ffb0b8" />
      {segs.map((s, i) => <Segment key={i} seg={s} />)}
      {type === 'pericyte' ? <Pericyte seg={segs[1]} somaR={somaR} /> : <SmoothMuscle seg={segs[1]} />}
      <Cells state={state} phys={phys} segs={segs} />
      <Framer totalLen={totalLen} r0={state.r0} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}
