import { NodeConnections } from './NodeConnections';
import { Node } from './Nodes';
import { nodes } from './nodeData.ts';

export function NodeField() {
  return (
      <group>
        {nodes.map((node) => (
          <Node key={node.id} node={node} />
        ))}

        <NodeConnections nodes={nodes} />
      </group>
    );
}
