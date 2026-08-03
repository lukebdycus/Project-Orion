import { NodeConnections } from './NodeConnections';
import { Node } from './Nodes';
import { nodes } from './nodeData.ts';

export function NodeField() {
  return (
      <group>
        {nodes.filter((node) => node.id !== 'center-0').map((node) => (
          <Node key={node.id} node={node} />
        ))}

        <NodeConnections nodes={nodes} />
      </group>
    );
}
