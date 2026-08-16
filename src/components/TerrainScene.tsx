import { Html, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Drone, GeologicalEvent, GeologyState, Mission, OceanCurrent } from '../types';

export type MapLayers = { bathymetry: boolean; currents: boolean; geology: boolean; markers: boolean };

function terrainHeight(x: number, z: number, geology?: GeologyState, simTime = 0) {
  const ridge = Math.sin(x * 0.72) * 0.42 + Math.cos(z * 0.91) * 0.32;
  const fine = Math.sin((x + z) * 2.1) * 0.12 + Math.cos((x - z) * 1.7) * 0.1;
  const microDetail = Math.sin(x * 5.7 + z * 2.9) * 0.035 + Math.cos(z * 6.3 - x * 3.4) * 0.028 + Math.sin((x - z) * 9.2) * 0.014;
  const trench = -1.8 * Math.exp(-((x + 2.2) ** 2) / 2.7) * Math.exp(-((z - 0.5) ** 2) / 12);
  const vent = 1.35 * Math.exp(-((x - 1.4) ** 2 + (z + 0.6) ** 2) / 0.9);
  if (!geology) return ridge + fine + microDetail + trench + vent;

  const ventGrowth = geology.deformation.ventGrowth * 0.9 * Math.exp(-((x - 1.4) ** 2 + (z + 0.6) ** 2) / 0.48);
  const fractureAxis = z - (Math.sin(x * 0.72) * 0.34 + 0.2);
  const fracture = -geology.deformation.fracture * 0.62 * Math.exp(-(fractureAxis ** 2) / 0.018) * Math.exp(-(x ** 2) / 24);
  const slumpMask = Math.exp(-((x + 3.1) ** 2) / 1.9 - ((z - 1.5) ** 2) / 4.2);
  const slump = -geology.deformation.slump * 1.15 * slumpMask * (0.7 + Math.sin((x + z) * 3.2) * 0.3);
  const eventDisplacement = geology.events.reduce((sum, event) => sum + geologicalDisplacement(event, x, z, simTime), 0);
  return ridge + fine + microDetail + trench + vent + ventGrowth + fracture + slump + eventDisplacement;
}

function geologicalDisplacement(event: GeologicalEvent, x: number, z: number, simTime: number) {
  const age = simTime - event.startTime;
  if (age < 0 || age > event.duration) return 0;
  const progress = age / event.duration;
  const envelope = Math.sin(progress * Math.PI);
  const distance = Math.hypot(x - event.x, z - event.z);
  const influence = Math.exp(-((distance / event.radius) ** 2) * 1.8);
  if (event.kind === 'MICROQUAKE') return Math.sin(distance * 9 - progress * 34) * influence * envelope * event.magnitude * 0.045;
  if (event.kind === 'VENT_ERUPTION') return Math.exp(-(distance ** 2) / 0.32) * envelope * event.magnitude * 0.12;
  return -Math.max(0, 1 - distance / event.radius) * envelope * event.magnitude * 0.075 * (0.7 + Math.sin((x + z) * 4) * 0.3);
}

function Terrain({ geology, simTime, geologicalEvents }: { geology: GeologyState; simTime: number; geologicalEvents: boolean }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(15, 11, 160, 116);
    const position = geo.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getY(i);
      position.setZ(i, terrainHeight(x, z));
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  const lastMeshUpdate = useRef(-1);
  useFrame(() => {
    const frame = Math.floor(simTime * 10);
    if (frame === lastMeshUpdate.current) return;
    lastMeshUpdate.current = frame;
    const position = geometry.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      position.setZ(index, terrainHeight(position.getX(index), position.getY(index), geologicalEvents ? geology : undefined, simTime));
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  });
  return (
    <group rotation={[-Math.PI / 2, 0, -0.09]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#05212a" emissive="#06323b" emissiveIntensity={0.52} roughness={0.78} metalness={0.08} />
      </mesh>
      <mesh geometry={geometry} position={[0, 0, 0.008]}>
        <meshBasicMaterial color="#2793a7" wireframe transparent opacity={0.34} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MarineSnow({ current }: { current: OceanCurrent }) {
  const points = useMemo(() => {
    const values = new Float32Array(840 * 3);
    for (let i = 0; i < 840; i++) {
      values[i * 3] = (Math.random() - 0.5) * 18;
      values[i * 3 + 1] = Math.random() * 9 - 2;
      values[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    return values;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const position = ref.current.geometry.attributes.position;
    const angle = current.bearing * Math.PI / 180;
    for (let i = 0; i < position.count; i++) {
      let x = position.getX(i) + Math.cos(angle) * current.speed * delta * 0.08;
      let y = position.getY(i) + (current.vertical * 0.18 - 0.025) * delta;
      let z = position.getZ(i) + Math.sin(angle) * current.speed * delta * 0.08;
      x += Math.sin(clock.elapsedTime * 0.7 + i) * current.turbulence * delta * 0.012;
      if (x > 9) x = -9; if (x < -9) x = 9;
      if (z > 7.5) z = -7.5; if (z < -7.5) z = 7.5;
      if (y < -2) y = 7; if (y > 7) y = -2;
      position.setXYZ(i, x, y, z);
    }
    position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry>
      <pointsMaterial color="#75c5d0" size={0.018} transparent opacity={0.34} depthWrite={false} />
    </points>
  );
}

function CurrentField({ current }: { current: OceanCurrent }) {
  const points = useMemo(() => {
    const values = new Float32Array(150 * 3);
    for (let i = 0; i < 150; i++) {
      values[i * 3] = (Math.random() - 0.5) * 15;
      values[i * 3 + 1] = Math.random() * 3.5 + 0.25;
      values[i * 3 + 2] = (Math.random() - 0.5) * 11;
    }
    return values;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const position = ref.current.geometry.attributes.position;
    const angle = current.bearing * Math.PI / 180;
    for (let i = 0; i < position.count; i++) {
      let x = position.getX(i) + Math.cos(angle) * current.speed * delta * 0.58;
      let z = position.getZ(i) + Math.sin(angle) * current.speed * delta * 0.58;
      let y = position.getY(i) + current.vertical * delta * 0.32;
      y += Math.sin(clock.elapsedTime * 1.3 + i * 0.71) * current.turbulence * delta * 0.025;
      if (x > 7.5) x = -7.5; if (x < -7.5) x = 7.5;
      if (z > 5.5) z = -5.5; if (z < -5.5) z = 5.5;
      if (y > 4) y = 0.25; if (y < 0.2) y = 4;
      position.setXYZ(i, x, y, z);
    }
    position.needsUpdate = true;
  });
  return (
    <group>
      <points ref={ref}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry>
        <pointsMaterial color="#70d9e8" size={0.045} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {[-4.5, -1.5, 1.5, 4.5].map((offset) => {
        const angle = current.bearing * Math.PI / 180;
        const start: [number, number, number] = [offset - Math.cos(angle) * 1.2, 2.35, -1.1 - Math.sin(angle) * 1.2];
        const end: [number, number, number] = [offset + Math.cos(angle) * 1.2, 2.35 + current.vertical, -1.1 + Math.sin(angle) * 1.2];
        return <Line key={offset} points={[start, end]} color="#4aafbf" lineWidth={1} dashed dashScale={7} transparent opacity={0.3} />;
      })}
    </group>
  );
}

function GeologicalEffects({ geology, simTime }: { geology: GeologyState; simTime: number }) {
  const activeEvents = geology.events.filter((event) => simTime - event.startTime >= 0 && simTime - event.startTime <= event.duration);
  const fracturePoints = Array.from({ length: 42 }, (_, index) => {
    const x = -6.8 + index * (13.6 / 41);
    const z = Math.sin(x * 0.72) * 0.34 + 0.2;
    return [x, terrainHeight(x, z, geology, simTime) + 0.045, z] as [number, number, number];
  });
  return <group>
    {geology.deformation.fracture > 0 ? <Line points={fracturePoints} color="#e99145" lineWidth={1.2} dashed dashScale={14} transparent opacity={0.5 + geology.activity * 0.35} /> : null}
    {activeEvents.map((event) => <GeologicalEventMarker key={event.id} event={event} geology={geology} simTime={simTime} />)}
  </group>;
}

function GeologicalEventMarker({ event, geology, simTime }: { event: GeologicalEvent; geology: GeologyState; simTime: number }) {
  const progress = Math.min(1, Math.max(0, (simTime - event.startTime) / event.duration));
  const envelope = Math.sin(progress * Math.PI);
  const y = terrainHeight(event.x, event.z, geology, simTime) + 0.08;
  const color = event.kind === 'VENT_ERUPTION' ? '#f0a24a' : event.kind === 'SLOPE_FAILURE' ? '#dd6b4f' : '#8ce6ef';
  return <group position={[event.x, y, event.z]}>
    {[0, 1, 2].map((ring) => {
      const radius = 0.28 + ((progress * 3.4 + ring * 0.85) % 3.4);
      return <mesh key={ring} rotation={[-Math.PI / 2, 0, 0]} scale={[radius, radius, radius]}>
        <ringGeometry args={[0.94, 1, 72]} />
        <meshBasicMaterial color={color} transparent opacity={Math.max(0.08, envelope * (0.5 - ring * 0.1))} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>;
    })}
    {event.kind === 'VENT_ERUPTION' ? <>
      <mesh position={[0, 0.42 + envelope * 0.25, 0]} scale={[0.25 + envelope * 0.18, 0.9 + envelope * 0.65, 0.25 + envelope * 0.18]}>
        <coneGeometry args={[0.38, 1.2, 18, 4, true]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.42} />
      </mesh>
      <pointLight color={color} intensity={5 + envelope * 12} distance={4.5} />
    </> : null}
    <Html position={[0.35, 0.4, 0]}><div className={`geology-label ${event.kind.toLowerCase()}`}><b>{event.label}</b><span>M {event.magnitude.toFixed(1)} · MESH Δ LIVE</span></div></Html>
  </group>;
}

function VesselMarker({ floodlights, current }: { floodlights: boolean; current: OceanCurrent }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 1.05 + Math.sin(clock.elapsedTime * 0.8) * (0.04 + current.turbulence * 0.035);
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.55) * current.turbulence * 0.045;
  });
  return (
    <group ref={ref} position={[-2.2, 1.05, 1.2]} rotation={[0, -0.6, 0]}>
      <mesh scale={[0.72, 0.18, 0.25]}><capsuleGeometry args={[0.4, 1.1, 5, 12]} /><meshStandardMaterial color="#adc9cf" emissive="#1b7d91" emissiveIntensity={0.55} /></mesh>
      <mesh position={[0, 0.25, 0]} scale={[0.2, 0.24, 0.18]}><boxGeometry /><meshStandardMaterial color="#5f7d85" /></mesh>
      {floodlights && <spotLight position={[0.8, 0, 0]} target-position={[4, -1, 0]} intensity={34} distance={9} angle={0.34} penumbra={0.8} color="#c8f5ff" />}
      <Html position={[0, 0.5, 0]} center><div className="map-label vessel-label">NEREID-7</div></Html>
    </group>
  );
}

function CameraRig({ external, recenterToken, onViewBearingChange }: { external: boolean; recenterToken: number; onViewBearingChange: (bearing: number) => void }) {
  const { camera } = useThree();
  const controls = useRef<any>(null);
  const lastReportedBearing = useRef<number | null>(null);
  const reportViewBearing = () => {
    const radians = controls.current?.getAzimuthalAngle?.() ?? 0;
    const bearing = Math.round(((THREE.MathUtils.radToDeg(radians) + 360) % 360) * 10) / 10;
    if (bearing === lastReportedBearing.current) return;
    lastReportedBearing.current = bearing;
    onViewBearingChange(bearing);
  };
  useEffect(() => {
    if (external) camera.position.set(-5, 2.2, 5.5);
    else camera.position.set(0, 7.5, 8.8);
    camera.lookAt(0, 0, 0);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    reportViewBearing();
  }, [camera, external, recenterToken]);
  return <OrbitControls ref={controls} onChange={reportViewBearing} enableDamping dampingFactor={0.07} minDistance={4} maxDistance={17} maxPolarAngle={Math.PI / 2.12} />;
}

function MapMarkers({ mission, drones, geology, simTime }: { mission: Mission; drones: Drone[]; geology: GeologyState; simTime: number }) {
  return <>
    {mission.waypoints.map((point) => (
      <group key={point.label} position={[point.x, terrainHeight(point.x, point.z, geology, simTime) + 0.5, point.z]}>
        <mesh rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.16, 0.16, 0.16]} /><meshBasicMaterial color="#55c9df" wireframe /></mesh>
        <Html position={[0.25, 0.05, 0]}><div className="map-label">{point.label}</div></Html>
      </group>
    ))}
    {drones.filter((drone) => drone.status !== 'DOCKED').map((drone) => {
      const x = drone.position[0]; const z = drone.position[1];
      return <group key={drone.id} position={[x, terrainHeight(x, z, geology, simTime) + 0.72, z]}>
        <mesh><octahedronGeometry args={[0.14]} /><meshBasicMaterial color="#66d69b" /></mesh>
        <Html position={[0.18, 0.05, 0]}><div className="map-label drone-label">{drone.id}</div></Html>
      </group>;
    })}
    <group position={[1.4, terrainHeight(1.4, -0.6, geology, simTime) + 0.28, -0.6]}>
      {[0, 1, 2].map((i) => <mesh key={i} position={[(i - 1) * 0.24, i * 0.08, 0]}><coneGeometry args={[0.18, 0.7 + i * 0.14, 7]} /><meshStandardMaterial color="#8e5b2d" emissive="#c48037" emissiveIntensity={1.4} /></mesh>)}
      <pointLight color="#d78b37" intensity={7} distance={3.4} />
      <Html position={[0.5, 0.85, 0]}><div className="map-label anomaly-label">HYDROTHERMAL ANOMALY<br /><span>VENT FIELD ALPHA</span></div></Html>
    </group>
    <Line points={mission.waypoints.map((p) => [p.x, terrainHeight(p.x, p.z, geology, simTime) + 0.38, p.z])} color="#49bb82" lineWidth={1} dashed dashScale={12} transparent opacity={0.72} />
  </>;
}

export function TerrainScene({ mission, drones, floodlights, current, geology, simTime, layers, recenterToken, onViewBearingChange, external = false }: { mission: Mission; drones: Drone[]; floodlights: boolean; current: OceanCurrent; geology: GeologyState; simTime: number; layers: MapLayers; recenterToken: number; onViewBearingChange: (bearing: number) => void; external?: boolean }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: external ? [-5, 2.2, 5.5] : [0, 7.5, 8.8], fov: external ? 56 : 45 }} gl={{ antialias: true }}>
      <color attach="background" args={[external ? '#000405' : '#01080b']} />
      <fog attach="fog" args={[external ? '#00090c' : '#021014', external ? 2 : 8.5, external ? 15 : 23]} />
      <hemisphereLight args={['#5db8c8', '#01090c', 0.28]} />
      <ambientLight intensity={0.16} color="#3d8291" />
      <directionalLight position={[3, 8, 1]} intensity={0.72} color="#7ed7e5" />
      <directionalLight position={[-5, 4, -4]} intensity={0.2} color="#15768a" />
      {layers.bathymetry ? <Terrain geology={geology} simTime={simTime} geologicalEvents={layers.geology} /> : null}
      <MarineSnow current={current} />
      {layers.currents ? <CurrentField current={current} /> : null}
      {layers.geology ? <GeologicalEffects geology={geology} simTime={simTime} /> : null}
      <VesselMarker floodlights={floodlights} current={current} />
      {!external && layers.markers ? <MapMarkers mission={mission} drones={drones} geology={geology} simTime={simTime} /> : null}
      <CameraRig external={external} recenterToken={recenterToken} onViewBearingChange={onViewBearingChange} />
    </Canvas>
  );
}
