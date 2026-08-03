import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AdditiveBlending,
  DynamicDrawUsage,
} from 'three';
import type {
  BufferGeometry,
  Group,
  InterleavedBufferAttribute,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import type { Line2, LineMaterial } from 'three-stdlib';
import { createBeamRoute } from './beamRoutes';
import {
  BeamShape,
  createRandomBeamBlob,
  pickRandomBeamPalette,
} from './beamBlobs';
import type {
  BeamRoute,
  BeamBlob,
  BeamBlobPalette,
  NodeConnectionsProps,
  NodeCoordinates,
  NodeZone,
  VisualNode,
} from './types';

type ActiveBeam = {
  id: string;
  route: BeamRoute;
  startedAt: number;
  travelDuration: number;
  duration: number;
  packetLength: number;
  palette: BeamBlobPalette;
  lineWidth: number;
  flareRate: number;
  flarePhase: number;
};

type BeamMotion = {
  headDistance: number;
  packetStartDistance: number;
  packetEndDistance: number;
  trailOpacity: number;
  packetOpacity: number;
};

type PolylineSample = {
  point: NodeCoordinates;
  tangent: NodeCoordinates;
};

const spawnInterval = 0.15;
const maxActiveBeams = 40;
const packetExitDuration = 0.12;
const routeHoldDuration = 0.18;
const routeFadeDuration = 1.15;
const particleCount = 16;
const segmentsPerParticle = 2;

const beamSpeeds: Record<NodeZone, number> = {
  center: 25,
  middle: 27,
  edge: 29,
};

const beamLineWidths: Record<NodeZone, number> = {
  center: 1.25,
  middle: 1.25,
  edge: 1.25,
};

const beamFlareRates: Record<NodeZone, number> = {
  center: 2.7,
  middle: 3.8,
  edge: 5.2,
};

export function NodeConnections({ nodes }: NodeConnectionsProps) {
  const nodeById = useMemo(() => {
    return new Map(nodes.map((node) => [node.id, node]));
  }, [nodes]);

  const [activeBeams, setActiveBeams] = useState<ActiveBeam[]>([]);
  const nextBeamAt = useRef(0);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;

    if (now < nextBeamAt.current) {
      return;
    }

    const zone = pickRandomZone();
    const route = createBeamRoute({
      zone,
      direction: randomUnitVector(),
      nodes,
    });
    const routePoints = route ? getRoutePoints(route, nodeById) : [];
    const routeLength = getPolylineLength(routePoints);

    setActiveBeams((beams) => {
      const liveBeams = beams.filter((beam) => now - beam.startedAt < beam.duration);

      if (!route || routePoints.length < 2 || routeLength <= 0.0001) {
        return liveBeams;
      }

      return [...liveBeams, createActiveBeam(route, now, routeLength)].slice(
        -maxActiveBeams,
      );
    });

    nextBeamAt.current = now + spawnInterval;
  });

  return (
    <group>
      {activeBeams.map((beam) => (
        <AnimatedBeam key={beam.id} beam={beam} nodeById={nodeById} />
      ))}
    </group>
  );
}

type AnimatedBeamProps = {
  beam: ActiveBeam;
  nodeById: Map<string, VisualNode>;
};

function AnimatedBeam({ beam, nodeById }: AnimatedBeamProps) {
  const trailHalo = useRef<Line2>(null);
  const trailCore = useRef<Line2>(null);
  const packetHalo = useRef<Line2>(null);
  const packetCore = useRef<Line2>(null);
  const reachedNodeIndexes = useRef(new Set<number>());
  const [shapeBlobs, setShapeBlobs] = useState<BeamBlob[]>([]);

  const routePoints = useMemo(() => {
    return getRoutePoints(beam.route, nodeById);
  }, [beam.route.nodeIds, nodeById]);

  const totalRouteLength = useMemo(() => {
    return getPolylineLength(routePoints);
  }, [routePoints]);

  const nodeCumulativeDistances = useMemo(() => {
    if (routePoints.length === 0) {
      return [];
    }

    const distances: number[] = [0];

    for (let index = 1; index < routePoints.length; index += 1) {
      const previousPoint = routePoints[index - 1];
      const currentPoint = routePoints[index];
      const segmentLength = distance(previousPoint, currentPoint);
      const previousCumulativeDistance = distances[index - 1];

      distances.push(previousCumulativeDistance + segmentLength);
    }

    return distances;
  }, [routePoints]);

  useLayoutEffect(() => {
    initializeBeamLine(trailHalo.current);
    initializeBeamLine(trailCore.current);
    initializeBeamLine(packetHalo.current);
    initializeBeamLine(packetCore.current);
  }, []);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const age = now - beam.startedAt;
    const motion = getBeamMotion(beam, age, totalRouteLength);
    const flareEnergy = getProceduralFlareEnergy(beam, age);
    const fadeStartsAt =
      beam.startedAt + beam.travelDuration + routeHoldDuration;
    const newlyReachedBlobs: BeamBlob[] = [];

    const trailEndDistance =
      age < beam.travelDuration
        ? motion.headDistance
        : totalRouteLength;

    updateBeamLine(
      trailHalo.current,
      routePoints,
      nodeCumulativeDistances,
      0,
      trailEndDistance,
      motion.trailOpacity * 0.22,
      beam.lineWidth * 1.35,
    );
    updateBeamLine(
      trailCore.current,
      routePoints,
      nodeCumulativeDistances,
      0,
      trailEndDistance,
      motion.trailOpacity,
      beam.lineWidth * 0.64,
    );
    updateBeamLine(
      packetHalo.current,
      routePoints,
      nodeCumulativeDistances,
      motion.packetStartDistance,
      motion.packetEndDistance,
      motion.packetOpacity * (0.24 + flareEnergy * 0.22),
      beam.lineWidth * (2.25 + flareEnergy * 0.85),
    );
    updateBeamLine(
      packetCore.current,
      routePoints,
      nodeCumulativeDistances,
      motion.packetStartDistance,
      motion.packetEndDistance,
      motion.packetOpacity,
      beam.lineWidth * 1.04,
    );

    for (let index = 0; index < routePoints.length; index += 1) {
      const hasReachedNode =
        motion.headDistance >= nodeCumulativeDistances[index];

      const nodeId = beam.route.nodeIds[index];

      if (
        hasReachedNode &&
        !reachedNodeIndexes.current.has(index) &&
        nodeId !== 'center-0'
      ) {
        reachedNodeIndexes.current.add(index);
        newlyReachedBlobs.push(createRandomBeamBlob({
          id: `${beam.id}:${index}`,
          nodeId,
          position: routePoints[index],
          activatedAt: now,
          fadeStartsAt,
          fadeDuration: routeFadeDuration,
          palette: beam.palette,
        }));
      }
    }

    if (newlyReachedBlobs.length > 0) {
      setShapeBlobs((currentBlobs) => [
        ...currentBlobs,
        ...newlyReachedBlobs,
      ]);
    }
  });

  return (
    <group renderOrder={20}>
      <Line
        ref={trailHalo}
        points={routePoints}
        color="#ffffff"
        transparent
        lineWidth={beam.lineWidth * 1.35}
        frustumCulled={false}
        depthWrite={false}
        depthTest={false}
      />
      <Line
        ref={trailCore}
        points={routePoints}
        color="#ffffff"
        transparent
        lineWidth={beam.lineWidth * 0.64}
        frustumCulled={false}
        depthWrite={false}
        depthTest={false}
      />
      <Line
        ref={packetHalo}
        points={routePoints}
        color="#ffffff"
        transparent
        lineWidth={beam.lineWidth * 2.25}
        frustumCulled={false}
        depthWrite={false}
        depthTest={false}
      />
      <Line
        ref={packetCore}
        points={routePoints}
        color="#ffffff"
        transparent
        lineWidth={beam.lineWidth * 1.04}
        frustumCulled={false}
        depthWrite={false}
        depthTest={false}
      />
      <BeamParticles
        beam={beam}
        routePoints={routePoints}
        cumulativeDistances={nodeCumulativeDistances}
        totalRouteLength={totalRouteLength}
      />
      <BeamHead
        beam={beam}
        routePoints={routePoints}
        cumulativeDistances={nodeCumulativeDistances}
        totalRouteLength={totalRouteLength}
      />
      {shapeBlobs.map((blob) => (
        <BeamShape key={blob.id} blob={blob} />
      ))}
    </group>
  );
}

function initializeBeamLine(line: Line2 | null): void {
  if (!line) {
    return;
  }

  const material = getBeamLineMaterial(line);
  const instanceStart = line.geometry.getAttribute(
    'instanceStart',
  ) as InterleavedBufferAttribute;

  line.visible = false;
  line.geometry.instanceCount = 0;

  if (material) {
    material.uniforms.opacity.value = 0;
  }

  if (instanceStart.data.usage !== DynamicDrawUsage) {
    instanceStart.data.setUsage(DynamicDrawUsage);
  }
}

function updateBeamLine(
  line: Line2 | null,
  points: NodeCoordinates[],
  cumulativeDistances: number[],
  startDistance: number,
  endDistance: number,
  opacity: number,
  lineWidth: number,
): void {
  if (!line || points.length < 2 || cumulativeDistances.length !== points.length) {
    return;
  }

  const totalLength = cumulativeDistances[cumulativeDistances.length - 1];
  const clampedStart = clamp(startDistance, 0, totalLength);
  const clampedEnd = clamp(endDistance, 0, totalLength);
  const material = getBeamLineMaterial(line);
  const shouldRender = opacity > 0 && clampedEnd - clampedStart > 0.0001;

  if (!material) {
    return;
  }

  material.uniforms.opacity.value = opacity;
  material.uniforms.linewidth.value = lineWidth;
  line.visible = shouldRender;

  if (!shouldRender) {
    line.geometry.instanceCount = 0;
    return;
  }

  const startSample = samplePolylineAtDistance(
    points,
    cumulativeDistances,
    clampedStart,
  );
  const endSample = samplePolylineAtDistance(
    points,
    cumulativeDistances,
    clampedEnd,
  );

  if (!startSample || !endSample) {
    line.visible = false;
    line.geometry.instanceCount = 0;
    return;
  }

  const instanceStart = line.geometry.getAttribute(
    'instanceStart',
  ) as InterleavedBufferAttribute;
  const linePositions = instanceStart.data.array as Float32Array;
  let segmentCount = 0;
  let previousPoint = startSample.point;

  for (let index = 1; index < points.length - 1; index += 1) {
    const vertexDistance = cumulativeDistances[index];

    if (vertexDistance <= clampedStart || vertexDistance >= clampedEnd) {
      continue;
    }

    if (distance(previousPoint, points[index]) > 0.0001) {
      writeWideLineSegment(
        linePositions,
        segmentCount,
        previousPoint,
        points[index],
      );
      segmentCount += 1;
    }

    previousPoint = points[index];
  }

  if (distance(previousPoint, endSample.point) > 0.0001) {
    writeWideLineSegment(
      linePositions,
      segmentCount,
      previousPoint,
      endSample.point,
    );
    segmentCount += 1;
  }

  instanceStart.data.needsUpdate = true;
  line.geometry.instanceCount = segmentCount;
}

function getBeamLineMaterial(line: Line2): LineMaterial | undefined {
  const material = line.material;

  return (Array.isArray(material) ? material[0] : material) as
    | LineMaterial
    | undefined;
}

function writeWideLineSegment(
  positions: Float32Array,
  segmentIndex: number,
  start: NodeCoordinates,
  end: NodeCoordinates,
): void {
  const offset = segmentIndex * 6;

  positions[offset] = start[0];
  positions[offset + 1] = start[1];
  positions[offset + 2] = start[2];
  positions[offset + 3] = end[0];
  positions[offset + 4] = end[1];
  positions[offset + 5] = end[2];
}

type BeamParticlesProps = {
  beam: ActiveBeam;
  routePoints: NodeCoordinates[];
  cumulativeDistances: number[];
  totalRouteLength: number;
};

type ParticleSeed = {
  phase: number;
  envelope: number;
  headBias: number;
  length: number;
  laneOffset: number;
  flareCosine: number;
  flareSine: number;
  flareLength: number;
  pulsePhase: number;
  pulseRate: number;
};

function BeamParticles({
  beam,
  routePoints,
  cumulativeDistances,
  totalRouteLength,
}: BeamParticlesProps) {
  const geometry = useRef<BufferGeometry>(null);
  const material = useRef<LineBasicMaterial>(null);
  const positions = useMemo(
    () =>
      new Float32Array(
        particleCount * segmentsPerParticle * 2 * 3,
      ),
    [],
  );
  const colors = useMemo(
    () =>
      new Float32Array(
        particleCount * segmentsPerParticle * 2 * 3,
      ),
    [],
  );
  const particleSeeds = useMemo(
    () => createParticleSeeds(beam.id),
    [beam.id],
  );

  useFrame(({ clock, camera }) => {
    if (!geometry.current || !material.current) {
      return;
    }

    const age = clock.elapsedTime - beam.startedAt;
    const motion = getBeamMotion(beam, age, totalRouteLength);
    const visiblePacketLength =
      motion.packetEndDistance - motion.packetStartDistance;
    const flareEnergy = getProceduralFlareEnergy(beam, age);
    const pulsePhase = fract(
      age * beam.flareRate * 0.46 + beam.flarePhase,
    );
    const pulsePosition =
      0.5 - Math.cos(pulsePhase * Math.PI * 2) * 0.5;

    if (motion.packetOpacity <= 0 || visiblePacketLength <= 0.0001) {
      geometry.current.setDrawRange(0, 0);
      material.current.opacity = 0;
      return;
    }

    let visibleSegments = 0;

    for (const seed of particleSeeds) {
      const particleDistance =
        motion.packetStartDistance + visiblePacketLength * seed.phase;
      const sample = samplePolylineAtDistance(
        routePoints,
        cumulativeDistances,
        particleDistance,
      );

      if (!sample) {
        continue;
      }

      const perpendicular = getParticlePerpendicular(sample.tangent);
      const viewDirection = normalizePoint([
        camera.position.x - sample.point[0],
        camera.position.y - sample.point[1],
        camera.position.z - sample.point[2],
      ]);
      const screenPerpendicularCandidate = crossPoint(
        sample.tangent,
        viewDirection,
      );
      const screenPerpendicular =
        pointLength(screenPerpendicularCandidate) > 0.0001
          ? normalizePoint(screenPerpendicularCandidate)
          : perpendicular;
      const screenTangent = normalizePoint(
        crossPoint(viewDirection, screenPerpendicular),
      );
      const envelope = seed.envelope;
      const pulseDistance = Math.abs(seed.phase - pulsePosition);
      const travelingPulse = Math.exp(
        -Math.pow(pulseDistance / 0.105, 2),
      );
      const microPhase = fract(
        age * beam.flareRate * seed.pulseRate + seed.pulsePhase,
      );
      const microPulse = Math.pow(pulseEnvelope(microPhase), 1.65);
      const headBias = seed.headBias;
      const localFlare = clamp(
        0.06 +
          flareEnergy * (0.2 + travelingPulse * 0.82) +
          microPulse * 0.38 +
          headBias * (0.24 + flareEnergy * 0.5),
        0,
        1,
      );
      const laneOffset =
        seed.laneOffset * envelope * (0.52 + localFlare * 0.9);
      const center = addScaledPoint(
        sample.point,
        perpendicular,
        laneOffset,
      );
      const halfLength =
        seed.length * (0.42 + localFlare * 1.72) * 0.5;
      const start = addScaledPoint(center, sample.tangent, -halfLength);
      const end = addScaledPoint(center, sample.tangent, halfLength);
      const particleIntensity = 0.42 + localFlare * 0.58;

      writeLineSegment(
        positions,
        colors,
        visibleSegments,
        start,
        end,
        particleIntensity,
      );
      visibleSegments += 1;

      const flareDirection = normalizePoint(
        addScaledPoint(
          scalePoint(
            screenPerpendicular,
            seed.flareCosine,
          ),
          screenTangent,
          seed.flareSine,
        ),
      );
      const flareHalfLength =
        seed.flareLength * envelope * localFlare * 0.5;
      const flareStart = addScaledPoint(
        center,
        flareDirection,
        -flareHalfLength,
      );
      const flareEnd = addScaledPoint(
        center,
        flareDirection,
        flareHalfLength,
      );

      writeLineSegment(
        positions,
        colors,
        visibleSegments,
        flareStart,
        flareEnd,
        localFlare * 0.9,
      );
      visibleSegments += 1;
    }

    const positionAttribute = geometry.current.getAttribute('position');
    const colorAttribute = geometry.current.getAttribute('color');
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    geometry.current.setDrawRange(0, visibleSegments * 2);
    material.current.opacity =
      motion.packetOpacity * (0.62 + flareEnergy * 0.28);
  });

  return (
    <lineSegments renderOrder={23} frustumCulled={false}>
      <bufferGeometry ref={geometry}>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          usage={DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          usage={DynamicDrawUsage}
        />
      </bufferGeometry>
      <lineBasicMaterial
        ref={material}
        color="#ffffff"
        vertexColors
        transparent
        opacity={0}
        blending={AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

type BeamHeadProps = {
  beam: ActiveBeam;
  routePoints: NodeCoordinates[];
  cumulativeDistances: number[];
  totalRouteLength: number;
};

function BeamHead({
  beam,
  routePoints,
  cumulativeDistances,
  totalRouteLength,
}: BeamHeadProps) {
  const group = useRef<Group>(null);
  const coreMaterial = useRef<MeshBasicMaterial>(null);
  const glowMesh = useRef<Mesh>(null);
  const glowMaterial = useRef<MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (
      !group.current ||
      !coreMaterial.current ||
      !glowMesh.current ||
      !glowMaterial.current
    ) {
      return;
    }

    const age = clock.elapsedTime - beam.startedAt;
    const motion = getBeamMotion(beam, age, totalRouteLength);
    const flare = getProceduralFlareEnergy(beam, age);
    const headSample = samplePolylineAtDistance(
      routePoints,
      cumulativeDistances,
      motion.packetEndDistance,
    );
    const isVisible = Boolean(headSample) && motion.packetOpacity > 0;

    group.current.visible = isVisible;

    if (!headSample || !isVisible) {
      return;
    }

    group.current.position.set(...headSample.point);
    group.current.scale.setScalar(
      0.84 + motion.packetOpacity * 0.12 + flare * 0.14,
    );
    coreMaterial.current.opacity = motion.packetOpacity;
    glowMesh.current.scale.setScalar(2 + flare * 1.45);
    glowMaterial.current.opacity =
      motion.packetOpacity * (0.1 + flare * 0.2);
  });

  return (
    <group ref={group} visible={false}>
      <mesh renderOrder={24}>
        <octahedronGeometry args={[0.047, 0]} />
        <meshBasicMaterial
          ref={coreMaterial}
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glowMesh} renderOrder={23}>
        <octahedronGeometry args={[0.047, 0]} />
        <meshBasicMaterial
          ref={glowMaterial}
          color="#ffffff"
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function createActiveBeam(
  route: BeamRoute,
  startedAt: number,
  routeLength: number,
): ActiveBeam {
  const speed = beamSpeeds[route.zone];
  const travelDuration = routeLength / speed;
  const flareRateJitter =
    0.82 + hashStringToUnit(`${route.id}:flare-rate`) * 0.36;

  return {
    id: route.id,
    route,
    startedAt,
    travelDuration,
    duration: travelDuration + routeHoldDuration + routeFadeDuration,
    packetLength: routeLength,
    palette: pickRandomBeamPalette(),
    lineWidth: beamLineWidths[route.zone],
    flareRate: beamFlareRates[route.zone] * flareRateJitter,
    flarePhase: hashStringToUnit(`${route.id}:flare-phase`),
  };
}

function getProceduralFlareEnergy(
  beam: ActiveBeam,
  age: number,
): number {
  const primaryPhase = fract(age * beam.flareRate + beam.flarePhase);
  const secondaryPhase = fract(primaryPhase + 0.57);
  const primaryHit = pulseEnvelope(primaryPhase);
  const secondaryHit = pulseEnvelope(secondaryPhase) * 0.28;
  const carrier =
    Math.pow(
      0.5 +
        Math.sin(
          age * beam.flareRate * Math.PI * 2 * 1.9 +
            beam.flarePhase * Math.PI * 2,
        ) *
          0.5,
      6,
    ) * 0.12;

  return clamp(0.14 + primaryHit * 0.66 + secondaryHit + carrier, 0, 1);
}

function getBeamMotion(
  beam: ActiveBeam,
  age: number,
  totalRouteLength: number,
): BeamMotion {
  const fadeIn = smoothstep01(clamp(age / 0.055, 0, 1));

  if (age <= beam.travelDuration) {
    const travelProgress = clamp(age / beam.travelDuration, 0, 1);
    const headDistance = totalRouteLength * travelProgress;

    return {
      headDistance,
      packetStartDistance: Math.max(0, headDistance - beam.packetLength),
      packetEndDistance: headDistance,
      trailOpacity:
        fadeIn * (0.18 + Math.pow(travelProgress, 2.2) * 0.14),
      packetOpacity: fadeIn,
    };
  }

  const completionAge = age - beam.travelDuration;
  const packetExitProgress = clamp(
    completionAge / packetExitDuration,
    0,
    1,
  );
  const virtualHeadDistance =
    totalRouteLength + beam.packetLength * packetExitProgress;
  const routeFadeProgress = clamp(
    (completionAge - routeHoldDuration) / routeFadeDuration,
    0,
    1,
  );

  return {
    headDistance: totalRouteLength,
    packetStartDistance: Math.min(
      virtualHeadDistance - beam.packetLength,
      totalRouteLength,
    ),
    packetEndDistance: totalRouteLength,
    trailOpacity: 0.52 * (1 - smoothstep01(routeFadeProgress)),
    packetOpacity: 1 - smoothstep01(packetExitProgress),
  };
}

function samplePolylineAtDistance(
  points: NodeCoordinates[],
  cumulativeDistances: number[],
  targetDistance: number,
): PolylineSample | null {
  if (points.length < 2 || cumulativeDistances.length !== points.length) {
    return null;
  }

  const totalLength = cumulativeDistances[cumulativeDistances.length - 1];
  const clampedDistance = clamp(targetDistance, 0, totalLength);

  for (let index = 1; index < points.length; index += 1) {
    const segmentStartDistance = cumulativeDistances[index - 1];
    const segmentEndDistance = cumulativeDistances[index];
    const segmentLength = segmentEndDistance - segmentStartDistance;

    if (segmentLength <= 0.0001) {
      continue;
    }

    if (clampedDistance <= segmentEndDistance || index === points.length - 1) {
      const progress = clamp(
        (clampedDistance - segmentStartDistance) / segmentLength,
        0,
        1,
      );

      return {
        point: lerpPoint(points[index - 1], points[index], progress),
        tangent: normalizePoint(subtractPoint(points[index], points[index - 1])),
      };
    }
  }

  return null;
}

function getRoutePoints(
  route: BeamRoute,
  nodeById: Map<string, VisualNode>,
): NodeCoordinates[] {
  return route.nodeIds
    .map((nodeId) => nodeById.get(nodeId)?.position)
    .filter((position): position is NodeCoordinates => Boolean(position));
}

function createParticleSeeds(beamId: string): ParticleSeed[] {
  return Array.from({ length: particleCount }, (_, index) => {
    const phaseJitter =
      (hashStringToUnit(`${beamId}:phase:${index}`) - 0.5) * 0.45;
    const phase = clamp(
      (index + 0.5 + phaseJitter) / particleCount,
      0.035,
      0.965,
    );
    const flareAngle =
      hashStringToUnit(`${beamId}:flare-angle:${index}`) * Math.PI;

    return {
      phase,
      envelope: Math.sin(Math.PI * phase),
      headBias: smoothstep(0.78, 1, phase),
      length:
        0.055 + hashStringToUnit(`${beamId}:length:${index}`) * 0.11,
      laneOffset:
        (hashStringToUnit(`${beamId}:lane:${index}`) - 0.5) * 0.11,
      flareCosine: Math.cos(flareAngle),
      flareSine: Math.sin(flareAngle),
      flareLength:
        0.16 +
        hashStringToUnit(`${beamId}:flare-length:${index}`) * 0.62,
      pulsePhase: hashStringToUnit(`${beamId}:pulse-phase:${index}`),
      pulseRate:
        1.3 + hashStringToUnit(`${beamId}:pulse-rate:${index}`) * 1.25,
    };
  });
}

function writeLineSegment(
  positions: Float32Array,
  colors: Float32Array,
  segmentIndex: number,
  start: NodeCoordinates,
  end: NodeCoordinates,
  intensity: number,
): void {
  const offset = segmentIndex * 6;
  const clampedIntensity = clamp(intensity, 0, 1);

  positions[offset] = start[0];
  positions[offset + 1] = start[1];
  positions[offset + 2] = start[2];
  positions[offset + 3] = end[0];
  positions[offset + 4] = end[1];
  positions[offset + 5] = end[2];

  colors[offset] = clampedIntensity;
  colors[offset + 1] = clampedIntensity;
  colors[offset + 2] = clampedIntensity;
  colors[offset + 3] = clampedIntensity;
  colors[offset + 4] = clampedIntensity;
  colors[offset + 5] = clampedIntensity;
}

function hashStringToUnit(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function getParticlePerpendicular(
  tangent: NodeCoordinates,
): NodeCoordinates {
  let perpendicular = crossPoint(tangent, [0, 0, 1]);

  if (pointLength(perpendicular) <= 0.0001) {
    perpendicular = crossPoint(tangent, [0, 1, 0]);
  }

  return normalizePoint(perpendicular);
}

function addScaledPoint(
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

function scalePoint(
  point: NodeCoordinates,
  scale: number,
): NodeCoordinates {
  return [point[0] * scale, point[1] * scale, point[2] * scale];
}

function subtractPoint(
  a: NodeCoordinates,
  b: NodeCoordinates,
): NodeCoordinates {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function crossPoint(
  a: NodeCoordinates,
  b: NodeCoordinates,
): NodeCoordinates {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalizePoint(point: NodeCoordinates): NodeCoordinates {
  const length = pointLength(point);

  if (length <= 0.0001) {
    return [1, 0, 0];
  }

  return [point[0] / length, point[1] / length, point[2] / length];
}

function pointLength(point: NodeCoordinates): number {
  return Math.sqrt(
    point[0] * point[0] +
      point[1] * point[1] +
      point[2] * point[2],
  );
}

function getPolylineLength(points: NodeCoordinates[]): number {
  let length = 0;

  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1], points[index]);
  }

  return length;
}

function lerpPoint(
  start: NodeCoordinates,
  end: NodeCoordinates,
  progress: number,
): NodeCoordinates {
  return [
    start[0] + (end[0] - start[0]) * progress,
    start[1] + (end[1] - start[1]) * progress,
    start[2] + (end[2] - start[2]) * progress,
  ];
}

function distance(a: NodeCoordinates, b: NodeCoordinates): number {
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  const z = a[2] - b[2];

  return Math.sqrt(x * x + y * y + z * z);
}

function pickRandomZone(): NodeZone {
  const zones: NodeZone[] = ['center', 'middle', 'edge'];
  return zones[Math.floor(Math.random() * zones.length)];
}

function randomUnitVector(): NodeCoordinates {
  const z = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(1 - z * z);

  return [
    radius * Math.cos(theta),
    radius * Math.sin(theta),
    z,
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function pulseEnvelope(phase: number): number {
  const normalizedPhase = fract(phase);
  const attack = smoothstep(0, 0.18, normalizedPhase);
  const release = 1 - smoothstep(0.18, 1, normalizedPhase);

  return attack * release;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  return smoothstep01(clamp((value - edge0) / (edge1 - edge0), 0, 1));
}

function smoothstep01(value: number): number {
  const clampedValue = clamp(value, 0, 1);
  return clampedValue * clampedValue * (3 - 2 * clampedValue);
}
