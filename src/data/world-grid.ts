import { voxel } from "..";
import { Chunk } from "./chunk";

export class WorldGrid {
 
  chunks: {[key: number]: Chunk} = {}

  map3D1D(p: number[]): number {
    return p[0] + 16384 * (p[1] + 16384 * p[2]);
  }

  map1D3D(i: number): number[] {
    return [i % 16384, Math.floor(i / 16384) % 16384, Math.floor(i / 16384 / 16384)];
  }

  generateChunk(p: number[]) {
    const id = this.map3D1D(p);
    const chunk = new Chunk();
    this.chunks[id] = chunk;
    chunk.id = id;

    voxel.enqueueChunkUpdate(chunk);
  }

  updateChunk(p: number[]) {
    const id = this.map3D1D(p);
    const chunk = this.chunks[id];
    if (chunk) {
      voxel.enqueueChunkUpdate(chunk);
    }
  }

  getChunksInRadius(p: number[], radius: number): Chunk[] {
    const chunks: Chunk[] = [];

    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        for (let z = -radius; z <= radius; z++) {
          const chunkPos = [p[0] + x, p[1] + y, p[2] + z];
          const chunkId = this.map3D1D(chunkPos);
          if (this.chunks[chunkId]) {
            chunks.push(this.chunks[chunkId]);
          }
        }
      }
    }

    return chunks;
  }
}