import "./ux/stats";
import { GPUContext } from "./gpu";
import { ContextUniform } from "./data/context";
import { VoxelMesh } from "./pipeline/voxel-mesh";
import { Draw } from "./pipeline/draw";
import { UxStats } from "./ux/stats";


export interface Statistics {
  fps: number
  vertices: number
  meshGeneration: number
}

export const gpu = new GPUContext();
await gpu.init();

export const device = gpu.device;
export const context = gpu.context;
export const canvas = gpu.canvas;
export const mouse = gpu.mouse;
export const time = gpu.time;
export const contextUniform = new ContextUniform();
export const voxel = new VoxelMesh();
export const statistics : Statistics = {
  fps: 60,
  vertices: 0,
  meshGeneration: 0
}



const uniforms = [contextUniform];
const pipelines = [new Draw()];
let ux: UxStats;
let start: number = 0;

loop();

// this has to be set after first render loop due to safari bug
document.getElementsByTagName('canvas')[0].setAttribute('style', 'position: fixed;')



export function loop() {
  

  gpu.update();

  voxel.update();

  for(const uniform of uniforms) {
    uniform.update();
  }

  for(const pipeline of pipelines) {
    pipeline.update();
  }



  statistics.fps = (statistics.fps * 99 + (1000 / (performance.now() - start))) / 100;
  start = performance.now();
  if (statistics.fps === Infinity) {
    statistics.fps = 60;
  }
  
  if (!ux) {
    ux = document.querySelector('ux-stats') as UxStats;
  } else {
    ux.statistics = statistics;
    ux.requestUpdate();
  }

  
  requestAnimationFrame(loop);
}

