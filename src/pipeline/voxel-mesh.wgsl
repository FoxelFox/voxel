#import "vertex.wgsl"

// input
@group(0) @binding(0) var<uniform> grid_size: vec3<u32>;
@group(0) @binding(1) var<storage, read> voxel_grid: array<u32>;

// output
@group(0) @binding(2) var<storage, read_write> vertex_buffer: array<Vertex>;
@group(0) @binding(3) var<storage, read_write> vertex_counter: atomic<u32>;

// --- NEW: Explicit Cube Triangle Vertices ---
// All 36 vertices for a cube's 12 triangles, with correct CCW winding.
const CUBE_TRIANGLE_VERTICES = array<vec3<f32>, 36>(
  // +X (right)
  vec3(0.5, -0.5, 0.5), vec3(0.5, -0.5, -0.5), vec3(0.5, 0.5, -0.5),
  vec3(0.5, -0.5, 0.5), vec3(0.5, 0.5, -0.5), vec3(0.5, 0.5, 0.5),
  // -X (left)
  vec3(-0.5, -0.5, -0.5), vec3(-0.5, -0.5, 0.5), vec3(-0.5, 0.5, 0.5),
  vec3(-0.5, -0.5, -0.5), vec3(-0.5, 0.5, 0.5), vec3(-0.5, 0.5, -0.5),
  // +Y (top)
  vec3(-0.5, 0.5, 0.5), vec3(0.5, 0.5, -0.5), vec3(-0.5, 0.5, -0.5),
  vec3(-0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, -0.5),
  // -Y (bottom)
  vec3(-0.5, -0.5, -0.5), vec3(0.5, -0.5, 0.5), vec3(-0.5, -0.5, 0.5),
  vec3(-0.5, -0.5, -0.5), vec3(0.5, -0.5, -0.5), vec3(0.5, -0.5, 0.5),
  // +Z (front)
  vec3(-0.5, -0.5, 0.5), vec3(0.5, 0.5, 0.5), vec3(-0.5, 0.5, 0.5),
  vec3(-0.5, -0.5, 0.5), vec3(0.5, -0.5, 0.5), vec3(0.5, 0.5, 0.5),
  // -Z (back)
  vec3(0.5, -0.5, -0.5), vec3(-0.5, 0.5, -0.5), vec3(0.5, 0.5, -0.5),
  vec3(0.5, -0.5, -0.5), vec3(-0.5, -0.5, -0.5), vec3(-0.5, 0.5, -0.5)
);

// Function to get voxel value at a given coordinate
fn get_voxel(coord: vec3<i32>) -> u32 {
  if (any(coord < vec3<i32>(0)) || any(coord >= vec3<i32>(grid_size))) {
    return 0; // Treat out-of-bounds as air
  }
  let index = u32(coord.x) + u32(coord.y) * grid_size.x + u32(coord.z) * grid_size.x * grid_size.y;
  return voxel_grid[index];
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (any(id >= grid_size)) { return; }

  let voxel_coord = vec3<i32>(id);
  if (get_voxel(voxel_coord) == 0) { return; }

  // Directions to check for neighbors
  let neighbors = array<vec3<i32>, 6>(
    vec3(1, 0, 0), vec3(-1, 0, 0),
    vec3(0, 1, 0), vec3(0, -1, 0),
    vec3(0, 0, 1), vec3(0, 0, -1)
  );

  for (var i = 0u; i < 6u; i = i + 1u) {
    if (get_voxel(voxel_coord + neighbors[i]) == 0) {
      let vertex_index = atomicAdd(&vertex_counter, 6u);
      let face_vertex_offset = i * 6u;

      for (var j = 0u; j < 6u; j = j + 1u) {
        let pos = vec3<f32>(id) + CUBE_TRIANGLE_VERTICES[face_vertex_offset + j];
        vertex_buffer[vertex_index + j].position = vec4<f32>(pos, f32(i));
      }
    }
  }
}