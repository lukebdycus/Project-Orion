import { Billboard, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, Shape } from 'three';
import type { Group, ShaderMaterial } from 'three';
import type { Line2 } from 'three-stdlib';
import type {
  BeamBlob,
  BeamBlobPalette,
  NodeCoordinates,
  ShapeType,
} from './types';

const minSize = 1.5;
const maxSize = 2.0;
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
const paletteTypes: BeamBlobPalette[] = [
  'arcCyan',
  'arcCyan',
  'hotPink',
  'solarAmber',
  'ionViolet',
  'plasmaMint',
];

const colorPalettes: Record<
  BeamBlobPalette,
  readonly [string, string, string]
> = {
  arcCyan: ['#010b13', '#dcfbff', '#2edde8'],
  solarAmber: ['#140900', '#fff1c2', '#ffad45'],
  ionViolet: ['#0c0318', '#e3b19f', '#c10707'],
  plasmaMint: ['#010e0c', '#dcfff8', '#34efc1'],
  hotPink: ['#1a0000', '#ffb3c6', '#ff4d8f'],
};

export function getBeamPaletteColors(
  palette: BeamBlobPalette,
): readonly [string, string, string] {
  return colorPalettes[palette];
}

const outlineOpacity = 0.8;
const activationWhite = new Color('#ffffff');

function makeFillShape(points: NodeCoordinates[]) {
  if (points.length < 3) {
    throw new Error('A fill shape needs at least three points.');
  }

  const shape = new Shape();
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const repeatsFirstPoint =
    firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1];
  const vertices = repeatsFirstPoint ? points.slice(0, -1) : points;
  const [first, ...rest] = vertices;

  shape.moveTo(first[0], first[1]);

  for (const [x, y] of rest) {
    shape.lineTo(x, y);
  }

  shape.closePath();
  return shape;
}

const fillShapes: Record<ShapeType, Shape> = {
  square: makeFillShape(unitSquarePoints),
  triangle: makeFillShape(unitTrianglePoints),
};

const blobVertexShader = /* glsl */ `
  varying vec2 vLocal;

  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const opticalBubbleFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uActivatedAt;
  uniform float uSeed;
  uniform float uShape;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;

  varying vec2 vLocal;

  const float PI = 3.14159265;
  const float FILM_IOR = 1.333;

  float squareEdgeDistance(vec2 point) {
    return min(0.5 - abs(point.x), 0.5 - abs(point.y));
  }

  float triangleEdgeDistance(vec2 point) {
    float bottom = point.y + 0.29;
    float left = (1.74 * point.x + 0.58 - point.y) / 2.007;
    float right = (-1.74 * point.x + 0.58 - point.y) / 2.007;

    return min(bottom, min(left, right));
  }

  float hash21(vec2 point) {
    vec2 seededPoint = point + vec2(uSeed * 0.37, uSeed * 1.13);
    return fract(
      sin(dot(seededPoint, vec2(127.1, 311.7))) * 43758.5453123
    );
  }

  mat2 rotate2d(float angle) {
    float cosine = cos(angle);
    float sine = sin(angle);
    return mat2(cosine, -sine, sine, cosine);
  }

  float membraneHeight(vec2 point, float isTriangle) {
    float squareProfile = max(
      0.0,
      16.0 *
      (0.25 - point.x * point.x) *
      (0.25 - point.y * point.y)
    );

    float barycentricA = (point.y + 0.29) / 0.87;
    float barycentricB =
      0.5 * (1.0 - barycentricA - 2.0 * point.x);
    float barycentricC =
      0.5 * (1.0 - barycentricA + 2.0 * point.x);
    float triangleProfile = max(
      0.0,
      27.0 * barycentricA * barycentricB * barycentricC
    );
    float profile = mix(squareProfile, triangleProfile, isTriangle);

    return 0.078 * pow(max(profile, 0.0), 0.62);
  }

  float roundedBoxDistance(
    vec2 point,
    vec2 halfSize,
    float radius
  ) {
    vec2 offset = abs(point) - halfSize + radius;

    return
      min(max(offset.x, offset.y), 0.0) +
      length(max(offset, 0.0)) -
      radius;
  }

  vec3 thinFilmReflectance(
    float thicknessNm,
    float cosineIncident,
    out float opticalFootprint
  ) {
    float sineTransmittedSquared =
      (1.0 / (FILM_IOR * FILM_IOR)) *
      (1.0 - cosineIncident * cosineIncident);
    float cosineTransmitted = sqrt(max(
      1.0 - sineTransmittedSquared,
      0.0
    ));

    float baseReflectance = 0.0204;
    float fresnel =
      baseReflectance +
      (1.0 - baseReflectance) *
      pow(1.0 - cosineIncident, 5.0);
    vec3 wavelengthsNm = vec3(650.0, 510.0, 450.0);
    vec3 phase =
      (4.0 * PI * FILM_IOR * thicknessNm * cosineTransmitted) /
      wavelengthsNm;
    vec3 sineTerm = sin(phase * 0.5);
    sineTerm *= sineTerm;
    vec3 reflectance =
      (4.0 * fresnel * sineTerm) /
      (
        (1.0 - fresnel) * (1.0 - fresnel) +
        4.0 * fresnel * sineTerm
      );

    vec3 phaseFootprint = fwidth(phase);
    opticalFootprint = max(
      phaseFootprint.r,
      max(phaseFootprint.g, phaseFootprint.b)
    );
    float luminance = dot(
      reflectance,
      vec3(0.2126, 0.7152, 0.0722)
    );
    float stableChroma =
      0.34 * (1.0 - smoothstep(0.72, 1.65, opticalFootprint));

    return mix(vec3(luminance), reflectance, stableChroma);
  }

  void main() {
    float isTriangle = step(0.5, uShape);
    float edgeDistance = mix(
      squareEdgeDistance(vLocal),
      triangleEdgeDistance(vLocal),
      isTriangle
    );
    float inradius = mix(0.5, 0.289, isTriangle);

    float normalSampleOffset = 0.006;
    float heightLeft = membraneHeight(
      vLocal - vec2(normalSampleOffset, 0.0),
      isTriangle
    );
    float heightRight = membraneHeight(
      vLocal + vec2(normalSampleOffset, 0.0),
      isTriangle
    );
    float heightBottom = membraneHeight(
      vLocal - vec2(0.0, normalSampleOffset),
      isTriangle
    );
    float heightTop = membraneHeight(
      vLocal + vec2(0.0, normalSampleOffset),
      isTriangle
    );
    float heightSlopeX =
      (heightRight - heightLeft) / (2.0 * normalSampleOffset);
    float heightSlopeY =
      (heightTop - heightBottom) / (2.0 * normalSampleOffset);
    vec3 membraneNormal = normalize(vec3(
      -heightSlopeX,
      -heightSlopeY,
      1.0
    ));

    float edgeAA = max(fwidth(edgeDistance), 0.0015);
    float meniscus = 1.0 - smoothstep(
      edgeAA * 0.55,
      edgeAA * 2.8 + 0.026,
      edgeDistance
    );
    float cosineIncident = mix(
      clamp(membraneNormal.z, 0.30, 1.0),
      0.16,
      meniscus
    );

    vec2 localPoint = vLocal * 2.0;
    float blobAngle = uSeed / 2.7;
    vec2 screenPoint = rotate2d(blobAngle) * localPoint;
    float slowTime = uTime * 0.025;
    float seedThickness =
      (hash21(vec2(11.7, 39.4)) - 0.5) * 70.0;
    float drainage = -screenPoint.y * 70.0;
    float membraneModeA =
      64.0 *
      sin(2.10 * localPoint.x + slowTime + uSeed) *
      sin(1.45 * localPoint.y - slowTime * 0.63);
    float membraneModeB =
      32.0 * cos(
        1.25 * localPoint.x -
        1.80 * localPoint.y -
        slowTime * 0.47 +
        uSeed * 0.31
      );
    float thicknessNm = clamp(
      455.0 +
      seedThickness +
      drainage +
      membraneModeA +
      membraneModeB,
      230.0,
      760.0
    );

    float opticalFootprint = 0.0;
    vec3 filmReflectance = thinFilmReflectance(
      thicknessNm,
      cosineIncident,
      opticalFootprint
    );
    float filmLuminance = dot(
      filmReflectance,
      vec3(0.2126, 0.7152, 0.0722)
    );
    float filmPeak = max(
      filmReflectance.r,
      max(filmReflectance.g, filmReflectance.b)
    );
    float paletteStability =
      1.0 - smoothstep(0.72, 1.45, opticalFootprint);
    float broadPaletteBand = smoothstep(
      0.18,
      0.82,
      0.5 + 0.5 * sin(
        thicknessNm * 0.014 +
        cosineIncident * 2.4 +
        uSeed * 0.17
      )
    );
    vec3 liquidTint = mix(
      uColorB,
      uColorC,
      (0.32 + broadPaletteBand * 0.66) * paletteStability
    );
    float liquidPeak = max(
      liquidTint.r,
      max(liquidTint.g, liquidTint.b)
    );
    vec3 liquidDirection = liquidTint / max(liquidPeak, 0.001);
    vec3 paletteReflectance =
      liquidDirection * mix(filmLuminance, filmPeak, 0.72);
    vec3 physicalFilm = mix(
      filmReflectance,
      paletteReflectance,
      mix(0.42, 0.82, paletteStability)
    );

    // A single screen-locked studio card gives every film the same light rig.
    vec2 softboxPoint =
      rotate2d(-0.16) *
      (screenPoint - vec2(-0.31, 0.30));
    float softboxDistance = roundedBoxDistance(
      softboxPoint,
      vec2(0.34, 0.105),
      0.045
    );
    float softbox = 1.0 - smoothstep(
      -0.018,
      0.095,
      softboxDistance
    );
    vec2 auraPoint = softboxPoint / vec2(0.56, 0.22);
    float softboxAura = exp(-dot(auraPoint, auraPoint));
    float lowerReflection = exp(
      -pow((screenPoint.y + 0.48) / 0.17, 2.0)
    ) * smoothstep(-0.72, 0.48, screenPoint.x);

    vec2 radialDirection = normalize(
      screenPoint + vec2(0.0001, -0.0001)
    );
    vec2 studioDirection = normalize(vec2(-0.72, 0.69));
    float directionalRim =
      meniscus *
      pow(max(dot(radialDirection, studioDirection), 0.0), 1.45);
    float fresnel =
      0.0204 +
      (1.0 - 0.0204) *
      pow(1.0 - cosineIncident, 5.0);
    float illuminatedRim = 1.0 - smoothstep(
      edgeAA * 1.5 + 0.020,
      edgeAA * 4.0 + 0.115,
      edgeDistance
    );
    float glowMask =
      illuminatedRim * (0.20 + fresnel * 0.80) +
      softboxAura * (0.045 + fresnel * 0.075) +
      lowerReflection * 0.025;
    vec3 glowColor = mix(uColorC, uColorB, 0.62);

    vec3 cardColor = mix(vec3(0.98), uColorB, 0.26);
    vec3 horizonColor = mix(vec3(0.78, 0.88, 0.92), uColorC, 0.68);
    vec3 neutralRim = mix(vec3(0.99), uColorB, 0.30);
    vec3 accentRim = mix(vec3(0.98), uColorC, 0.68);

    vec3 reflectedEnergy = physicalFilm * 2.82;
    reflectedEnergy +=
      cardColor *
      softbox *
      (0.18 + fresnel * 0.27);
    reflectedEnergy +=
      horizonColor * lowerReflection * (0.065 + fresnel * 0.10);
    reflectedEnergy +=
      neutralRim *
      meniscus *
      (0.072 + fresnel * 0.19);
    reflectedEnergy +=
      accentRim *
      directionalRim *
      (0.13 + fresnel * 0.31);
    reflectedEnergy += glowColor * glowMask * 0.5;
    reflectedEnergy = clamp(reflectedEnergy, vec3(0.0), vec3(0.98));

    float reflectedPeak = max(
      reflectedEnergy.r,
      max(reflectedEnergy.g, reflectedEnergy.b)
    );
    float opticalAlpha = clamp(
      0.085 + reflectedPeak * 0.88,
      0.09,
      0.68
    );
    vec3 color = clamp(
      reflectedEnergy / max(opticalAlpha, 0.001) + uColorA * 0.025,
      vec3(0.0),
      vec3(0.98)
    );
    float activationAge = max(uTime - uActivatedAt, 0.0);
    float activationFlash =
      1.0 - smoothstep(0.03, 0.30, activationAge);
    color = mix(color, vec3(1.0), activationFlash * 0.94);

    float edgeCoverage = smoothstep(
      0.0,
      edgeAA * 1.5,
      edgeDistance
    );
    float flashAlpha = mix(opticalAlpha, 0.90, activationFlash);
    float alpha = uOpacity * edgeCoverage * flashAlpha;

    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

type CreateBeamBlobInput = Pick<
  BeamBlob,
  'id' | 'nodeId' | 'position' | 'activatedAt' | 'fadeStartsAt' | 'fadeDuration'
> & {
  palette?: BeamBlobPalette;
};

export function createRandomBeamBlob({
  id,
  nodeId,
  position,
  activatedAt,
  fadeStartsAt,
  fadeDuration,
  palette = pickRandomBeamPalette(),
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
    palette,
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
  const fillMaterial = useRef<ShaderMaterial>(null);
  const outlineColor = colorPalettes[blob.palette][1];
  const settledOutlineColor = useMemo(
    () => new Color(outlineColor),
    [outlineColor],
  );
  const fillUniforms = useMemo(
    () => {
      const [colorA, colorB, colorC] = colorPalettes[blob.palette];

      return {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uActivatedAt: { value: blob.activatedAt },
        uSeed: { value: blob.angle * 2.7 },
        uShape: { value: blob.shape === 'triangle' ? 1 : 0 },
        uColorA: { value: new Color(colorA) },
        uColorB: { value: new Color(colorB) },
        uColorC: { value: new Color(colorC) },
      };
    },
    [blob.activatedAt, blob.angle, blob.palette, blob.shape],
  );

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const fadeProgress = clamp(
      (now - blob.fadeStartsAt) / blob.fadeDuration,
      0,
      1,
    );
    const isActive = now >= blob.activatedAt && fadeProgress < 1;

    if (!shapeGroup.current || !line.current || !fillMaterial.current) {
      return;
    }

    shapeGroup.current.visible = isActive;

    if (!isActive) {
      return;
    }

    const opacity = 1 - fadeProgress;
    const flashProgress = clamp(
      (now - blob.activatedAt - 0.03) / 0.27,
      0,
      1,
    );
    const flashEase =
      flashProgress * flashProgress * (3 - 2 * flashProgress);
    const activationFlash = (1 - flashEase) * 0.94;

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
    fillMaterial.current.uniforms.uTime.value = now;
    fillMaterial.current.uniforms.uOpacity.value = opacity;
    line.current.material.opacity = opacity * outlineOpacity;
    line.current.material.color
      .copy(settledOutlineColor)
      .lerp(activationWhite, activationFlash);
  });

  return (
    <Billboard position={blob.position}>
      <group ref={shapeGroup} renderOrder={20}>
        <mesh renderOrder={19}>
          <shapeGeometry args={[fillShapes[blob.shape]]} />
          <shaderMaterial
            ref={fillMaterial}
            uniforms={fillUniforms}
            vertexShader={blobVertexShader}
            fragmentShader={opticalBubbleFragmentShader}
            transparent
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
        <Line
          ref={line}
          renderOrder={20}
          points={shapePoints[blob.shape]}
          color={outlineColor}
          lineWidth={1.25}
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </group>
    </Billboard>
  );
}

function pickRandomShape(): ShapeType {
  const index = Math.floor(Math.random() * shapeTypes.length);
  return shapeTypes[index];
}

export function pickRandomBeamPalette(): BeamBlobPalette {
  const index = Math.floor(Math.random() * paletteTypes.length);
  return paletteTypes[index];
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
