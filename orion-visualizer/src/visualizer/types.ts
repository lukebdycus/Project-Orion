export type NodeCoordinates = [number, number, number];

export type VisualNode = {
  id: string;
  position: NodeCoordinates;
  zone: NodeZone;
  role: NodeRole;
}

export type NodeZone = 'center' | 'middle' | 'edge';

export type NodeRole = 'Bass' | 'Mid' | 'Treble';

export type ZoneColor = {
  color: string;
  emissive: string;
};

export type NodeConnectionsProps = {
  nodes: VisualNode[];
};

export type BeamRoute = {
  id: string;
  zone: NodeZone;
  direction: NodeCoordinates;
  nodeIds: string[];
};

export type BeamBlob = {
  id: string;
  nodeId: string;
}