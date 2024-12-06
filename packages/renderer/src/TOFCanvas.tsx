/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { ArcRotateCamera, Color3, MeshBuilder, Quaternion, StandardMaterial, Vector3, Vector4 } from '@babylonjs/core';
import { lerp } from '../../shared/utils';
import { TOF_DATA_LENGTH, TOF_FOV_RAD_MAX, TOF_FOV_RAD_MIN, TOF_NUM_SENSORS, TOF_NUM_SENSORS_ON_SIDE, TOF_PRE_INFO_LENGTH } from '../../shared/constants';
import { getDataStore, registerKeyedChangeHandler, unregisterKeyedChangeHandler } from '../../shared/DataStore';
import { Canvas } from './Canvas';
import { TOFPoints } from './TOFPoints';
import { logger } from '../../shared/Logger';

// Calculate deflection vectors for each of our grid points
const DEFLECTION_VECTORS:Vector3[] = new Array(TOF_NUM_SENSORS);
const lerpFOV = (a: number) => lerp(TOF_FOV_RAD_MIN, TOF_FOV_RAD_MAX, (a / (TOF_NUM_SENSORS_ON_SIDE-1)));
const v = Vector3.Forward();
for (let i = 0; i < TOF_NUM_SENSORS; i++) {
  const y = Math.floor(i / TOF_NUM_SENSORS_ON_SIDE);
  const x = i % TOF_NUM_SENSORS_ON_SIDE;
  const q = Quaternion.FromEulerAngles(lerpFOV(y), -lerpFOV(x), 0);
  DEFLECTION_VECTORS[i] = v.applyRotationQuaternion(q);
}

const CONF_THRESHOLD = 0.1;

export class TOFCanvas extends Canvas {
  private conf1: number[] = [];
  private conf2: number[] = [];
  private dist1: number[] = [];
  private dist2: number[] = [];

  private points: TOFPoints | null = null;
  private camera: ArcRotateCamera | null = null;

  engineSetup() {
    super.engineSetup();

    if (!this.renderScene) {
      return;
    }

    const cam = new ArcRotateCamera('camera1', -1.93, 1.26, 1.68, new Vector3(-8.13, 6.82, -6.74), this.renderScene, true);
    this.camera = cam;
    cam.attachControl(this.canvasRef.current);

    const cone = MeshBuilder.CreateCylinder('cone',
    {
      height: 1.0,
      diameterTop: 1.0,
      diameterBottom: 0.0,
    }, this.renderScene);
    const coneMaterial = new StandardMaterial('coneMaterial', this.renderScene);
    coneMaterial.wireframe = true;
    coneMaterial.emissiveColor = new Color3(0.0, 1.0, 1.0);
    cone.material = coneMaterial;
    cone.rotateAround(Vector3.Zero(), Vector3.Right(), Math.PI / 2);

    const _axes = MeshBuilder.CreateLines('axes',
    {
      points: [
        Vector3.Zero(),
        new Vector3(0.0, 0.0, 20.0),

        new Vector3(0.0, 0.0, 5.0),
        new Vector3(0.0, 0.4, 5.0),
        new Vector3(0.0, 0.0, 5.0),

        new Vector3(0.0, 0.0, 10.0),
        new Vector3(0.0, 0.4, 10.0),
        new Vector3(0.0, 0.0, 10.0),

        new Vector3(0.0, 0.0, 15.0),
        new Vector3(0.0, 0.4, 15.0),
        new Vector3(0.0, 0.0, 15.0),

        new Vector3(0.0, 0.0, 20.0),
        new Vector3(0.0, 0.4, 20.0),
        new Vector3(0.0, 0.0, 20.0),
      ],
      updatable: false,
    }, this.renderScene);


    this.points = new TOFPoints(this.renderScene, TOF_NUM_SENSORS * 2);
    this.points.createPoints();
  }

  printCamLocation() {
    const cam = this.camera;
    if (cam) {
      logger.info(`Cam alpha: ${cam.alpha} , beta : ${cam.beta}, radius: ${cam.radius}, pos: ${cam.position}`);
    }
  }

  updateTOFData = () => {
    const tofStr = getDataStore().tofData;
    if (!tofStr || tofStr.length == 0) {
      return;
    }
    const tofData = tofStr.split(',');
    const sensorData = tofData.slice(TOF_PRE_INFO_LENGTH);
    if (sensorData.length != TOF_DATA_LENGTH) {
      logger.error('Unexpected sensor data length: '+ sensorData.length );
      return;
    }

    // For now, let's just use object 1
    this.conf1 = sensorData.slice(TOF_NUM_SENSORS * 0, TOF_NUM_SENSORS * 1).map(x => parseFloat(x)/255); // 0-1
    this.conf2 = sensorData.slice(TOF_NUM_SENSORS * 1, TOF_NUM_SENSORS * 2).map(x => parseFloat(x)/255);
    this.dist1 = sensorData.slice(TOF_NUM_SENSORS * 2, TOF_NUM_SENSORS * 3).map(x => parseFloat(x)/100); // 0.1 meters
    this.dist2 = sensorData.slice(TOF_NUM_SENSORS * 3, TOF_NUM_SENSORS * 4).map(x => parseFloat(x)/100);

    if (!this.points) {
      return;
    }
    const color = Vector4.One();
    for (let o=0; o < 2; ++o) {
      const conf = o ? this.conf2 : this.conf1;
      const dist = o ? this.dist2 : this.dist1;
      for (let i = 0; i < TOF_NUM_SENSORS; i++) {
        const offset = TOF_NUM_SENSORS * o;
        if (conf[i] < CONF_THRESHOLD) {
          this.points.updatePoint(offset + i, Vector3.Zero(), 0, Vector4.Zero());
        } else {
          color.x = color.y = color.z = 0.0;
          if (o) {
            color.x = lerp(0.3, 1.0, conf[i]);
          } else {
            color.y = lerp(0.3, 1.0, conf[i]);
          }
          this.points.updatePoint(offset + i, DEFLECTION_VECTORS[i].scale(dist[i]), dist[i], color);
        }
      }
    }
    this.points.markBuffersUpdated();
  };

  componentDidMount() {
    super.componentDidMount();

    registerKeyedChangeHandler(this.updateTOFData, 'tofData');
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    unregisterKeyedChangeHandler(this.updateTOFData, 'tofData');
  }

}
