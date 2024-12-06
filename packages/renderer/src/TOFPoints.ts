/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Mesh, Scene, Vector3} from '@babylonjs/core';
import { Color3, Matrix, MeshBuilder, StandardMaterial, Vector4 } from '@babylonjs/core';

export class TOFPoints {
  private renderScene: Scene;
  private numPoints: number;
  private matrices: Float32Array;
  private colors: Float32Array;
  private mesh: Mesh | null = null;

  constructor(renderScene: Scene, numPoints: number) {
    this.renderScene = renderScene;
    this.numPoints = numPoints;
    this.matrices = new Float32Array(16 * numPoints);
    this.colors = new Float32Array(4 * numPoints);
  }

  public createPoints() {
    this.mesh = MeshBuilder.CreatePlane('plane', {size: 0.1});

    const m = Matrix.Identity();
    const c = Vector4.One();

    // Initialize data
    for (let i = 0; i < this.numPoints; i++) {
      m.copyToArray(this.matrices, i * 16);
      c.toArray(this.colors, i * 4);
    }

    this.mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    this.mesh.thinInstanceSetBuffer('color', this.colors, 4, false);

    const material = new StandardMaterial('meshMaterial', this.renderScene);
    material.disableLighting = true;
    material.emissiveColor = Color3.White();
    this.mesh.material = material;
  }

  // Note, doesn't actually update drawing
  public updatePoint(index: number, pos: Vector3, scale: number, color: Vector4) {
    color.toArray(this.colors, index * 4);
    const m = Matrix.Scaling(scale, scale, scale);
    m.copyToArray(this.matrices, index * 16);
    pos.toArray(this.matrices, (index * 16) + 12);
  }

  public markBuffersUpdated() {
    this.mesh?.thinInstanceBufferUpdated('matrix');
    this.mesh?.thinInstanceBufferUpdated('color');
  }
}
