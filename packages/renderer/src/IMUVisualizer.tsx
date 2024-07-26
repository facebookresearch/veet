/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import type { PropsWithChildren} from 'react';
import { useCallback } from 'react';

import { useStoreData } from '../../shared/DataStore';
import { IMUCanvas } from './IMUCanvas';
import { Button } from './Button';
import { Tooltip } from 'react-tooltip';

const Trow = (props: PropsWithChildren) => <tr data-classes='b-1'>{props.children}</tr>;
const Tcell = (props: PropsWithChildren) => <td data-classes='b-1 p-8 w-100 ta-r'>{props.children}</td>;

export const IMUVisualizer = () => {
  const imuStr = useStoreData('imuData');
  const windowSize = useStoreData('windowSize');

  const copyData = useCallback(() => {
    navigator.clipboard.writeText(imuStr ?? '');
  }, [imuStr]);

  if (!imuStr) {
    return <div/>;
  }
  const imuData = imuStr.split(',');
  if (imuData.length < 8 || imuData.length > 9 ) {
    return <div>Invalid imuStr: {imuStr}</div>;
  }
  const accel = new Array(3);
  const gyro = new Array(3);
  const temperature = new Array(1);

  accel[0] = parseFloat(imuData[2]);
  accel[1] = parseFloat(imuData[3]);
  accel[2] = parseFloat(imuData[4]);
  gyro[0] =  parseFloat(imuData[5]);
  gyro[1] =  parseFloat(imuData[6]);
  gyro[2] =  parseFloat(imuData[7]);
  if (imuData.length == 9 ) {
  temperature[0] =  parseFloat(imuData[8]);
  } else {
    temperature[0] = 'N/A';
  }
  const magnitudeAccel = Math.sqrt(accel[0] * accel[0] + accel[1] * accel[1] + accel[2] * accel[2]);
  const canvasWidth = Math.round(windowSize[0] * 0.85);
  const canvasHeight = Math.round(canvasWidth * 0.6);

  return (
    <div data-classes='c-#FFF-bg d-f ai-c flxd-c'>
      <div data-classes='fs-24 m-b-20'>Inertial Measurement Unit (BMI270)</div>
      <IMUCanvas width={canvasWidth} height={canvasHeight} clearColor={[0.0, 0.0, 0.0, 1.0]}/>
      <div data-classes='m-t-4'>Note: Should point up when glasses oriented normally.</div>
      <div data-classes='d-f flxd-r m-t-30 ai-fs'>
        <table style={{ borderCollapse: 'collapse' }}><tbody>
          <Trow>
            <Tcell>Accel X</Tcell>
            <Tcell>{accel[0].toFixed(1)} m/s²</Tcell>
          </Trow>
          <Trow>
            <Tcell>Accel Y</Tcell>
            <Tcell>{accel[1].toFixed(1)} m/s²</Tcell>
          </Trow>
          <Trow>
            <Tcell>Accel Z</Tcell>
            <Tcell>{accel[2].toFixed(1)} m/s²</Tcell>
          </Trow>
          <Trow>
            <Tcell>Magnitude</Tcell>
            <Tcell>{magnitudeAccel.toFixed(3)} m/s²</Tcell>
          </Trow>
        </tbody></table>
        <table data-classes='m-l-60' style={{ borderCollapse: 'collapse' }}><tbody>
          <Trow>
            <Tcell>Gyro X</Tcell>
            <Tcell>{gyro[0].toFixed(1)} deg/s</Tcell>
          </Trow>
          <Trow>
            <Tcell>Gyro Y</Tcell>
            <Tcell>{gyro[1].toFixed(1)} deg/s</Tcell>
          </Trow>
          <Trow>
            <Tcell>Gyro Z</Tcell>
            <Tcell>{gyro[2].toFixed(1)} deg/s</Tcell>
          </Trow>
          <Trow>
            <Tcell>Temperature </Tcell>
            <Tcell>{temperature[0]} Cº</Tcell>
          </Trow>
        </tbody></table>
      </div>
      <div data-classes="m-t-20" data-tooltip-id="expl" data-tooltip-content="Copy last sampled data to clipboard">
        <Button onClick={copyData}>Copy Data</Button>
      </div>
      <Tooltip id="expl" />
    </div>
  );
};
