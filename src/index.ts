import { GPUContext } from "./gpu";
import { ContextUniform } from "./data/context";
import { VoxelMesh } from "./pipeline/voxel-mesh";
import { Draw } from "./pipeline/draw";

export const gpu = new GPUContext();
await gpu.init();

export const device = gpu.device;
export const context = gpu.context;
export const canvas = gpu.canvas;
export const mouse = gpu.mouse;
export const time = gpu.time;
export const contextUniform = new ContextUniform();
export const voxel = new VoxelMesh();
voxel.update();

const uniforms = [contextUniform];
const pipelines = [new Draw()];

loop();

// this has to be set after first render loop due to safari bug
document.getElementsByTagName('canvas')[0].setAttribute('style', 'position: fixed;')


function loop() {
  gpu.update();

  

  for(const uniform of uniforms) {
    uniform.update();
  }

  for(const pipeline of pipelines) {
    pipeline.update();
  }
  requestAnimationFrame(loop);
}