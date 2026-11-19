/**
 * مِركاب | MIRKAB — Native WebGL2 3D Automotive Showroom Engine
 * Pure Vanilla JavaScript + GLSL Shaders (Zero external libraries).
 *
 * Features:
 *  - Procedurally sculpted low-slung black GT sports coupe (lofted chassis, fenders, wheel wells,
 *    tinted fastback canopy, carbon aero trim, 4 multi-spoke alloy wheels + brake rotors, LED bars).
 *  - Real-time metallic clearcoat reflection shader with virtual overhead softbox light strips.
 *  - Planar mirror reflection on an obsidian showroom floor.
 *  - Autonomous continuous left-to-right cinematic driving loop with suspension pitch, wheel physics,
 *    scroll-linked camera depth, context-loss recovery, and reduced-motion compliance.
 */

const VERTEX_SHADER_SRC = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;

out vec3 vWorldPos;
out vec3 vWorldNormal;

void main() {
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(uNormalMatrix * aNormal);
  gl_Position = uProjection * uView * worldPos;
}
`;

const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec3 vWorldNormal;

uniform vec3 uCameraPos;
uniform vec3 uCarPos;
uniform float uCarSpeed;
uniform vec3 uBaseColor;
uniform float uRoughness;
uniform float uMetalness;
uniform float uClearcoat;
uniform float uEmissive;
uniform float uOpacity;
uniform float uIsReflection;
uniform float uIsFloor;
uniform float uTime;

out vec4 outColor;

// Virtual HDR Studio Softbox Strips reflected across car paint & glass
vec3 evaluateStudioEnv(vec3 R, vec3 worldPos, float roughness) {
  // Base dark obsidian sky gradient
  float up = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 env = mix(vec3(0.015, 0.016, 0.018), vec3(0.075, 0.080, 0.088), smoothstep(0.35, 0.95, up));

  // Primary overhead longitudinal softbox strip (creates classic showroom highlight along hood & roof)
  float strip1 = smoothstep(0.45 + roughness * 0.35, 0.96, R.y)
               * smoothstep(0.38 + roughness * 0.4, 0.02, abs(R.x));
  // Subtle moving studio overhead rib modulation so paint reflections flow organically during drive
  float gantrySweep = 0.78 + 0.22 * sin((worldPos.z - uTime * 1.15) * 1.4);
  env += vec3(0.92, 0.94, 0.97) * strip1 * (1.28 - roughness * 0.75) * gantrySweep;

  // Twin side studio light panels (sculpt side flanks and flared haunches)
  float sidePanelL = smoothstep(0.15, 0.72, -R.x)
                   * smoothstep(0.36 + roughness * 0.35, 0.02, abs(R.y - 0.36));
  float sidePanelR = smoothstep(0.15, 0.72, R.x)
                   * smoothstep(0.36 + roughness * 0.35, 0.02, abs(R.y - 0.36));
  env += vec3(0.68, 0.70, 0.74) * (sidePanelL + sidePanelR) * 0.65 * (1.0 - roughness * 0.55);

  // Sharp metallic horizon rim strip
  float horizonBand = exp(-pow((R.y - 0.14) / (0.09 + roughness * 0.14), 2.0));
  env += vec3(0.46, 0.48, 0.51) * horizonBand * 0.55;

  return env;
}

void main() {
  // Showroom Floor Shader
  if (uIsFloor > 0.5) {
    vec2 relCar = vWorldPos.xz - uCarPos.xz;
    float dist = length(vWorldPos.xz);
    float radialFade = 1.0 - smoothstep(3.2, 12.0, dist);

    // Architectural studio floor grid lines with subtle motion parallax cue
    vec2 grid = abs(fract(vWorldPos.xz * 0.85 - 0.5) - 0.5) / fwidth(vWorldPos.xz * 0.85);
    float gridLine = 1.0 - min(min(grid.x, grid.y), 1.0);
    float ringFade = 1.0 - smoothstep(2.4, 8.8, dist);

    // Dynamic ambient contact shadow & soft penumbra moving underneath the car
    float shadowDistX = smoothstep(0.48, 1.38, abs(relCar.x) * 1.08);
    float shadowDistZ = smoothstep(1.65, 2.58, abs(relCar.y) * 0.96);
    float underCar = clamp(max(shadowDistX, shadowDistZ), 0.0, 1.0);
    float contactOcclusion = mix(0.14, 1.0, underCar);

    // Twin headlight light-wash cones cast forward (+Z) onto the obsidian floor
    float ahead = relCar.y - 2.15;
    float inFront = smoothstep(-0.15, 0.65, ahead) * (1.0 - smoothstep(1.2, 6.2, ahead));
    float beamL = exp(-pow((relCar.x - 0.64) / (0.28 + max(0.0, ahead) * 0.22), 2.0));
    float beamR = exp(-pow((relCar.x + 0.64) / (0.28 + max(0.0, ahead) * 0.22), 2.0));
    float headlightWash = inFront * (beamL + beamR) * 0.09;

    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float floorSpec = pow(max(0.0, viewDir.y), 0.72) * 0.06 * radialFade;

    vec3 col = vec3(0.020, 0.021, 0.024) * radialFade * contactOcclusion;
    col += vec3(0.20, 0.21, 0.23) * gridLine * ringFade * (0.11 + uCarSpeed * 0.02);
    col += vec3(0.15, 0.155, 0.165) * floorSpec * contactOcclusion;
    col += vec3(0.84, 0.87, 0.92) * headlightWash;

    // Preserve alpha transparency over planar mirror reflection pass
    float alpha = mix(0.90, 0.99, smoothstep(1.8, 6.4, dist));
    outColor = vec4(col, alpha);
    return;
  }

  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(uCameraPos - vWorldPos);
  if (!gl_FrontFacing) {
    N = -N;
  }

  // Emissive Studio LED Light Blades
  if (uEmissive > 0.5) {
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 1.8);
    vec3 ledCol = uBaseColor * (1.32 + fresnel * 0.42);
    outColor = vec4(ledCol, uOpacity);
    return;
  }

  float NdotV = max(dot(N, V), 0.0);
  vec3 R = reflect(-V, N);

  // Key, Fill, and Rim Three-Point Studio Lights
  vec3 Lkey = normalize(vec3(2.8, 5.2, 3.4));
  vec3 Lrim = normalize(vec3(-3.6, 2.4, -4.0));
  vec3 Lfill = normalize(vec3(-2.5, 1.8, 2.2));

  float diffKey = max(dot(N, Lkey), 0.0);
  float diffFill = max(dot(N, Lfill), 0.0);

  vec3 Hkey = normalize(Lkey + V);
  vec3 Hrim = normalize(Lrim + V);

  float shininess = mix(160.0, 14.0, uRoughness);
  float specKey = pow(max(dot(N, Hkey), 0.0), shininess);
  float specRim = pow(max(dot(N, Hrim), 0.0), shininess * 0.7);

  // Fresnel reflectance (Schlick)
  float F0 = mix(0.04, 0.85, uMetalness);
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, 4.2);

  // Metallic micro-flake nuance & studio reflection lookup
  vec3 envRefl = evaluateStudioEnv(R, vWorldPos, uRoughness);
  vec3 clearcoatRefl = evaluateStudioEnv(R, vWorldPos, 0.05);

  vec3 diffuseTerm = uBaseColor * (0.28 + diffKey * 0.85 + diffFill * 0.35);
  vec3 specTerm = vec3(0.88, 0.90, 0.93) * (specKey * 0.72 + specRim * 0.48) * (1.0 - uRoughness * 0.65);

  vec3 color = mix(diffuseTerm, envRefl * mix(vec3(1.0), uBaseColor * 2.8 + vec3(0.35), uMetalness), clamp(fresnel * 0.88, 0.0, 0.92));
  color += specTerm;

  // Dual-lobe glossy clearcoat layer (car paint & tinted canopy)
  if (uClearcoat > 0.05) {
    float ccFresnel = 0.04 + 0.96 * pow(1.0 - NdotV, 4.6);
    float ccHighlight = pow(max(dot(N, Hkey), 0.0), 210.0) * 0.95;
    color += clearcoatRefl * ccFresnel * uClearcoat * 0.90;
    color += vec3(0.98) * ccHighlight * uClearcoat;
  }

  // Subtle silhouette rim against dark obsidian void
  float silhouetteRim = pow(1.0 - NdotV, 4.5) * max(0.0, N.y * 0.5 + 0.5);
  color += vec3(0.76, 0.78, 0.81) * silhouetteRim * 0.25;

  // Planar mirror reflection distance falloff beneath floor y = 0
  float alpha = uOpacity;
  if (uIsReflection > 0.5) {
    float heightFade = exp(-max(0.0, -vWorldPos.y) * 1.65);
    color *= 0.45 * heightFade;
    alpha *= 0.54 * heightFade;
  }

  // Gentle studio tone mapping & gamma
  color = color / (color + vec3(0.85));
  color = pow(max(color, vec3(0.0)), vec3(1.0 / 1.15));

  outColor = vec4(color, alpha);
}
`;

// ============================================================================
// Lightweight 4x4 Matrix & Vector Math Utilities (Zero Dependencies)
// ============================================================================
function mat4Identity() {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function mat4Perspective(fovRad, aspect, near, far) {
  const f = 1.0 / Math.tan(fovRad * 0.5);
  const nf = 1.0 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

function mat4LookAt(eye, target, up) {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len;
  zy /= len;
  zz /= len;

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len;
  xy /= len;
  xz /= len;

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  const out = new Float32Array(16);
  out[0] = xx;
  out[1] = yx;
  out[2] = zx;
  out[3] = 0;
  out[4] = xy;
  out[5] = yy;
  out[6] = zy;
  out[7] = 0;
  out[8] = xz;
  out[9] = yz;
  out[10] = zz;
  out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

function mat4Translate(x, y, z) {
  const m = mat4Identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

function mat4Scale(x, y, z) {
  const m = mat4Identity();
  m[0] = x;
  m[5] = y;
  m[10] = z;
  return m;
}

function mat4RotateX(rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const m = mat4Identity();
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

function mat4RotateY(rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const m = mat4Identity();
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

function mat3NormalFromMat4(m) {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[4], a11 = m[5], a12 = m[6];
  const a20 = m[8], a21 = m[9], a22 = m[10];

  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (!det) {
    return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  det = 1.0 / det;

  return new Float32Array([
    b01 * det,
    (-a22 * a01 + a02 * a21) * det,
    (a12 * a01 - a02 * a11) * det,
    b11 * det,
    (a22 * a00 - a02 * a20) * det,
    (-a12 * a00 + a02 * a10) * det,
    b21 * det,
    (-a21 * a00 + a01 * a20) * det,
    (a11 * a00 - a01 * a10) * det
  ]);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// ============================================================================
// Procedural GT Sports Coupe Geometry Builder
// ============================================================================
function computeSmoothNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;

    const ax = positions[i1] - positions[i0];
    const ay = positions[i1 + 1] - positions[i0 + 1];
    const az = positions[i1 + 2] - positions[i0 + 2];

    const bx = positions[i2] - positions[i0];
    const by = positions[i2 + 1] - positions[i0 + 1];
    const bz = positions[i2 + 2] - positions[i0 + 2];

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    normals[i0] += nx;
    normals[i0 + 1] += ny;
    normals[i0 + 2] += nz;
    normals[i1] += nx;
    normals[i1 + 1] += ny;
    normals[i1 + 2] += nz;
    normals[i2] += nx;
    normals[i2 + 1] += ny;
    normals[i2 + 2] += nz;
  }

  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= len;
    normals[i + 1] /= len;
    normals[i + 2] /= len;
  }
  return normals;
}

function createMeshBuilder() {
  const pos = [];
  const idx = [];
  const sharpTris = [];

  return {
    addVertex(x, y, z) {
      const id = pos.length / 3;
      pos.push(x, y, z);
      return id;
    },
    addTri(a, b, c) {
      idx.push(a, b, c);
    },
    addQuad(a, b, c, d) {
      idx.push(a, b, c, a, c, d);
    },
    addBox(cx, cy, cz, sx, sy, sz, skewFront = 0) {
      const hx = sx * 0.5;
      const hy = sy * 0.5;
      const hz = sz * 0.5;
      const pts = [
        [-hx, -hy, hz],
        [hx, -hy, hz],
        [hx, hy, hz - skewFront],
        [-hx, hy, hz - skewFront],
        [-hx, -hy, -hz],
        [hx, -hy, -hz],
        [hx, hy, -hz],
        [-hx, hy, -hz]
      ];
      const faces = [
        [0, 1, 2, 3],
        [1, 5, 6, 2],
        [5, 4, 7, 6],
        [4, 0, 3, 7],
        [3, 2, 6, 7],
        [4, 5, 1, 0]
      ];
      for (const f of faces) {
        const base = sharpTris.length / 3;
        const p0 = pts[f[0]];
        const p1 = pts[f[1]];
        const p2 = pts[f[2]];
        const p3 = pts[f[3]];
        for (const p of [p0, p1, p2, p0, p2, p3]) {
          sharpTris.push(cx + p[0], cy + p[1], cz + p[2]);
        }
        void base;
      }
    },
    build(flatNormals = false) {
      if (flatNormals || sharpTris.length > 0) {
        // Combine indexed smooth mesh + flat sharp tris into flat-unindexed buffer if mixed
        const smoothPositions = new Float32Array(pos);
        const smoothIndices = new Uint16Array(idx);
        const smoothNormals = computeSmoothNormals(smoothPositions, smoothIndices);

        const outPos = [];
        const outNorm = [];
        const outIdx = [];

        if (flatNormals) {
          for (let i = 0; i < idx.length; i += 3) {
            const v0 = idx[i] * 3;
            const v1 = idx[i + 1] * 3;
            const v2 = idx[i + 2] * 3;
            const ax = pos[v1] - pos[v0], ay = pos[v1 + 1] - pos[v0 + 1], az = pos[v1 + 2] - pos[v0 + 2];
            const bx = pos[v2] - pos[v0], by = pos[v2 + 1] - pos[v0 + 1], bz = pos[v2 + 2] - pos[v0 + 2];
            let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
            const len = Math.hypot(nx, ny, nz) || 1;
            nx /= len; ny /= len; nz /= len;
            for (const vi of [v0, v1, v2]) {
              outIdx.push(outPos.length / 3);
              outPos.push(pos[vi], pos[vi + 1], pos[vi + 2]);
              outNorm.push(nx, ny, nz);
            }
          }
        } else {
          for (let i = 0; i < smoothPositions.length; i++) {
            outPos.push(smoothPositions[i]);
            outNorm.push(smoothNormals[i]);
          }
          for (let i = 0; i < idx.length; i++) {
            outIdx.push(idx[i]);
          }
        }

        for (let i = 0; i < sharpTris.length; i += 9) {
          const ax = sharpTris[i + 3] - sharpTris[i];
          const ay = sharpTris[i + 4] - sharpTris[i + 1];
          const az = sharpTris[i + 5] - sharpTris[i + 2];
          const bx = sharpTris[i + 6] - sharpTris[i];
          const by = sharpTris[i + 7] - sharpTris[i + 1];
          const bz = sharpTris[i + 8] - sharpTris[i + 2];
          let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
          const len = Math.hypot(nx, ny, nz) || 1;
          nx /= len; ny /= len; nz /= len;
          for (let k = 0; k < 3; k++) {
            outIdx.push(outPos.length / 3);
            outPos.push(sharpTris[i + k * 3], sharpTris[i + k * 3 + 1], sharpTris[i + k * 3 + 2]);
            outNorm.push(nx, ny, nz);
          }
        }

        return {
          positions: new Float32Array(outPos),
          normals: new Float32Array(outNorm),
          indices: new Uint16Array(outIdx)
        };
      }

      const positions = new Float32Array(pos);
      const indices = new Uint16Array(idx);
      const normals = computeSmoothNormals(positions, indices);
      return { positions, normals, indices };
    }
  };
}

/**
 * Evaluates longitudinal GT Sports Coupe profile parameters at any Z in [-2.32, +2.36].
 * Front nose is +Z, rear tail is -Z.
 */
function sampleCoupeProfile(z) {
  const FRONT_AXLE = 1.38;
  const REAR_AXLE = -1.36;

  // Nose & tail taper factors
  const frontTaper = smoothstep(2.36, 1.88, z); // 0 at nose tip -> 1 by front fender
  const rearTaper = smoothstep(-2.32, -1.96, z); // 0 at tail corner -> 1 by rear quarter

  // Base half-width: wider muscular rear haunches, sculpted waist, wide front fenders
  const rearHaunch = Math.exp(-Math.pow((z - (-1.22)) / 0.52, 2)) * 0.085;
  const frontFender = Math.exp(-Math.pow((z - 1.32) / 0.48, 2)) * 0.045;
  const doorPinch = -Math.exp(-Math.pow((z - 0.12) / 0.45, 2)) * 0.045;

  let halfW = (0.89 + rearHaunch + frontFender + doorPinch) * (0.78 + 0.22 * frontTaper) * (0.82 + 0.18 * rearTaper);
  if (z > 2.18) {
    halfW *= 0.88 + 0.12 * smoothstep(2.36, 2.18, z);
  }

  // Wheel arch cutouts along Z
  const dFront = Math.abs(z - FRONT_AXLE);
  const dRear = Math.abs(z - REAR_AXLE);
  const archRFront = 0.41;
  const archRRear = 0.43;

  let archLift = 0;
  let archInset = 0;
  if (dFront < archRFront) {
    const u = dFront / archRFront;
    const circle = Math.sqrt(Math.max(0, 1 - u * u));
    archLift = Math.max(archLift, circle * 0.56);
    archInset = Math.max(archInset, circle * 0.24);
  }
  if (dRear < archRRear) {
    const u = dRear / archRRear;
    const circle = Math.sqrt(Math.max(0, 1 - u * u));
    archLift = Math.max(archLift, circle * 0.59);
    archInset = Math.max(archInset, circle * 0.26);
  }

  // Floor clearance (splitter up front, diffuser kick at rear)
  let sillY = 0.145;
  if (z > 1.85) sillY = 0.145 + smoothstep(1.85, 2.36, z) * 0.07;
  if (z < -1.78) sillY = 0.145 + smoothstep(-1.78, -2.32, z) * 0.22;

  const rockerY = Math.max(sillY, 0.12 + archLift);
  const rockerX = Math.max(0.48, halfW * 0.94 - archInset);

  // Mid-flank & sculpted shoulder line
  const flankY = 0.48 + smoothstep(2.36, 1.5, z) * 0.06 + Math.exp(-Math.pow((z + 1.2) / 0.7, 2)) * 0.07;

  // Hood -> Beltline -> Rear Haunch -> Ducktail height
  let shoulderY = 0.68;
  if (z >= 0.75) {
    // Low aggressive sculpted hood sloping down toward front nose
    const t = smoothstep(2.36, 0.75, z);
    shoulderY = 0.36 + t * 0.38;
  } else if (z >= -0.8) {
    // Crisp door shoulder rising slightly toward rear haunch
    const t = smoothstep(0.75, -0.8, z);
    shoulderY = 0.74 + t * 0.07;
  } else {
    // Muscular rear quarter tapering gently into integrated ducktail lip
    const t = smoothstep(-0.8, -2.26, z);
    shoulderY = 0.81 - t * 0.05;
    if (z < -2.14) {
      shoulderY += smoothstep(-2.14, -2.30, z) * 0.045;
    }
  }

  // Center hood / roof / fastback centerline height
  let centerY = shoulderY + 0.035;
  if (z > 0.75) {
    // Recessed sculpted hood cowl
    centerY = shoulderY - 0.015 + smoothstep(2.36, 1.8, z) * 0.02;
  }

  // Cabin Greenhouse crown (only exists cleanly for z in [-1.72, +0.76])
  let roofY = shoulderY + 0.01;
  let cabinW = halfW * 0.74;
  if (z > -1.72 && z < 0.76) {
    let dome = 0;
    if (z >= 0.02) {
      // Raked windshield
      dome = smoothstep(0.76, 0.02, z);
    } else {
      // Sleek fastback coupe roofline sweeping cleanly to tail
      dome = smoothstep(-1.72, -0.18, z);
    }
    const peak = 1.225;
    roofY = shoulderY + dome * (peak - shoulderY);
    cabinW = halfW * (0.76 - dome * 0.17);
  }

  return {
    halfW,
    sillY,
    rockerY,
    rockerX,
    flankY,
    shoulderY,
    centerY,
    roofY,
    cabinW
  };
}

/**
 * Generates closed lofted shell for the main painted black coupe fuselage.
 */
function buildBodyMesh() {
  const mb = createMeshBuilder();
  const zStations = [
    -2.32, -2.26, -2.16, -2.02, -1.84, -1.72, -1.58, -1.42, -1.26, -1.10, -0.94,
    -0.74, -0.50, -0.22, 0.05, 0.30, 0.52, 0.74, 0.96, 1.16, 1.32, 1.48, 1.64,
    1.80, 1.96, 2.12, 2.24, 2.33, 2.36
  ];

  // Cross-section from top center spine -> right side -> belly -> left side -> back to top center spine
  // Using smooth 15-point cross section per station
  const rings = [];

  for (const z of zStations) {
    const p = sampleCoupeProfile(z);
    const s = p.halfW;
    const sy = p.shoulderY;

    // Lower fuselage crown (hood/deck/cabin beltline)
    // Where cabin sits, keep painted A/C pillars flanking the sunken greenhouse
    const isRearRoof = z < -0.15 && z > -1.72;
    const spineY = isRearRoof ? Math.max(p.centerY, p.roofY - 0.02) : p.centerY;

    // Right side half-profile (8 points from top-center to bottom-center)
    const rightHalf = [
      [0.0, spineY],
      [s * 0.42, spineY - 0.015],
      [s * 0.76, sy + 0.015],
      [s * 0.96, sy - 0.055],
      [s * 1.0, p.flankY],
      [p.rockerX, p.rockerY],
      [Math.min(p.rockerX * 0.85, s * 0.62), p.sillY],
      [0.0, p.sillY]
    ];

    const ring = [];
    // Right top-to-bottom
    for (let i = 0; i < rightHalf.length; i++) {
      ring.push(mb.addVertex(rightHalf[i][0], rightHalf[i][1], z));
    }
    // Left bottom-to-top (mirrored)
    for (let i = rightHalf.length - 2; i >= 0; i--) {
      ring.push(mb.addVertex(-rightHalf[i][0], rightHalf[i][1], z));
    }
    rings.push(ring);
  }

  const ringLen = rings[0].length;
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = rings[i];
    const r1 = rings[i + 1];
    for (let j = 0; j < ringLen - 1; j++) {
      // Winding outward
      mb.addQuad(r0[j], r1[j], r1[j + 1], r0[j + 1]);
    }
  }

  // Cap rear face (-2.32) & front tip (+2.36) cleanly
  const firstRing = rings[0];
  const lastRing = rings[rings.length - 1];
  const rMid = Math.floor(ringLen / 2);
  for (let j = 1; j < rMid; j++) {
    mb.addQuad(firstRing[j], firstRing[ringLen - 1 - j], firstRing[ringLen - 2 - j], firstRing[j + 1]);
    mb.addQuad(lastRing[j], lastRing[j + 1], lastRing[ringLen - 2 - j], lastRing[ringLen - 1 - j]);
  }

  return mb.build(false);
}

/**
 * Generates tinted obsidian glass canopy (windshield, roof glass, side glass & fastback rear glass).
 */
function buildGreenhouseMesh() {
  const mb = createMeshBuilder();
  const zStations = [
    -1.66, -1.42, -1.12, -0.78, -0.44, -0.14, 0.14, 0.40, 0.62, 0.74
  ];

  const rings = [];
  for (const z of zStations) {
    const p = sampleCoupeProfile(z);
    const cw = p.cabinW;
    const base = p.shoulderY - 0.02;
    const top = Math.max(base + 0.03, p.roofY + 0.015);

    const pts = [
      [0.0, top],
      [cw * 0.56, top - (top - base) * 0.12],
      [cw * 0.94, base + (top - base) * 0.36],
      [cw * 1.02, base],
      [0.0, base],
      [-cw * 1.02, base],
      [-cw * 0.94, base + (top - base) * 0.36],
      [-cw * 0.56, top - (top - base) * 0.12],
      [0.0, top]
    ];

    const ring = pts.map(([x, y]) => mb.addVertex(x, y, z));
    rings.push(ring);
  }

  const ringLen = rings[0].length;
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = rings[i];
    const r1 = rings[i + 1];
    for (let j = 0; j < ringLen - 1; j++) {
      mb.addQuad(r0[j], r1[j], r1[j + 1], r0[j + 1]);
    }
  }

  return mb.build(false);
}

/**
 * Generates matte-carbon aerodynamic splitter, side skirts, mirrors, inner wheel wells, & rear diffuser.
 */
function buildAeroTrimMesh() {
  const mb = createMeshBuilder();

  // Front aerodynamic splitter & side endplates
  mb.addBox(0, 0.115, 2.22, 1.78, 0.035, 0.34, 0.04);
  mb.addBox(0.89, 0.155, 2.16, 0.03, 0.09, 0.28);
  mb.addBox(-0.89, 0.155, 2.16, 0.03, 0.09, 0.28);

  // Left & Right sculpted carbon side skirts between wheel arches
  mb.addBox(0.90, 0.135, 0.01, 0.08, 0.045, 1.82);
  mb.addBox(-0.90, 0.135, 0.01, 0.08, 0.045, 1.82);

  // Multi-fin rear diffuser & lower aero valence
  mb.addBox(0, 0.20, -2.20, 1.66, 0.12, 0.28);
  for (const fx of [-0.56, -0.28, 0, 0.28, 0.56]) {
    mb.addBox(fx, 0.17, -2.25, 0.025, 0.14, 0.32);
  }

  // Sculpted twin side mirrors on stems
  for (const side of [1, -1]) {
    mb.addBox(side * 0.90, 0.77, 0.52, 0.14, 0.025, 0.05);
    mb.addBox(side * 0.98, 0.80, 0.50, 0.15, 0.065, 0.11);
  }

  // Recessed dark wheel-well cylinders so chassis interior is completely sealed
  const wells = [
    [0.72, 0.34, 1.38, 0.39, 0.38],
    [-0.72, 0.34, 1.38, 0.39, 0.38],
    [0.74, 0.35, -1.36, 0.41, 0.40],
    [-0.74, 0.35, -1.36, 0.41, 0.40]
  ];
  for (const [wx, wy, wz, rad, width] of wells) {
    mb.addBox(wx, wy + 0.04, wz, width, rad * 1.65, rad * 1.85);
  }

  return mb.build(true);
}

/**
 * Generates signature LED DRL blades (front) & full-width studio OLED tail light bar (rear).
 */
function buildLightsMesh() {
  const mb = createMeshBuilder();

  // Sharp angular front LED DRL signatures
  for (const side of [1, -1]) {
    mb.addBox(side * 0.68, 0.40, 2.24, 0.28, 0.024, 0.12, 0.03);
    mb.addBox(side * 0.80, 0.43, 2.16, 0.04, 0.06, 0.18);
  }

  // Seamless full-width rear studio OLED light bar
  mb.addBox(0, 0.66, -2.31, 1.56, 0.024, 0.04);
  for (const side of [1, -1]) {
    mb.addBox(side * 0.74, 0.63, -2.28, 0.16, 0.032, 0.08);
  }

  return mb.build(true);
}

/**
 * Builds rotatable wheel tire + concave 10-spoke silver alloy rim + ventilated brake disc.
 */
function buildWheelParts(outerRadius, width) {
  const tireMb = createMeshBuilder();
  const rimMb = createMeshBuilder();

  const radialSegs = 32;
  const hw = width * 0.5;
  const rimR = outerRadius * 0.68;
  const midR = outerRadius * 0.91;

  // Profile cross-section of a radial tire (revolves around X axis)
  const tireProfile = [
    [hw * 0.86, rimR],
    [hw * 1.0, midR],
    [hw * 0.88, outerRadius],
    [-hw * 0.88, outerRadius],
    [-hw * 1.0, midR],
    [-hw * 0.86, rimR]
  ];

  const tireRings = [];
  for (let i = 0; i <= radialSegs; i++) {
    const a = (i / radialSegs) * Math.PI * 2;
    const cy = Math.cos(a);
    const cz = Math.sin(a);
    const ring = tireProfile.map(([px, pr]) => tireMb.addVertex(px, cy * pr, cz * pr));
    tireRings.push(ring);
  }

  for (let i = 0; i < radialSegs; i++) {
    const r0 = tireRings[i];
    const r1 = tireRings[i + 1];
    for (let j = 0; j < tireProfile.length - 1; j++) {
      tireMb.addQuad(r0[j], r1[j], r1[j + 1], r0[j + 1]);
    }
  }

  // Rim outer barrel lip & concave center hub
  const rimLipR = rimR * 1.02;
  const lipRings = [];
  for (let i = 0; i <= radialSegs; i++) {
    const a = (i / radialSegs) * Math.PI * 2;
    const cy = Math.cos(a);
    const cz = Math.sin(a);
    lipRings.push([
      rimMb.addVertex(hw * 0.88, cy * rimLipR, cz * rimLipR),
      rimMb.addVertex(hw * 0.72, cy * (rimLipR * 0.90), cz * (rimLipR * 0.90)),
      rimMb.addVertex(-hw * 0.65, cy * (rimLipR * 0.90), cz * (rimLipR * 0.90))
    ]);
  }
  for (let i = 0; i < radialSegs; i++) {
    const r0 = lipRings[i];
    const r1 = lipRings[i + 1];
    rimMb.addQuad(r0[0], r1[0], r1[1], r0[1]);
    rimMb.addQuad(r0[1], r1[1], r1[2], r0[2]);
  }

  // Concave 10-spoke star pattern + center hub + brake rotor
  const spokes = 10;
  for (let s = 0; s < spokes; s++) {
    const a = (s / spokes) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const py = c * (rimR * 0.56);
    const pz = sn * (rimR * 0.56);

    // Thin radial spoke bar oriented along angle
    const tangentY = -sn * 0.016;
    const tangentZ = c * 0.016;
    const innerR = rimR * 0.22;
    const outerSpokeR = rimR * 0.94;

    const v0 = rimMb.addVertex(hw * 0.52, c * innerR + tangentY, sn * innerR + tangentZ);
    const v1 = rimMb.addVertex(hw * 0.52, c * innerR - tangentY, sn * innerR - tangentZ);
    const v2 = rimMb.addVertex(hw * 0.80, c * outerSpokeR - tangentY * 0.75, sn * outerSpokeR - tangentZ * 0.75);
    const v3 = rimMb.addVertex(hw * 0.80, c * outerSpokeR + tangentY * 0.75, sn * outerSpokeR + tangentZ * 0.75);
    const v4 = rimMb.addVertex(hw * 0.36, c * innerR + tangentY, sn * innerR + tangentZ);
    const v5 = rimMb.addVertex(hw * 0.36, c * innerR - tangentY, sn * innerR - tangentZ);
    const v6 = rimMb.addVertex(hw * 0.64, c * outerSpokeR - tangentY * 0.75, sn * outerSpokeR - tangentZ * 0.75);
    const v7 = rimMb.addVertex(hw * 0.64, c * outerSpokeR + tangentY * 0.75, sn * outerSpokeR + tangentZ * 0.75);

    rimMb.addQuad(v0, v1, v2, v3);
    rimMb.addQuad(v1, v5, v6, v2);
    rimMb.addQuad(v3, v7, v4, v0);
    rimMb.addQuad(v5, v4, v7, v6);
    void py;
    void pz;
  }

  // Center lock cap + ventilated brake disc inside rim
  rimMb.addBox(hw * 0.52, 0, 0, 0.06, rimR * 0.36, rimR * 0.36);
  rimMb.addBox(hw * 0.15, 0, 0, 0.025, rimR * 1.48, rimR * 1.48);

  return {
    tire: tireMb.build(false),
    rim: rimMb.build(true)
  };
}

/**
 * Studio showroom floor quad & overhead linear softbox light frame mesh.
 */
function buildFloorMesh() {
  const mb = createMeshBuilder();
  const S = 11.0;
  const v0 = mb.addVertex(-S, 0, -S);
  const v1 = mb.addVertex(S, 0, -S);
  const v2 = mb.addVertex(S, 0, S);
  const v3 = mb.addVertex(-S, 0, S);
  mb.addQuad(v0, v3, v2, v1);
  return mb.build(false);
}

function buildOverheadLightRigMesh() {
  const mb = createMeshBuilder();
  // 3 suspended studio light strips overhead at y = 3.1m
  mb.addBox(0, 3.15, 0.0, 0.24, 0.02, 5.2);
  mb.addBox(1.55, 2.85, 0.0, 0.12, 0.02, 4.4);
  mb.addBox(-1.55, 2.85, 0.0, 0.12, 0.02, 4.4);
  return mb.build(true);
}

// ============================================================================
// WebGL2 Showroom Controller
// ============================================================================
export function createMirkab3DShowroom(canvas, options = {}) {
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });

  if (!gl) {
    return null;
  }

  const compileShader = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  let program = null;
  let locs = null;
  let gpuParts = null;

  const initResources = () => {
    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return false;
    }

    locs = {
      uProjection: gl.getUniformLocation(program, 'uProjection'),
      uView: gl.getUniformLocation(program, 'uView'),
      uModel: gl.getUniformLocation(program, 'uModel'),
      uNormalMatrix: gl.getUniformLocation(program, 'uNormalMatrix'),
      uCameraPos: gl.getUniformLocation(program, 'uCameraPos'),
      uCarPos: gl.getUniformLocation(program, 'uCarPos'),
      uCarSpeed: gl.getUniformLocation(program, 'uCarSpeed'),
      uBaseColor: gl.getUniformLocation(program, 'uBaseColor'),
      uRoughness: gl.getUniformLocation(program, 'uRoughness'),
      uMetalness: gl.getUniformLocation(program, 'uMetalness'),
      uClearcoat: gl.getUniformLocation(program, 'uClearcoat'),
      uEmissive: gl.getUniformLocation(program, 'uEmissive'),
      uOpacity: gl.getUniformLocation(program, 'uOpacity'),
      uIsReflection: gl.getUniformLocation(program, 'uIsReflection'),
      uIsFloor: gl.getUniformLocation(program, 'uIsFloor'),
      uTime: gl.getUniformLocation(program, 'uTime')
    };

    const uploadMesh = (mesh) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

      const normBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

      const idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

      gl.bindVertexArray(null);
      return { vao, count: mesh.indices.length };
    };

    const frontWheelGeo = buildWheelParts(0.34, 0.24);
    const rearWheelGeo = buildWheelParts(0.35, 0.27);

    gpuParts = {
      body: uploadMesh(buildBodyMesh()),
      glass: uploadMesh(buildGreenhouseMesh()),
      aero: uploadMesh(buildAeroTrimMesh()),
      lights: uploadMesh(buildLightsMesh()),
      frontTire: uploadMesh(frontWheelGeo.tire),
      frontRim: uploadMesh(frontWheelGeo.rim),
      rearTire: uploadMesh(rearWheelGeo.tire),
      rearRim: uploadMesh(rearWheelGeo.rim),
      floor: uploadMesh(buildFloorMesh()),
      lightRig: uploadMesh(buildOverheadLightRigMesh())
    };

    return true;
  };

  if (!initResources()) {
    return null;
  }

  // Autonomous Cinematic Left-to-Right Driving State
  // Viewing from -X / +Z puts -Z on screen-left and +Z (car nose) toward screen-right.
  const HERO_CAMERA = { yaw: -1.02, pitch: 0.185, dist: 5.15 };
  const DRIVE_CYCLE = 7.2; // Seconds per seamless pass from off-screen left to off-screen right
  const DRIVE_SPAN = 9.8;  // Travels -9.8m -> +9.8m (+Z = left to right across screen)

  const cam = {
    scrollProgress: 0,
    smoothScroll: 0,
    wheelSpin: 0,
    elapsed: options.reducedMotion ? DRIVE_CYCLE * 0.5 : 0,
    carZ: options.reducedMotion ? 0 : -DRIVE_SPAN,
    carSpeed: 0,
    carPitch: 0,
    carBounce: 0,
    reducedMotion: Boolean(options.reducedMotion),
    visible: true,
    contextLost: false,
    rafId: 0
  };

  const drawMesh = (part, modelMat, matProps, isReflection = false, isFloor = false) => {
    gl.uniformMatrix4fv(locs.uModel, false, modelMat);
    gl.uniformMatrix3fv(locs.uNormalMatrix, false, mat3NormalFromMat4(modelMat));
    gl.uniform3fv(locs.uBaseColor, matProps.color);
    gl.uniform1f(locs.uRoughness, matProps.roughness);
    gl.uniform1f(locs.uMetalness, matProps.metalness);
    gl.uniform1f(locs.uClearcoat, matProps.clearcoat);
    gl.uniform1f(locs.uEmissive, matProps.emissive || 0.0);
    gl.uniform1f(locs.uOpacity, matProps.opacity ?? 1.0);
    gl.uniform1f(locs.uIsReflection, isReflection ? 1.0 : 0.0);
    gl.uniform1f(locs.uIsFloor, isFloor ? 1.0 : 0.0);

    gl.bindVertexArray(part.vao);
    gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_SHORT, 0);
  };

  const wheelConfigs = [
    { x: 0.86, y: 0.34, z: 1.38, isFront: true, flipRight: false },
    { x: -0.86, y: 0.34, z: 1.38, isFront: true, flipRight: true },
    { x: 0.89, y: 0.35, z: -1.36, isFront: false, flipRight: false },
    { x: -0.89, y: 0.35, z: -1.36, isFront: false, flipRight: true }
  ];

  const MATERIALS = {
    paint: { color: [0.024, 0.026, 0.031], roughness: 0.21, metalness: 0.56, clearcoat: 1.0, opacity: 1.0 },
    glass: { color: [0.018, 0.022, 0.028], roughness: 0.04, metalness: 0.18, clearcoat: 1.0, opacity: 0.94 },
    aero: { color: [0.045, 0.048, 0.054], roughness: 0.54, metalness: 0.22, clearcoat: 0.18, opacity: 1.0 },
    tire: { color: [0.038, 0.040, 0.044], roughness: 0.85, metalness: 0.02, clearcoat: 0.0, opacity: 1.0 },
    rim: { color: [0.80, 0.82, 0.84], roughness: 0.18, metalness: 0.95, clearcoat: 0.42, opacity: 1.0 },
    lights: { color: [0.99, 0.995, 1.0], roughness: 0.1, metalness: 0.0, clearcoat: 0.0, emissive: 1.0, opacity: 1.0 },
    rig: { color: [0.88, 0.90, 0.93], roughness: 0.1, metalness: 0.0, clearcoat: 0.0, emissive: 1.0, opacity: 0.90 },
    floor: { color: [0.02, 0.02, 0.02], roughness: 0.18, metalness: 0.0, clearcoat: 0.0, opacity: 1.0 }
  };

  const renderCarGroup = (worldRootMat, isReflection) => {
    const sprungOffset = mat4Multiply(
      mat4Translate(0, cam.carBounce, 0),
      mat4RotateX(cam.carPitch)
    );
    const bodyMat = mat4Multiply(worldRootMat, sprungOffset);

    drawMesh(gpuParts.body, bodyMat, MATERIALS.paint, isReflection);
    drawMesh(gpuParts.aero, bodyMat, MATERIALS.aero, isReflection);
    drawMesh(gpuParts.glass, bodyMat, MATERIALS.glass, isReflection);
    drawMesh(gpuParts.lights, bodyMat, MATERIALS.lights, isReflection);

    const spinMat = mat4RotateX(cam.wheelSpin);

    for (const w of wheelConfigs) {
      let wMat = mat4Translate(w.x, w.y, w.z);
      if (w.flipRight) {
        wMat = mat4Multiply(wMat, mat4RotateY(Math.PI));
      }
      wMat = mat4Multiply(wMat, spinMat);
      wMat = mat4Multiply(worldRootMat, wMat);

      const tirePart = w.isFront ? gpuParts.frontTire : gpuParts.rearTire;
      const rimPart = w.isFront ? gpuParts.frontRim : gpuParts.rearRim;
      drawMesh(tirePart, wMat, MATERIALS.tire, isReflection);
      drawMesh(rimPart, wMat, MATERIALS.rim, isReflection);
    }
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  let lastTime = performance.now();

  const renderFrame = (now) => {
    cam.rafId = 0;
    if (cam.contextLost || !cam.visible || document.hidden) return;

    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    resize();
    const w = canvas.width;
    const h = canvas.height;
    const aspect = w / Math.max(1, h);

    let phaseU = 0.5;
    let speedNorm = 0.0;

    if (!cam.reducedMotion) {
      const prevZ = cam.carZ;
      cam.elapsed = (cam.elapsed + dt) % DRIVE_CYCLE;
      phaseU = cam.elapsed / DRIVE_CYCLE;

      // Monotonic C-infinity periodic curve: enters briskly from left, glides in cinematic slow-motion
      // across center stage, then accelerates smoothly off-screen to the right and loops seamlessly.
      const k = 0.105;
      const posNorm = phaseU + k * Math.sin(2 * Math.PI * phaseU);
      cam.carZ = -DRIVE_SPAN + posNorm * (DRIVE_SPAN * 2);

      let dz = cam.carZ - prevZ;
      if (dz < -DRIVE_SPAN) {
        // Wrapped off-screen from +DRIVE_SPAN back to -DRIVE_SPAN
        dz = 0;
      }

      speedNorm = 1 + 2 * Math.PI * k * Math.cos(2 * Math.PI * phaseU);
      const accelNorm = -2 * Math.PI * 2 * Math.PI * k * Math.sin(2 * Math.PI * phaseU);

      cam.carSpeed = speedNorm * 0.65;
      cam.wheelSpin += dz / 0.345;

      // Subtle braking nose-dip on deceleration & rear squat on exit acceleration
      cam.carPitch = clamp01(Math.abs(accelNorm) / 4.2) * Math.sign(-accelNorm) * 0.011;
      cam.carBounce = Math.sin(cam.carZ * 1.5) * 0.0045 * (0.4 + speedNorm * 0.35);
    } else {
      cam.carZ = 0;
      cam.carSpeed = 0;
      cam.carPitch = 0;
      cam.carBounce = 0;
    }

    cam.smoothScroll += (cam.scrollProgress - cam.smoothScroll) * 0.1;

    // Gentle autonomous cinematic camera sweep tracking the car
    const panAngle = cam.reducedMotion ? 0 : Math.sin(phaseU * Math.PI) * 0.14 - 0.07;
    const effectiveYaw = HERO_CAMERA.yaw + panAngle + cam.smoothScroll * 0.62;
    const effectivePitch = Math.max(
      0.08,
      Math.min(0.95, HERO_CAMERA.pitch + cam.smoothScroll * 0.14)
    );
    const baseDist = aspect < 1.0 ? HERO_CAMERA.dist * 1.46 : HERO_CAMERA.dist;
    const effectiveDist = baseDist - cam.smoothScroll * 0.55;

    const targetX = 0.0;
    const targetY = 0.24;
    const targetZ = cam.carZ * 0.14;

    const eyeX = targetX + Math.sin(effectiveYaw) * Math.cos(effectivePitch) * effectiveDist;
    const eyeY = targetY + Math.sin(effectivePitch) * effectiveDist;
    const eyeZ = targetZ + Math.cos(effectiveYaw) * Math.cos(effectivePitch) * effectiveDist;

    const dynamicFov = 37.5 + speedNorm * 1.3;
    const proj = mat4Perspective((dynamicFov * Math.PI) / 180, aspect, 0.15, 65.0);
    const view = mat4LookAt([eyeX, eyeY, eyeZ], [targetX, targetY, targetZ], [0, 1, 0]);

    gl.viewport(0, 0, w, h);
    gl.clearColor(0.0196, 0.0196, 0.0196, 1.0); // #050505
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniformMatrix4fv(locs.uProjection, false, proj);
    gl.uniformMatrix4fv(locs.uView, false, view);
    gl.uniform3f(locs.uCameraPos, eyeX, eyeY, eyeZ);
    gl.uniform3f(locs.uCarPos, 0.0, 0.0, cam.carZ);
    gl.uniform1f(locs.uCarSpeed, cam.carSpeed);
    gl.uniform1f(locs.uTime, now * 0.001);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const carWorldMat = mat4Translate(0.0, 0.0, cam.carZ);

    // 1. Planar Floor Reflection Pass
    const mirrorMat = mat4Multiply(mat4Scale(1, -1, 1), carWorldMat);
    gl.frontFace(gl.CW);
    gl.disable(gl.BLEND);
    renderCarGroup(mirrorMat, true);

    // 2. Glossy Obsidian Showroom Floor Pass
    gl.frontFace(gl.CCW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    drawMesh(gpuParts.floor, mat4Identity(), MATERIALS.floor, false, true);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // 3. Main 3D GT Sports Coupe Pass + Overhead Studio Light Strips
    renderCarGroup(carWorldMat, false);
    drawMesh(gpuParts.lightRig, mat4Identity(), MATERIALS.rig, false, false);

    gl.bindVertexArray(null);

    if (!cam.reducedMotion && cam.visible && !document.hidden) {
      cam.rafId = requestAnimationFrame(renderFrame);
    }
  };

  const requestRender = () => {
    if (!cam.rafId && !cam.contextLost && cam.visible && !document.hidden) {
      lastTime = performance.now();
      cam.rafId = requestAnimationFrame(renderFrame);
    }
  };

  const onContextLost = (e) => {
    e.preventDefault();
    cam.contextLost = true;
    if (cam.rafId) {
      cancelAnimationFrame(cam.rafId);
      cam.rafId = 0;
    }
    options.onContextLost?.();
  };

  const onContextRestored = () => {
    if (initResources()) {
      cam.contextLost = false;
      options.onContextRestored?.();
      requestRender();
    }
  };

  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  requestRender();
  if (cam.reducedMotion) {
    renderFrame(performance.now());
  }

  return {
    setScrollProgress(progress) {
      cam.scrollProgress = clamp01(progress);
      requestRender();
    },
    setVisible(isVisible) {
      cam.visible = Boolean(isVisible);
      if (cam.visible) {
        requestRender();
      } else if (cam.rafId) {
        cancelAnimationFrame(cam.rafId);
        cam.rafId = 0;
      }
    },
    setReducedMotion(isReduced) {
      cam.reducedMotion = Boolean(isReduced);
      if (cam.reducedMotion) {
        cam.carZ = 0;
      }
      requestRender();
    },
    destroy() {
      if (cam.rafId) cancelAnimationFrame(cam.rafId);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
    }
  };
}
