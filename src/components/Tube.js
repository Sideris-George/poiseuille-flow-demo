import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Cylinder, OrbitControls } from '@react-three/drei';

// Flowing spheres for RBCs/WBCs
const FlowingSphere = ({ initPosition, speed, radius, color, lengthScale, getLocalRadius, isRBC, index }) => {
  const ref = useRef();
  const [x0, y0, z0] = initPosition;

  useFrame((state, delta) => {
    // Move along x according to flow factor
    ref.current.position.x += speed * delta;

    // Wrap around
    if (ref.current.position.x > lengthScale / 2) {
      ref.current.position.x = -lengthScale / 2 + (ref.current.position.x - lengthScale / 2);
    }

    // Rotation / deformation
    if (isRBC) {
      ref.current.rotation.y += 0.5 * delta;
    } else {
      ref.current.rotation.x += 0.3 * delta;
      ref.current.rotation.y += 0.3 * delta;
      const scale = radius + 0.05 * Math.sin(state.clock.elapsedTime * (index + 1));
      ref.current.scale.set(scale, scale, scale);
    }

    // Keep inside tube
    const localRadius = Math.max(0.1, getLocalRadius(ref.current.position.x) - radius);
    const r = Math.sqrt(ref.current.position.y ** 2 + ref.current.position.z ** 2);
    if (r > localRadius) {
      const scale = localRadius / r;
      ref.current.position.y *= scale;
      ref.current.position.z *= scale;
    }
  });

  return (
    <mesh
      ref={ref}
      position={[x0, y0, z0]}
      rotation={[0, Math.random() * Math.PI * 2, 0]}
      scale={isRBC ? [1.5, 0.4, 1.5] : [1, 1, 1]}
    >
      {isRBC ? (
        <sphereGeometry args={[radius, 16, 16]} />
      ) : (
        <icosahedronGeometry args={[radius, 2]} />
      )}
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

const Tube = ({ radius, length, viscosity, flow, showRBCs, showWBCs }) => {
  const baseRadius = 25;            // constant radius for outer sections
  const adjustableRadius = radius * 5; // adjustable middle radius

  const innerSegmentLength = 20;         // fixed length for segments 2,3,4
  const outerSegmentLength = length * 5; // adjustable length for outer segments
  const totalLength = 2 * outerSegmentLength + 3 * innerSegmentLength;

  const rbcSpeed = flow  * 0.1 * 5e1;  // scale to reasonable speed visually
  const wbcSpeed = rbcSpeed * 0.2;

  // Compute boundaries along x
  const positions = [
    -totalLength / 2,
    -totalLength / 2 + outerSegmentLength,
    -totalLength / 2 + outerSegmentLength + innerSegmentLength,
    -totalLength / 2 + outerSegmentLength + 2 * innerSegmentLength,
    -totalLength / 2 + outerSegmentLength + 3 * innerSegmentLength,
    totalLength / 2,
  ];

  const radii = [
    baseRadius,
    baseRadius,
    adjustableRadius,
    adjustableRadius,
    baseRadius,
    baseRadius,
  ];

  const getLocalRadius = x => {
    for (let i = 0; i < positions.length - 1; i++) {
      if (x >= positions[i] && x <= positions[i + 1]) {
        const t = (x - positions[i]) / (positions[i + 1] - positions[i]);
        return radii[i] * (1 - t) + radii[i + 1] * t;
      }
    }
    return baseRadius;
  };

  // RBC positions
  const rbcPositions = useMemo(() => {
    if (!showRBCs) return [];
    const numRBCs = Math.max(1, Math.round(viscosity * 20));
    return Array.from({ length: numRBCs }, () => {
      const x = (Math.random() - 0.5) * totalLength;
      const r = Math.random() * Math.max(1, getLocalRadius(x) * 0.8);
      const theta = Math.random() * Math.PI * 2;
      return [x, r * Math.cos(theta), r * Math.sin(theta)];
    });
  }, [viscosity, radius, length, showRBCs]);

  // WBC positions
  const wbcPositions = useMemo(() => {
    if (!showWBCs) return [];
    const numWBCs = Math.max(1, Math.round(viscosity * 2));
    return Array.from({ length: numWBCs }, () => {
      const x = (Math.random() - 0.5) * totalLength;
      const r = Math.random() * Math.max(1, getLocalRadius(x) * 0.8);
      const theta = Math.random() * Math.PI * 2;
      return [x, r * Math.cos(theta), r * Math.sin(theta)];
    });
  }, [viscosity, radius, length, showWBCs]);

  return (
    <Canvas camera={{ position: [0, 30, 70], fov: 50 }} style={{ height: 450, width: '100%' }}>
      <ambientLight intensity={0.5} />
      <spotLight position={[20, 20, 20]} />

      {/* Five segments */}
      <Cylinder args={[baseRadius, baseRadius, outerSegmentLength, 32]} position={[-totalLength / 2 + outerSegmentLength / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="pink" opacity={0.3} transparent />
      </Cylinder>
      <Cylinder args={[baseRadius, adjustableRadius, innerSegmentLength, 32]} position={[-totalLength / 2 + outerSegmentLength + innerSegmentLength / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="pink" opacity={0.3} transparent />
      </Cylinder>
      <Cylinder args={[adjustableRadius, adjustableRadius, innerSegmentLength, 32]} position={[-totalLength / 2 + outerSegmentLength + innerSegmentLength * 1.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="pink" opacity={0.3} transparent />
      </Cylinder>
      <Cylinder args={[adjustableRadius, baseRadius, innerSegmentLength, 32]} position={[-totalLength / 2 + outerSegmentLength + innerSegmentLength * 2.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="pink" opacity={0.3} transparent />
      </Cylinder>
      <Cylinder args={[baseRadius, baseRadius, outerSegmentLength, 32]} position={[totalLength / 2 - outerSegmentLength / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="pink" opacity={0.3} transparent />
      </Cylinder>

      {/* RBCs */}
      {rbcPositions.map((pos, i) => (
        <FlowingSphere key={`rbc-${i}`} initPosition={pos} speed={rbcSpeed} radius={1.5} color="red" lengthScale={totalLength} getLocalRadius={getLocalRadius} isRBC={true} index={i} />
      ))}

      {/* WBCs */}
      {wbcPositions.map((pos, i) => (
        <FlowingSphere key={`wbc-${i}`} initPosition={pos} speed={wbcSpeed} radius={2} color="green" lengthScale={totalLength} getLocalRadius={getLocalRadius} isRBC={false} index={i} />
      ))}

      {/* Pericyte */}
      <mesh position={[0, adjustableRadius + 2, 0]} scale={[1.2, 0.8, 1]}>
        <sphereGeometry args={[3, 16, 16]} />
        <meshStandardMaterial color="black" />
      </mesh>

      <OrbitControls />
    </Canvas>
  );
};

export default Tube;
