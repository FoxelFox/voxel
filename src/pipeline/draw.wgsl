#import "vertex.wgsl"

// Uniforms for camera and projection matrices
struct Uniforms {
  modelViewProjectionMatrix: mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// Vertex shader output
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
};

// --- Vertex Shader ---
// Takes a vertex from our buffer and projects it onto the screen.
@vertex
fn vs_main(in: Vertex) -> VertexOutput {
  var out: VertexOutput;
  out.position = uniforms.modelViewProjectionMatrix * vec4<f32>(in.position, 1.0);
  out.normal = in.normal;
  return out;
}

// --- Fragment Shader ---
// Colors the pixels. Here, we'll use the normal for some basic lighting.
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // Simple directional lighting
  let lightDirection = normalize(vec3<f32>(0.5, 1.0, -0.8));
  let light = max(dot(in.normal, lightDirection), 0.0);
  let color = vec3<f32>(0.8, 0.1, 0.4) * (light * 0.7 + 0.3);
  return vec4<f32>(color, 1.0);
}