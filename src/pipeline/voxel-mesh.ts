import { device, statistics } from "../index";
import shader from "./voxel-mesh.wgsl" with {type: "text"};

export class VoxelMesh {


  computePipeline: GPUComputePipeline
  gridSize = { x: 256, y: 256, z: 256 };
  bindGroup: GPUBindGroup;
  vertexCounterBuffer: GPUBuffer
  vertexBuffer: GPUBuffer
  vertexCount = 0;

  inProgress = false;

  constructor() {

    // 2. Voxel Grid Data
    const numVoxels = this.gridSize.x * this.gridSize.y * this.gridSize.z;
    const voxelData = new Uint32Array(numVoxels);
    for (let i = 0; i < numVoxels; i++) {
      // Simple sphere for demonstration
      const x = i % this.gridSize.x;
      const y = Math.floor(i / this.gridSize.x) % this.gridSize.y;
      const z = Math.floor(i / (this.gridSize.x * this.gridSize.y));
      const dist = Math.sqrt(
        (x - this.gridSize.x / 2) ** 2 +
        (y - this.gridSize.y / 2) ** 2 +
        (z - this.gridSize.z / 2) ** 2
      );
      if (dist < this.gridSize.x / 2.0) {
        voxelData[i] = 1;
      } else {
        voxelData[i] = 0;
      }
    }

    // 3. Create Buffers
    const maxVertices = numVoxels / 2 * 9; // Max possible vertices (obbi)
    const vertexStructSize = 1 * 1;

    const gridSizeBuffer = device.createBuffer({
      size: 3 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const voxelGridBuffer = device.createBuffer({
      size: voxelData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.vertexBuffer = device.createBuffer({
      label: "Vertex Buffer",
      size: maxVertices * vertexStructSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.vertexCounterBuffer = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    // 4. Write initial data to buffers
    device.queue.writeBuffer(gridSizeBuffer, 0, new Uint32Array([this.gridSize.x, this.gridSize.y, this.gridSize.z]));
    device.queue.writeBuffer(voxelGridBuffer, 0, voxelData);
    device.queue.writeBuffer(this.vertexCounterBuffer, 0, new Uint32Array([0]));

    // 5. Create Compute Pipeline
    const shaderModule = device.createShaderModule({
      code: shader,
    });

    this.computePipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });

    // 6. Create Bind Group
    this.bindGroup = device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gridSizeBuffer } },
        { binding: 1, resource: { buffer: voxelGridBuffer } },
        { binding: 2, resource: { buffer: this.vertexBuffer } },
        { binding: 3, resource: { buffer: this.vertexCounterBuffer } },
      ],
    });
  }

  update() {
    if (!this.inProgress) {
      this.inProgress = true
      let start = performance.now();

      // 7. Dispatch Compute Shader
      const commandEncoder = device.createCommandEncoder();
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(this.computePipeline);
      computePass.setBindGroup(0, this.bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(this.gridSize.x / 4),
        Math.ceil(this.gridSize.y / 4),
        Math.ceil(this.gridSize.z / 4)
      );
      computePass.end();

      // (Optional) Read back the number of generated vertices
      const readbackBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
      commandEncoder.copyBufferToBuffer(this.vertexCounterBuffer, 0, readbackBuffer, 0, 4);

      // Submit to GPU
      device.queue.submit([commandEncoder.finish()]);

      // Read the result
      readbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
        const result = new Uint32Array(readbackBuffer.getMappedRange());
        this.vertexCount = result[0];
        readbackBuffer.unmap();
        device.queue.writeBuffer(this.vertexCounterBuffer, 0, new Uint32Array([0]));
        
        statistics.vertices =  this.vertexCount;

        statistics.meshGeneration = (statistics.meshGeneration * 99 + (performance.now() - start)) / 100;

        this.inProgress = false;
      });
    }
  }
}