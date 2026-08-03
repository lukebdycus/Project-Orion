import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Quaternion,
  Vector3,
} from 'three';
import type {
  BufferGeometry,
  Group,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import type { Line2, LineMaterial } from 'three-stdlib';
import { getBeamPaletteColors } from './beamBlobs';
import type { BeamBlobPalette, NodeCoordinates } from './types';

export const centerLaunchLeadTime = 0.11;

export type CenterLaunchEvent = {
  id: string;
  launchDirection: NodeCoordinates;
  palette: BeamBlobPalette;
  startedAt: number;
};

type CenterEmitterProps = {
  launches: readonly CenterLaunchEvent[];
};

type LaunchBasis = {
  binormal: NodeCoordinates;
  direction: NodeCoordinates;
  perpendicular: NodeCoordinates;
};

type PlumeSeed = {
  angle: number;
  brightness: number;
  phase: number;
  radialOffset: number;
  reach: number;
  trailLength: number;
  twist: number;
};

const launchEffectDuration = 0.56;
const plumeParticleCount = 20;
const baseEmissive = new Color('#2758b3');
const white = new Color('#ffffff');
const localXAxis = new Vector3(1, 0, 0);
const localZAxis = new Vector3(0, 0, 1);

export function CenterEmitter({ launches }: CenterEmitterProps) {
  const latestLaunch = launches[launches.length - 1];
  const recentLaunches = launches.slice(-5);

  return (
    <group>
      <CenterCore launch={latestLaunch} />
      {recentLaunches.map((launch) => (
        <CenterLaunchBurst key={launch.id} launch={launch} />
      ))}
    </group>
  );
}

function CenterCore({ launch }: { launch?: CenterLaunchEvent }) {
  const root = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const coreMaterial = useRef<MeshStandardMaterial>(null);
  const glow = useRef<Mesh>(null);
  const glowMaterial = useRef<MeshBasicMaterial>(null);
  const direction = launch?.launchDirection ?? [1, 0, 0];
  const directionQuaternion = useMemo(
    () => createDirectionQuaternion(direction, localXAxis),
    [direction],
  );
  const paletteAccent = useMemo(
    () =>
      new Color(
        launch
          ? getBeamPaletteColors(launch.palette)[2]
          : '#2758b3',
      ),
    [launch?.palette],
  );

  useFrame(({ clock }) => {
    if (
      !root.current ||
      !core.current ||
      !coreMaterial.current ||
      !glow.current ||
      !glowMaterial.current
    ) {
      return;
    }

    const age = launch
      ? clock.elapsedTime - launch.startedAt
      : Number.POSITIVE_INFINITY;
    const releaseAge = age - centerLaunchLeadTime;
    const chargeBuild = smoothstep01(
      clamp(age / centerLaunchLeadTime, 0, 1),
    );
    const chargeRetention =
      releaseAge <= 0
        ? 1
        : 1 - smoothstep01(clamp(releaseAge / 0.2, 0, 1));
    const charge = chargeBuild * chargeRetention;
    const flash =
      releaseAge >= 0
        ? 1 - smoothstep01(clamp(releaseAge / 0.075, 0, 1))
        : 0;
    const recoilProgress = clamp(releaseAge / 0.22, 0, 1);
    const recoil =
      releaseAge >= 0
        ? Math.sin(recoilProgress * Math.PI) * (1 - recoilProgress * 0.35)
        : 0;
    const rebound =
      releaseAge >= 0
        ? Math.sin(clamp(releaseAge / 0.34, 0, 1) * Math.PI) *
          (1 - smoothstep01(clamp(releaseAge / 0.34, 0, 1)))
        : 0;
    const directionalPull =
      releaseAge < 0 && age >= 0 ? charge * 0.055 : 0;
    const recoilDistance = recoil * 0.085;
    const displacement = directionalPull - recoilDistance;

    root.current.quaternion.copy(directionQuaternion);
    root.current.position.set(
      direction[0] * displacement,
      direction[1] * displacement,
      direction[2] * displacement,
    );

    core.current.scale.set(
      1 + charge * 1.35 + flash * 1.8 + rebound * 0.12,
      1 - charge * 0.3 + flash * 0.95 + rebound * 0.08,
      1 - charge * 0.3 + flash * 0.95 + rebound * 0.08,
    );
    coreMaterial.current.emissive
      .copy(baseEmissive)
      .lerp(paletteAccent, clamp(charge * 0.5 + rebound * 0.72, 0, 1))
      .lerp(white, flash);
    coreMaterial.current.emissiveIntensity =
      2.4 + charge * 6 + flash * 18;

    glow.current.scale.set(
      1.3 + charge * 1.1 + flash * 3.8,
      1.15 + charge * 0.35 + flash * 2.6,
      1.15 + charge * 0.35 + flash * 2.6,
    );
    glowMaterial.current.opacity =
      0.07 + charge * 0.17 + flash * 0.72;
    glowMaterial.current.color
      .copy(paletteAccent)
      .lerp(white, flash);
  });

  return (
    <group ref={root} renderOrder={28}>
      <mesh ref={core}>
        <sphereGeometry args={[0.085, 20, 20]} />
        <meshStandardMaterial
          ref={coreMaterial}
          color="#ffffff"
          emissive="#2758b3"
          emissiveIntensity={2.4}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glow} renderOrder={27}>
        <sphereGeometry args={[0.13, 18, 18]} />
        <meshBasicMaterial
          ref={glowMaterial}
          color="#ffffff"
          transparent
          opacity={0.07}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function CenterLaunchBurst({ launch }: { launch: CenterLaunchEvent }) {
  const arcGroup = useRef<Group>(null);
  const firstArc = useRef<Line2>(null);
  const secondArc = useRef<Line2>(null);
  const ring = useRef<Mesh>(null);
  const ringMaterial = useRef<MeshBasicMaterial>(null);
  const flareGroup = useRef<Group>(null);
  const flare = useRef<Mesh>(null);
  const flareMaterial = useRef<MeshBasicMaterial>(null);
  const plumeGeometry = useRef<BufferGeometry>(null);
  const plumeMaterial = useRef<LineBasicMaterial>(null);
  const basis = useMemo(
    () => createLaunchBasis(launch.launchDirection),
    [launch.launchDirection],
  );
  const directionQuaternion = useMemo(
    () => createDirectionQuaternion(basis.direction, localXAxis),
    [basis.direction],
  );
  const ringQuaternion = useMemo(
    () => createDirectionQuaternion(basis.direction, localZAxis),
    [basis.direction],
  );
  const firstArcPoints = useMemo(
    () => createMagneticArc(basis, 1),
    [basis],
  );
  const secondArcPoints = useMemo(
    () => createMagneticArc(basis, -1),
    [basis],
  );
  const plumeSeeds = useMemo(
    () => createPlumeSeeds(launch.id),
    [launch.id],
  );
  const plumePositions = useMemo(
    () => new Float32Array(plumeParticleCount * 6),
    [],
  );
  const plumeColors = useMemo(
    () => createPlumeColors(plumeSeeds),
    [plumeSeeds],
  );

  useLayoutEffect(() => {
    if (arcGroup.current) {
      arcGroup.current.visible = false;
    }

    for (const line of [firstArc.current, secondArc.current]) {
      const material = getLineMaterial(line);

      if (line) {
        line.visible = false;
      }

      if (material) {
        material.opacity = 0;
      }
    }

    if (ring.current && ringMaterial.current) {
      ring.current.visible = false;
      ringMaterial.current.opacity = 0;
    }

    if (flare.current && flareMaterial.current) {
      flare.current.visible = false;
      flareMaterial.current.opacity = 0;
    }

    if (plumeGeometry.current && plumeMaterial.current) {
      plumeGeometry.current.setDrawRange(0, 0);
      plumeMaterial.current.opacity = 0;
    }
  }, []);

  useFrame(({ clock }) => {
    if (
      !arcGroup.current ||
      !firstArc.current ||
      !secondArc.current ||
      !ring.current ||
      !ringMaterial.current ||
      !flareGroup.current ||
      !flare.current ||
      !flareMaterial.current ||
      !plumeGeometry.current ||
      !plumeMaterial.current
    ) {
      return;
    }

    const age = clock.elapsedTime - launch.startedAt;
    const isActive = age >= 0 && age < launchEffectDuration;

    if (!isActive) {
      arcGroup.current.visible = false;
      ring.current.visible = false;
      flare.current.visible = false;
      plumeGeometry.current.setDrawRange(0, 0);
      return;
    }

    const releaseAge = age - centerLaunchLeadTime;
    const hasReleased = releaseAge >= 0;
    const charge = smoothstep01(
      clamp(age / centerLaunchLeadTime, 0, 1),
    );
    const flash = hasReleased
      ? 1 - smoothstep01(clamp(releaseAge / 0.075, 0, 1))
      : 0;
    const afterimage = hasReleased
      ? (1 - smoothstep01(clamp(releaseAge / 0.45, 0, 1))) *
        (0.72 + flash * 0.26)
      : charge * 0.32;
    const arcScale = hasReleased
      ? 1 + smoothstep01(clamp(releaseAge / 0.32, 0, 1)) * 0.08
      : 0.42 + charge * 0.58;
    const firstArcMaterial = getLineMaterial(firstArc.current);
    const secondArcMaterial = getLineMaterial(secondArc.current);

    arcGroup.current.visible = afterimage > 0.001;
    arcGroup.current.scale.setScalar(arcScale);
    firstArc.current.visible = afterimage > 0.001;
    secondArc.current.visible = afterimage > 0.001;

    if (firstArcMaterial) {
      firstArcMaterial.opacity = afterimage;
      firstArcMaterial.linewidth = 2.15 + flash * 2.55;
    }

    if (secondArcMaterial) {
      secondArcMaterial.opacity = afterimage * 0.64;
      secondArcMaterial.linewidth = 1.45 + flash * 1.7;
    }

    const ringProgress = clamp(releaseAge / 0.28, 0, 1);
    const ringOpacity = hasReleased
      ? (1 - smoothstep01(ringProgress)) * 0.62
      : 0;

    ring.current.visible = ringOpacity > 0.001;
    ring.current.quaternion.copy(ringQuaternion);
    ring.current.scale.setScalar(
      0.72 + smoothstep01(ringProgress) * 5.15,
    );
    ringMaterial.current.opacity = ringOpacity;

    flareGroup.current.quaternion.copy(directionQuaternion);
    flare.current.visible = flash > 0.001;
    flare.current.position.x = 0.065 + flash * 0.085;
    flare.current.scale.set(
      1 + flash * 5.2,
      0.8 + flash * 1.7,
      0.8 + flash * 1.7,
    );
    flareMaterial.current.opacity = flash * 0.95;

    writePlumeFrame(
      plumePositions,
      plumeSeeds,
      basis,
      age,
      releaseAge,
    );
    plumeGeometry.current.getAttribute('position').needsUpdate = true;
    plumeGeometry.current.setDrawRange(0, plumeParticleCount * 2);
    plumeMaterial.current.opacity = hasReleased
      ? (1 - smoothstep01(clamp(releaseAge / 0.34, 0, 1))) * 0.92
      : 0.2 + charge * 0.42;
  });

  return (
    <group renderOrder={30}>
      <group ref={arcGroup}>
        <Line
          ref={firstArc}
          points={firstArcPoints}
          color="#ffffff"
          transparent
          lineWidth={2.15}
          frustumCulled={false}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          renderOrder={29}
        />
        <Line
          ref={secondArc}
          points={secondArcPoints}
          color="#ffffff"
          transparent
          lineWidth={1.45}
          frustumCulled={false}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          renderOrder={29}
        />
      </group>
      <mesh ref={ring} renderOrder={28}>
        <ringGeometry args={[0.075, 0.105, 40]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color="#ffffff"
          transparent
          blending={AdditiveBlending}
          side={DoubleSide}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <group ref={flareGroup}>
        <mesh ref={flare} renderOrder={31}>
          <octahedronGeometry args={[0.09, 0]} />
          <meshBasicMaterial
            ref={flareMaterial}
            color="#ffffff"
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <lineSegments renderOrder={30} frustumCulled={false}>
        <bufferGeometry ref={plumeGeometry}>
          <bufferAttribute
            attach="attributes-position"
            args={[plumePositions, 3]}
            usage={DynamicDrawUsage}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[plumeColors, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={plumeMaterial}
          color="#ffffff"
          vertexColors
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}

function createLaunchBasis(direction: NodeCoordinates): LaunchBasis {
  const normalizedDirection = normalize(direction);
  let perpendicular = cross(normalizedDirection, [0, 0, 1]);

  if (length(perpendicular) <= 0.0001) {
    perpendicular = cross(normalizedDirection, [0, 1, 0]);
  }

  perpendicular = normalize(perpendicular);

  return {
    direction: normalizedDirection,
    perpendicular,
    binormal: normalize(cross(normalizedDirection, perpendicular)),
  };
}

function createDirectionQuaternion(
  direction: NodeCoordinates,
  localAxis: Vector3,
): Quaternion {
  return new Quaternion().setFromUnitVectors(
    localAxis,
    new Vector3(...normalize(direction)),
  );
}

function createMagneticArc(
  basis: LaunchBasis,
  side: 1 | -1,
): NodeCoordinates[] {
  const pointCount = 15;

  return Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1);
    const arch = Math.sin(progress * Math.PI);
    const forward = progress * 3;
    const lateral = side * arch * (0.62 + (1 - progress) * 0.2);
    const twist =
      Math.sin(progress * Math.PI * 2) * 0.2 * side;

    return combineBasisPoint(
      basis,
      forward,
      lateral,
      twist,
    );
  });
}

function createPlumeSeeds(launchId: string): PlumeSeed[] {
  return Array.from({ length: plumeParticleCount }, (_, index) => ({
    angle:
      hashStringToUnit(`${launchId}:plume-angle:${index}`) * Math.PI * 2,
    brightness:
      0.48 + hashStringToUnit(`${launchId}:plume-light:${index}`) * 0.52,
    phase:
      (index + 0.35 +
        hashStringToUnit(`${launchId}:plume-phase:${index}`) * 0.3) /
      plumeParticleCount,
    radialOffset:
      0.12 + hashStringToUnit(`${launchId}:plume-radius:${index}`) * 0.22,
    reach:
      2.7 + hashStringToUnit(`${launchId}:plume-reach:${index}`) * 1.25,
    trailLength:
      0.09 + hashStringToUnit(`${launchId}:plume-trail:${index}`) * 0.18,
    twist:
      1.4 + hashStringToUnit(`${launchId}:plume-twist:${index}`) * 2.1,
  }));
}

function createPlumeColors(seeds: PlumeSeed[]): Float32Array {
  const colors = new Float32Array(seeds.length * 6);

  for (let index = 0; index < seeds.length; index += 1) {
    const offset = index * 6;
    const intensity = seeds[index].brightness;

    for (let component = 0; component < 6; component += 1) {
      colors[offset + component] = intensity;
    }
  }

  return colors;
}

function writePlumeFrame(
  positions: Float32Array,
  seeds: PlumeSeed[],
  basis: LaunchBasis,
  age: number,
  releaseAge: number,
): void {
  const hasReleased = releaseAge >= 0;
  const charge = smoothstep01(
    clamp(age / centerLaunchLeadTime, 0, 1),
  );

  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index];
    let forward: number;
    let radius: number;
    let angle: number;
    let trailLength: number;

    if (hasReleased) {
      const flightDuration = 0.2 + seed.phase * 0.12;
      const flightProgress = clamp(releaseAge / flightDuration, 0, 1);
      const easedFlight = 1 - Math.pow(1 - flightProgress, 3);

      forward = 0.03 + easedFlight * seed.reach;
      radius =
        seed.radialOffset * (1 - flightProgress) * 0.58 +
        Math.sin(flightProgress * Math.PI) * 0.045;
      angle =
        seed.angle + flightProgress * seed.twist * Math.PI * 2;
      trailLength = seed.trailLength * (0.65 + flightProgress * 1.35);
    } else {
      forward = -0.04 + seed.phase * 0.16 + charge * 0.055;
      radius = seed.radialOffset * (1 - charge * 0.7);
      angle = seed.angle + charge * seed.twist * Math.PI;
      trailLength = seed.trailLength * (0.32 + charge * 0.28);
    }

    const head = combineBasisPoint(
      basis,
      forward,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
    const tail = addScaled(head, basis.direction, -trailLength);
    const offset = index * 6;

    positions[offset] = tail[0];
    positions[offset + 1] = tail[1];
    positions[offset + 2] = tail[2];
    positions[offset + 3] = head[0];
    positions[offset + 4] = head[1];
    positions[offset + 5] = head[2];
  }
}

function combineBasisPoint(
  basis: LaunchBasis,
  forward: number,
  lateral: number,
  vertical: number,
): NodeCoordinates {
  return [
    basis.direction[0] * forward +
      basis.perpendicular[0] * lateral +
      basis.binormal[0] * vertical,
    basis.direction[1] * forward +
      basis.perpendicular[1] * lateral +
      basis.binormal[1] * vertical,
    basis.direction[2] * forward +
      basis.perpendicular[2] * lateral +
      basis.binormal[2] * vertical,
  ];
}

function addScaled(
  point: NodeCoordinates,
  direction: NodeCoordinates,
  scale: number,
): NodeCoordinates {
  return [
    point[0] + direction[0] * scale,
    point[1] + direction[1] * scale,
    point[2] + direction[2] * scale,
  ];
}

function getLineMaterial(line: Line2 | null): LineMaterial | null {
  if (!line) {
    return null;
  }

  const material = line.material;

  return (Array.isArray(material) ? material[0] : material) as LineMaterial;
}

function cross(
  first: NodeCoordinates,
  second: NodeCoordinates,
): NodeCoordinates {
  return [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ];
}

function normalize(point: NodeCoordinates): NodeCoordinates {
  const pointLength = length(point);

  if (pointLength <= 0.0001) {
    return [1, 0, 0];
  }

  return [
    point[0] / pointLength,
    point[1] / pointLength,
    point[2] / pointLength,
  ];
}

function length(point: NodeCoordinates): number {
  return Math.sqrt(
    point[0] * point[0] +
      point[1] * point[1] +
      point[2] * point[2],
  );
}

function hashStringToUnit(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function smoothstep01(value: number): number {
  const clampedValue = clamp(value, 0, 1);

  return clampedValue * clampedValue * (3 - 2 * clampedValue);
}
