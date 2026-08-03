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
  position: NodeCoordinates;
  activatedAt: number;
  fadeStartsAt: number;
  fadeDuration: number;
  size: number;
  width?: number;
  height?: number;
  angle: number;
  shape: ShapeType;
  palette: BeamBlobPalette;
};

export type ShapeType = 'triangle' | 'square';

export type BeamBlobPalette =
  | 'arcCyan'
  | 'solarAmber'
  | 'ionViolet'
  | 'plasmaMint'
  | 'hotPink';
