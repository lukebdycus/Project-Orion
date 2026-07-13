import { Billboard, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import type { Line2 } from 'three-stdlib';
import type { BeamBlob, NodeCoordinates, ShapeType } from './types';

const minSize = 0.3;
const maxSize = 0.75;
const fullTurn = Math.PI * 2;

const unitSquarePoints: NodeCoordinates[] = [
  [-0.5, -0.5, 0],
  [0.5, -0.5, 0],
  [0.5, 0.5, 0],
  [-0.5, 0.5, 0],
  [-0.5, -0.5, 0],
];

const unitTrianglePoints: NodeCoordinates[] = [
  [0, 0.58, 0],
  [-0.5, -0.29, 0],
  [0.5, -0.29, 0],
  [0, 0.58, 0],
];

const shapePoints: Record<ShapeType, NodeCoordinates[]> = {
  square: unitSquarePoints,
  triangle: unitTrianglePoints,
};

const shapeTypes: ShapeType[] = ['square', 'triangle'];

type CreateBeamBlobInput = Pick<
  BeamBlob,
  'id' | 'nodeId' | 'position' | 'activatedAt' | 'fadeStartsAt' | 'fadeDuration'
>;

export function createRandomBeamBlob({
  id,
  nodeId,
  position,
  activatedAt,
  fadeStartsAt,
  fadeDuration,
}: CreateBeamBlobInput): BeamBlob {
  const shape = pickRandomShape();

  return {
    id,
    nodeId,
    position,
    activatedAt,
    fadeStartsAt,
    fadeDuration,
    size: randomInRange(minSize, maxSize),
    angle: Math.random() * fullTurn,
    shape,
    ...(shape === 'square'
      ? {
          width: randomInRange(minSize, maxSize),
          height: randomInRange(minSize, maxSize),
        }
      : {}),
  };
}

export function BeamShape({ blob }: { blob: BeamBlob }) {
  const shapeGroup = useRef<Group>(null);
  const line = useRef<Line2>(null);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const fadeProgress = clamp(
      (now - blob.fadeStartsAt) / blob.fadeDuration,
      0,
      1,
    );
    const isActive = now >= blob.activatedAt && fadeProgress < 1;

    if (!shapeGroup.current || !line.current) {
      return;
    }

    shapeGroup.current.visible = isActive;

    if (!isActive) {
      return;
    }

    const opacity = 1 - fadeProgress;

    if (blob.shape === 'square') {
      shapeGroup.current.scale.set(
        blob.width ?? blob.size,
        blob.height ?? blob.size,
        1,
      );
    } else {
      shapeGroup.current.scale.setScalar(blob.size);
    }
    shapeGroup.current.rotation.z = blob.angle;
    line.current.material.opacity = opacity;
  });

  return (
    <Billboard position={blob.position}>
      <group ref={shapeGroup}>
        <Line
          ref={line}
          points={shapePoints[blob.shape]}
          color="#ffffff"
          lineWidth={1.25}
          transparent
          depthWrite={false}
          depthTest={false}
        />
      </group>
    </Billboard>
  );
}

function pickRandomShape(): ShapeType {
  const index = Math.floor(Math.random() * shapeTypes.length);
  return shapeTypes[index];
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
