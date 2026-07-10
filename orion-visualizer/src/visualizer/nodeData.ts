import type { NodeCoordinates, NodeRole, NodeZone, VisualNode } from './types.ts';

type ClusterConfig = {
  count: number;
  maxRadius: number;
  minRadius: number;
  prefix: string;
  role: NodeRole;
  seed: number;
  startIndex: number;
  zone: NodeZone;
};

const clusterSize = 112;
const goldenAngle = Math.PI * (3 - Math.sqrt(5));

export const nodes: VisualNode[] = [
  {
    id: 'center-0',
    position: [0, 0, 0],
    zone: 'center',
    role: 'Bass',
  },
  ...createClusterNodes({
    count: clusterSize - 1,
    maxRadius: 3.9,
    minRadius: 0.7,
    prefix: 'center',
    role: 'Bass',
    seed: 17,
    startIndex: 1,
    zone: 'center',
  }),
  ...createClusterNodes({
    count: clusterSize,
    maxRadius: 6.3,
    minRadius: 3.7,
    prefix: 'middle',
    role: 'Mid',
    seed: 43,
    startIndex: 1,
    zone: 'middle',
  }),
  ...createClusterNodes({
    count: clusterSize,
    maxRadius: 8.7,
    minRadius: 6.3,
    prefix: 'edge',
    role: 'Treble',
    seed: 89,
    startIndex: 1,
    zone: 'edge',
  }),
];

function createClusterNodes({
  count,
  maxRadius,
  minRadius,
  prefix,
  role,
  seed,
  startIndex,
  zone,
}: ClusterConfig): VisualNode[] {
  return Array.from({ length: count }, (_, index) => {
    const nodeIndex = startIndex + index;
    const direction = createStarDirection(index, count, seed);
    const radius = createClusterRadius(index, count, minRadius, maxRadius, seed);
    const position = scalePosition(direction, radius);

    return {
      id: `${prefix}-${nodeIndex}`,
      position,
      zone,
      role,
    };
  });
}

function createStarDirection(index: number, count: number, seed: number): NodeCoordinates {
  const verticalPosition = 1 - ((index + 0.5) / count) * 2;
  const horizontalRadius = Math.sqrt(Math.max(0, 1 - verticalPosition * verticalPosition));
  const angle = index * goldenAngle + seed * 0.31;
  const direction: NodeCoordinates = [
    Math.cos(angle) * horizontalRadius,
    verticalPosition,
    Math.sin(angle) * horizontalRadius,
  ];
  const jitter: NodeCoordinates = [
    randomSigned(seed + index * 11.1),
    randomSigned(seed + index * 17.7),
    randomSigned(seed + index * 23.3),
  ];

  return normalize([
    direction[0] + jitter[0] * 0.16,
    direction[1] + jitter[1] * 0.16,
    direction[2] + jitter[2] * 0.16,
  ]);
}

function createClusterRadius(
  index: number,
  count: number,
  minRadius: number,
  maxRadius: number,
  seed: number,
): number {
  const radialSlot = ((index * 37) % count + 0.5) / count;
  const jitter = randomSigned(seed + index * 31.9) * 0.08;
  const radiusProgress = clamp(radialSlot + jitter, 0, 1);

  return minRadius + (maxRadius - minRadius) * radiusProgress;
}

function scalePosition(direction: NodeCoordinates, radius: number): NodeCoordinates {
  return [
    roundCoordinate(direction[0] * radius),
    roundCoordinate(direction[1] * radius),
    roundCoordinate(direction[2] * radius),
  ];
}

function normalize([x, y, z]: NodeCoordinates): NodeCoordinates {
  const length = Math.sqrt(x * x + y * y + z * z);

  if (length === 0) {
    return [1, 0, 0];
  }

  return [x / length, y / length, z / length];
}

function randomSigned(seed: number): number {
  return seededRandom(seed) * 2 - 1;
}

function seededRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
