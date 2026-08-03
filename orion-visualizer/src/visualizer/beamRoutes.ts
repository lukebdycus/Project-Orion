import type { NodeZone, BeamRoute, VisualNode, NodeCoordinates } from "./types";

type CreateBeamRouteInput = {
  zone: NodeZone;
  direction: NodeCoordinates;
  nodes: VisualNode[];
};

type ChooseNextNodeInput = {
  nodes: VisualNode[];
  currentNode: VisualNode;
  targetZone: NodeZone;
  direction: NodeCoordinates;
  usedNodeIds: string[];
};

type ScoredNode = {
  node: VisualNode;
  score: number;
};

const originNodeId = 'center-0';

const routeProgression: Record<NodeZone, NodeZone[]> = {
  center: ['center', 'center', 'center', 'center', 'center'],
  middle: ['center', 'middle', 'middle', 'middle', 'middle'],
  edge: ['center', 'middle', 'middle', 'edge', 'edge', 'edge', 'edge'],
};

const topCandidateCount = 5;

export function createBeamRoute({
  zone,
  direction,
  nodes,
}: CreateBeamRouteInput): BeamRoute | null {
  const originNode = nodes.find((node) => node.id === originNodeId);

  if (!originNode) {
    return null;
  }

  const normalizedDirection = normalize(direction);
  const nodeIds: string[] = [originNode.id];

  let currentNode = originNode;

  for (const targetZone of routeProgression[zone]) {
    const nextNode = chooseNextNode({
      nodes,
      currentNode,
      targetZone,
      direction: normalizedDirection,
      usedNodeIds: nodeIds,
    });

    if (!nextNode) {
      break;
    }

    nodeIds.push(nextNode.id);
    currentNode = nextNode;
  }

  return {
    id: createRouteId(zone),
    zone,
    direction: normalizedDirection,
    nodeIds,
  };
}

function chooseNextNode({
  nodes,
  currentNode,
  targetZone,
  direction,
  usedNodeIds,
}: ChooseNextNodeInput): VisualNode | null {
  const candidates = nodes
    .filter((node) => node.zone === targetZone)
    .filter((node) => !usedNodeIds.includes(node.id))
    .map((node) => ({
      node,
      score: scoreNode(node, currentNode, direction),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topCandidateCount);

  if (candidates.length === 0) {
    return null;
  }

  return pickWeightedCandidate(candidates);
}

function scoreNode(
  candidateNode: VisualNode,
  currentNode: VisualNode,
  direction: NodeCoordinates,
): number {
  const candidateDirection = normalize(candidateNode.position);
  const travelDirection = normalize(subtract(candidateNode.position, currentNode.position));

  const alignmentFromOrigin = dot(candidateDirection, direction);
  const alignmentFromCurrent = dot(travelDirection, direction);

  const currentRadius = distanceFromOrigin(currentNode.position);
  const candidateRadius = distanceFromOrigin(candidateNode.position);
  const outwardMovement = candidateRadius > currentRadius ? 1 : 0.25;

  const distanceBetweenNodes = distance(currentNode.position, candidateNode.position);
  const distanceComfort = 1 / (1 + distanceBetweenNodes);

  return (
    alignmentFromOrigin * 3 +
    alignmentFromCurrent * 2 +
    outwardMovement * 1.5 +
    distanceComfort
  );
}

function pickWeightedCandidate(candidates: ScoredNode[]): VisualNode {
  const totalScore = candidates.reduce((sum, candidate) => sum + candidate.score, 0);
  let roll = Math.random() * totalScore;

  for (const candidate of candidates) {
    roll -= candidate.score;

    if (roll <= 0) {
      return candidate.node;
    }
  }

  return candidates[0].node;
}

function normalize([x, y, z]: NodeCoordinates): NodeCoordinates {
  const length = Math.sqrt(x * x + y * y + z * z);

  if (length === 0) {
    return [1, 0, 0];
  }

  return [x / length, y / length, z / length];
}

function subtract(a: NodeCoordinates, b: NodeCoordinates): NodeCoordinates {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: NodeCoordinates, b: NodeCoordinates): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function distanceFromOrigin(position: NodeCoordinates): number {
  return Math.sqrt(dot(position, position));
}

function distance(a: NodeCoordinates, b: NodeCoordinates): number {
  return distanceFromOrigin(subtract(a, b));
}

function createRouteId(zone: NodeZone): string {
  return `${zone}-route-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}