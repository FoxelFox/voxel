import { contextUniform, device, statistics } from "../index";
import meshShader from "./voxel-mesh.wgsl" with {type: "text"};
import gridShader from "./voxel-grid.wgsl" with {type: "text"};
import { Chunk } from "../data/chunk";

export class VoxelMesh {

  meshComputePipeline: GPUComputePipeline
  gridComputePipeline: GPUComputePipeline
  meshBindGroup: GPUBindGroup;
  gridBindGroup: GPUBindGroup;
  uniformBindGroup: GPUBindGroup;

  gridSize = { x: 256, y: 256, z: 256 };
  
  vertexCounterBuffer: GPUBuffer
  vertexBuffer: GPUBuffer

  queue: Chunk[] = []
  activeChunk: Chunk;

  constructor() {

    // 2. Voxel Grid Data
    const numVoxels = this.gridSize.x * this.gridSize.y * this.gridSize.z;

    // 3. Create Buffers
    //const maxVertices = numVoxels * 18; // Max possible vertices
    const maxVertices = numVoxels * 15;
    const vertexStructSize = 4 * 4;

    const gridSizeBuffer = device.createBuffer({
      size: 3 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const voxelGridBuffer = device.createBuffer({
      size: numVoxels * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.vertexBuffer = device.createBuffer({
      label: "Vertex Buffer",
      size: maxVertices * vertexStructSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    this.vertexCounterBuffer = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    // 4. Write initial data to buffers
    device.queue.writeBuffer(gridSizeBuffer, 0, new Uint32Array([this.gridSize.x, this.gridSize.y, this.gridSize.z]));
    device.queue.writeBuffer(this.vertexCounterBuffer, 0, new Uint32Array([0]));

    // Pipelines
    this.meshComputePipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({
          code: meshShader,
        }),
        entryPoint: "main",
      },
    });

    this.gridComputePipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({
          code: gridShader,
        }),
        entryPoint: "main",
      },
    });


    // Bind Groups
    this.meshBindGroup = device.createBindGroup({
      layout: this.meshComputePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gridSizeBuffer } },
        { binding: 1, resource: { buffer: voxelGridBuffer } },
        { binding: 2, resource: { buffer: this.vertexBuffer } },
        { binding: 3, resource: { buffer: this.vertexCounterBuffer } },
      ],
    });

    this.gridBindGroup = device.createBindGroup({
      layout: this.gridComputePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gridSizeBuffer } },
        { binding: 1, resource: { buffer: voxelGridBuffer } },
      ],
    });

    this.uniformBindGroup = device.createBindGroup({
      layout: this.gridComputePipeline.getBindGroupLayout(1),
      entries: [{
        binding: 0,
        resource: { buffer: contextUniform.uniformBuffer }
      }]
    });
  }

  update() {
    if (!this.activeChunk) {
      this.activeChunk = this.queue.shift();

      if (!this.activeChunk) {
        return;
      }

      let start = performance.now();

      // 7. Dispatch Compute Shader
      const commandEncoder = device.createCommandEncoder();

      // grid
      const gridComputePass = commandEncoder.beginComputePass();
      gridComputePass.setPipeline(this.gridComputePipeline);
      gridComputePass.setBindGroup(0, this.gridBindGroup);
      gridComputePass.setBindGroup(1, this.uniformBindGroup);
      gridComputePass.dispatchWorkgroups(
        Math.ceil(this.gridSize.x / 4),
        Math.ceil(this.gridSize.y / 4),
        Math.ceil(this.gridSize.z / 4)
      );
      gridComputePass.end();

      // mesh 
      const meshComputePass = commandEncoder.beginComputePass();
      meshComputePass.setPipeline(this.meshComputePipeline);
      meshComputePass.setBindGroup(0, this.meshBindGroup);
      meshComputePass.dispatchWorkgroups(
        Math.ceil(this.gridSize.x / 4),
        Math.ceil(this.gridSize.y / 4),
        Math.ceil(this.gridSize.z / 4)
      );
      meshComputePass.end();

      // (Optional) Read back the number of generated vertices
      const readbackBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
      commandEncoder.copyBufferToBuffer(this.vertexCounterBuffer, 0, readbackBuffer, 0, 4);

      // Submit to GPU
      device.queue.submit([commandEncoder.finish()]);

      readbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
        const result = new Uint32Array(readbackBuffer.getMappedRange());
        const chunkVertexCount = result[0];
        readbackBuffer.unmap();
        device.queue.writeBuffer(this.vertexCounterBuffer, 0, new Uint32Array([0]));
        
        statistics.vertices =  chunkVertexCount;
        statistics.meshGeneration = (statistics.meshGeneration * 99 + (performance.now() - start)) / 100;
        
        const chunkVertexBuffer = device.createBuffer({
          label: `Vertex Buffer for chunk ${this.activeChunk.id}`,
          size: chunkVertexCount * 16,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });


        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(this.vertexBuffer, 0, chunkVertexBuffer, 0, chunkVertexCount * 16);
        device.queue.submit([commandEncoder.finish()]);
        device.queue.onSubmittedWorkDone().then(() => {

          if (this.activeChunk.vertexBuffer) {
            this.activeChunk.vertexBuffer.destroy();
          }

          this.activeChunk.vertexBuffer = chunkVertexBuffer;
          this.activeChunk.vertexCount = chunkVertexCount;
          this.activeChunk = undefined;
        })
      });
    }
  }

  enqueueChunkUpdate(chunk: Chunk) {
    this.queue.push(chunk);
  }
}