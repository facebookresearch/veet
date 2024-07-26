/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import type { LinesMesh, Mesh, Nullable} from '@babylonjs/core';
import { ArcRotateCamera, Color3, Color4, MeshBuilder, PointLight, Quaternion, StandardMaterial, Vector3 } from '@babylonjs/core';
import { getDataStore, registerKeyedChangeHandler, unregisterKeyedChangeHandler } from '../../shared/DataStore';
import { Canvas } from './Canvas';

type LineOptions = {
  points: Vector3[];
  colors: Color4[];
  updatable?: boolean;
  instance?: Nullable<LinesMesh>;
}

export class IMUCanvas extends Canvas {
  private cone: Mesh | null = null;
  private line: LinesMesh | null = null;
  private linePoints: [Vector3, Vector3] = [new Vector3(0, 0, 0), new Vector3(0, 1, 0)];
  private lineColors: [Color4, Color4] = [new Color4(0.0, 1.0, 0.0, 1.0), new Color4(0.0, 1.0, 0.0, 1.0)];
  private lineOptions: LineOptions = {
    points: this.linePoints,
    colors: this.lineColors,
    updatable: true,
  };

  engineSetup() {
    super.engineSetup();

    if (!this.renderScene) {
      return;
    }

    new ArcRotateCamera('camera1', 0, 0, 5, new Vector3(0, 0, 0), this.renderScene, true);

    const dirLight = new PointLight('light', new Vector3(0, 0, 5), this.renderScene);
    dirLight.intensity = 1;
    dirLight.diffuse = new Color3(1.0, 1.0, 1.0);

    this.cone = MeshBuilder.CreateCylinder('cone',
    {
      height: 0.4,
      diameterTop: 0.0,
      diameterBottom: 0.2,
    }, this.renderScene);

    this.line = MeshBuilder.CreateLines('line', this.lineOptions, this.renderScene);

    const arrowMaterial = new StandardMaterial('arrowMaterial', this.renderScene);
    arrowMaterial.diffuseColor = new Color3(0.0, 1.0, 0.0);
    arrowMaterial.specularColor = new Color3(1.0, 1.0, 1.0);
    arrowMaterial.specularPower = 8;
    this.cone.material = arrowMaterial;

    this.updateIMUData(); // set the initial orientation
  }

  updateIMUData = () => {
    const imuStr = getDataStore().imuData;
    if (!imuStr || imuStr.length == 0) {
      return;
    }
    const imuData = imuStr.split(',').slice(2,5).map(x => parseFloat(x));
    const accelDir: Vector3 = new Vector3(imuData[1], imuData[0], -1 * imuData[2]);
    this.linePoints[1] = accelDir.scale(0.2);

    // this is how you update lines apparently
    this.lineOptions.instance = this.line;
    this.line = MeshBuilder.CreateLines('line', this.lineOptions, this.renderScene);

    // Update the cone to point along the line, at the end of the line
    if (!this.cone) {
      return;
    }
    this.cone.position = this.linePoints[1];
    const coneUp = accelDir.normalize();
    // These could be colinear, but it's very unlikely and non fatal, so ignoring.
    const coneForward = coneUp.cross(Vector3.Left()).normalize();
    this.cone.rotationQuaternion = Quaternion.FromLookDirectionLH(coneForward, coneUp);
  };

  componentDidMount() {
    super.componentDidMount();
    registerKeyedChangeHandler(this.updateIMUData, 'imuData');
  }

  componentWillUnmount(): void {
    super.componentWillUnmount();
    unregisterKeyedChangeHandler(this.updateIMUData, 'imuData');
  }

}
