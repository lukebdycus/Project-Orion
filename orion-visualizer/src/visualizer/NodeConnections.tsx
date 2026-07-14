import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { createBeamRoute } from './beamRoutes';
import { BeamShape, createRandomBeamBlob } from './beamBlobs';
import type {
  BeamRoute,
  BeamBlob,
  NodeConnectionsProps,
  NodeCoordinates,
  NodeZone,
  VisualNode,
} from './types';

type ActiveBeam = {
  id: string;
  route: BeamRoute;
  startedAt: number;
  duration: number;
  color: string;
  lineWidth: number;
};

type BeamFrame = {
  points: NodeCoordinates[];
  opacity: number;
};

const spawnInterval = 0.15;
const maxActiveBeams = 40;
const revealRatio = 0.35;

const beamColors: Record<NodeZone, string> = {
  center: '#ffffff',
  middle: '#ffffff',
  edge: '#ffffff',
};

const beamDurations: Record<NodeZone, number> = {
  center: 0.85,
  middle: 0.95,
  edge: 1.05,
};

const beamLineWidths: Record<NodeZone, number> = {
  center: 1.25,
  middle: 1.25,
  edge: 1.25,
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

    setActiveBeams((beams) => {
      const liveBeams = beams.filter((beam) => now - beam.startedAt < beam.duration);

      if (!route || route.nodeIds.length < 2) {
        return liveBeams;
      }

      return [...liveBeams, createActiveBeam(route, now)].slice(-maxActiveBeams);
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
  const [frame, setFrame] = useState<BeamFrame>({
    points: [],
    opacity: 0,
  });
  const reachedNodeIndexes = useRef(new Set<number>());
  const [shapeBlobs, setShapeBlobs] = useState<BeamBlob[]>([]);

  const routePoints = useMemo(() => {
    return beam.route.nodeIds
      .map((nodeId) => nodeById.get(nodeId)?.position)
      .filter((position): position is NodeCoordinates => Boolean(position));
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

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const age = now - beam.startedAt;
    const revealDuration = beam.duration * revealRatio;
    const fadeDuration = beam.duration - revealDuration;
    const fadeStartsAt = beam.startedAt + revealDuration;

    for (let index = 0; index < routePoints.length; index += 1) {
      const hasReachedNode = hasBeamReachedNode(
        now,
        beam,
        nodeCumulativeDistances[index],
        totalRouteLength,
      );

      const nodeId = beam.route.nodeIds[index];

      if (
        hasReachedNode &&
        !reachedNodeIndexes.current.has(index) &&
        nodeId !== 'center-0'
      ) {
        reachedNodeIndexes.current.add(index);
        const blob = createRandomBeamBlob({
          id: `${beam.id}:${index}`,
          nodeId,
          position: routePoints[index],
          activatedAt: now,
          fadeStartsAt,
          fadeDuration,
        });

        setShapeBlobs((currentBlobs) => [
          ...currentBlobs,
          blob,
        ]);
      }
    }

    setShapeBlobs((currentBlobs) => {
      const liveBlobs = currentBlobs.filter(
        (blob) => now < blob.fadeStartsAt + blob.fadeDuration,
      );

      return liveBlobs.length === currentBlobs.length ? currentBlobs : liveBlobs;
    });

    const fadeIn = clamp(age / 0.08, 0, 1);
    
    if (age <= revealDuration) {
      const revealProgress = clamp(age / revealDuration, 0, 1);
      const routeCompletion = revealProgress; 
      const routePulse = 0.35 + Math.pow(routeCompletion, 2.5) * 0.75;

      setFrame({
        points: getRevealedPolyline(routePoints, revealProgress),
        opacity: fadeIn * routePulse,
      });

      return;
    }

    const fadeProgress = clamp((age - revealDuration) / fadeDuration, 0, 1);

    setFrame({
      points: routePoints,
      opacity: 1 - fadeProgress,
    });
  });

  if (frame.points.length < 2 || frame.opacity <= 0) {
    return null;
  }

  return (
    <group renderOrder={20}>
      <Line
        points={frame.points}
        color={beam.color}
        transparent
        opacity={frame.opacity * 0.75}
        lineWidth={beam.lineWidth * 0.75}
        depthWrite={false}
        depthTest={false}
      />
      <Line
        points={frame.points}
        color="#ffffff"
        transparent
        opacity={frame.opacity}
        lineWidth={beam.lineWidth}
        depthWrite={false}
        depthTest={false}
      />
      {shapeBlobs.map((blob) => (
        <BeamShape key={blob.id} blob={blob} />
      ))}
    </group>

  );
}

function createActiveBeam(route: BeamRoute, startedAt: number): ActiveBeam {
  return {
    id: route.id,
    route,
    startedAt,
    duration: beamDurations[route.zone],
    color: beamColors[route.zone],
    lineWidth: beamLineWidths[route.zone],
  };
}

function getRevealedPolyline(
  points: NodeCoordinates[],
  revealProgress: number,
): NodeCoordinates[] {
  if (points.length < 2) {
    return [];
  }

  const totalLength = getPolylineLength(points);
  
  if (totalLength === 0) {
    return points.slice(0, 2);
  }

  const headDistance = clamp(revealProgress, 0, 1) * totalLength;
  const revealedPoints: NodeCoordinates[] = [points[0]];
  let traveled = 0;

  for (let index = 1; index < points.length; index += 1) {
    if (headDistance <= traveled) {
      break;
    }

    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);
    const segmentEndDistance = traveled + segmentLength;

    if (headDistance >= segmentEndDistance) {
      revealedPoints.push(end);
      traveled = segmentEndDistance;
      continue;
    }

    const segmentProgress = (headDistance - traveled) / segmentLength;
    revealedPoints.push(lerpPoint(start, end, segmentProgress));
    break;
  }

  return revealedPoints;
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

function hasBeamReachedNode(
  now: number,
  beam: ActiveBeam,
  nodeCumulativeDistance: number,
  totalRouteLength: number
): boolean {
    const age = now - beam.startedAt;
    const revealDuration = beam.duration * revealRatio;
    const routeProgress = clamp(age / revealDuration, 0, 1);
    const distanceTraveled = totalRouteLength * routeProgress;

  return distanceTraveled >= nodeCumulativeDistance;
}
