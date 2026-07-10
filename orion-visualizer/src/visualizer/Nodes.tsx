import type { VisualNode, ZoneColor, NodeZone } from "./types";

type NodeProps = {
  node: VisualNode;
}

const zoneColors: Record<NodeZone, ZoneColor> = {
  center: {
    color: '#ffffff',
    emissive: '#2758b3',
   },
   middle: {
    color: '#ffffff',
    emissive: '#21e34b',
   },
   edge: {
    color: '#ffffff',
    emissive: '#dc1f1f',
   },
};

export function Node({ node }: NodeProps) {
  const theme = zoneColors[node.zone];

  return (
    <mesh position={node.position}>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshStandardMaterial
        color={theme.color}
        emissive={theme.emissive}
        emissiveIntensity={2.0}
        />
    </mesh>
  );
}

