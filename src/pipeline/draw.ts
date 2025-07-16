import { mat4, vec3 } from "wgpu-matrix";
import { canvas, context, device, voxel } from "../index";
import shader from "./draw.wgsl" with {type: "text"};


export class Draw {

  uniformBuffer: GPUBuffer
  renderBindGroup: GPUBindGroup
  depthTexture: GPUTexture
  renderPipeline: GPURenderPipeline


  constructor() {
    const renderShaderModule = device.createShaderModule({
      code: shader,
    });

    this.renderPipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: renderShaderModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 16,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x4" }, // position
            ],
          },
        ],
      },
      fragment: {
        module: renderShaderModule,
        entryPoint: "fs_main",
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back", // Cull back faces
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    // 10. Create Uniform Buffer for Matrices
    this.uniformBuffer = device.createBuffer({
      size: 16 * 4, // 1x mat4x4<f32>
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 11. Create Render Bind Group
    this.renderBindGroup = device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    // 12. Create Depth Texture
    this.depthTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }


  update() {

    if (voxel.vertexCount === 0) {
      return;
    }

    if (canvas.width !== this.depthTexture.width || canvas.height !== this.depthTexture.height) {
      this.depthTexture.destroy();
      this.depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }

    // Update camera matrices
    // Assuming you have imported the library, e.g.:
    // import { mat4, vec3 } from 'wgpu-matrix';

    // Update camera matrices
    const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, canvas.width / canvas.height, 1, 1000.0);

    // --- View Matrix (Camera) ---
    // Stays the same. Defines the camera's viewpoint.
    const eye = [voxel.gridSize.x, voxel.gridSize.y * 1.125, voxel.gridSize.z * 1.5];
    const center = [voxel.gridSize.x / 2, voxel.gridSize.y / 2.5, voxel.gridSize.z / 2];
    const viewMatrix = mat4.lookAt(eye, center, [0, 1, 0]);

    // --- Model Matrix (Object) ---
    // We build the rotation by creating individual transformation matrices and multiplying them.
    const modelCenter = [voxel.gridSize.x / 2, voxel.gridSize.y / 2, voxel.gridSize.z / 2];
    const now = Date.now() / 10000;

    // Create the three transformations needed to rotate around the center
    const translateToOrigin = mat4.translation(vec3.negate(modelCenter)); // 1. T_inv
    const rotation = mat4.rotationY(now * 0.5);                           // 2. R
    const translateBack = mat4.translation(modelCenter);                 // 3. T

    // Combine them to create the final model matrix: M = T * R * T_inv
    const modelMatrix = mat4.multiply(mat4.multiply(translateBack, rotation), translateToOrigin);

    // --- Combine Matrices ---
    // The final MVP matrix is P * V * M
    const viewProjectionMatrix = mat4.multiply(projectionMatrix, viewMatrix);
    const modelViewProjectionMatrix = mat4.multiply(viewProjectionMatrix, modelMatrix);


    device.queue.writeBuffer(this.uniformBuffer, 0, modelViewProjectionMatrix);

    // Start render pass
    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0., g: 0.2, b: 0.4, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(this.renderPipeline);
    passEncoder.setBindGroup(0, this.renderBindGroup);
    passEncoder.setVertexBuffer(0, voxel.vertexBuffer);
    passEncoder.draw(voxel.vertexCount);

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

  }
}