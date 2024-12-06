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
import { TOF_DATA_LENGTH, TOF_NUM_SENSORS, TOF_PRE_INFO_LENGTH } from '../../shared/constants';

import { useStoreData } from '../../shared/DataStore';
import { TOFCanvas } from './TOFCanvas';
import { Tooltip } from 'react-tooltip';
import { RecordPanel } from './DataRecorder';

const rowClasses = 'b-1';
const Tcell = (props: PropsWithChildren) => <td data-classes='b-1 p-8'>{props.children}</td>;

type AverageType = {
  conf: number,
  dist: number,
}

function calcAverages(confStr: string[], distStr: string[]): AverageType {
  let distTotal = 0;
  let confTotal = 0;
  let entryCount = 0;

  for (let i=0; i < (TOF_NUM_SENSORS); ++i) {
    const confidence = confStr[i];
    const distance   = distStr[i];
    if (parseInt(confidence) > 30) {
      const c = parseInt(confidence);
      const d = parseInt(distance);
      confTotal += c;
      distTotal += d;
      entryCount++;
    }
  }

  return {
    conf: entryCount ? confTotal / entryCount : 0,
    dist: entryCount ? distTotal / entryCount : 0,
  };
}

export const TOFVisualizer = () => {
  const tofStr = useStoreData('tofData');
  const windowSize = useStoreData('windowSize');

  if (!tofStr) {
    return <div/>;
  }
  const tofData = tofStr.split(',');

  /*
  const timeStamp = tofData[0];
  const resultBitfield = tofData[2];
  const temp = tofData[3];
  const validObjects = tofData[4];
  */

  const sensorData = tofData.slice(TOF_PRE_INFO_LENGTH);
  if (sensorData.length != TOF_DATA_LENGTH) {
    return <div>Unexpected sensor data length: {sensorData.length}</div>;
  }


  const objectOneAverages = calcAverages(
    sensorData.slice(TOF_NUM_SENSORS * 0, TOF_NUM_SENSORS * 1),
    sensorData.slice(TOF_NUM_SENSORS * 2, TOF_NUM_SENSORS * 3),
  );

  const objectTwoAverages = calcAverages(
    sensorData.slice(TOF_NUM_SENSORS * 1, TOF_NUM_SENSORS * 2),
    sensorData.slice(TOF_NUM_SENSORS * 3, TOF_NUM_SENSORS * 4),
  );

  const canvasWidth = Math.round(windowSize[0] * 0.85);
  const canvasHeight = Math.round(canvasWidth * 0.6);

  return (
    <div data-classes='c-#FFF-bg d-f ai-c flxd-c'>
      <div data-classes='fs-24 m-b-10'>Time of Flight (TMF8828)</div>
      <TOFCanvas width={canvasWidth} height={canvasHeight} clearColor={[0.0, 0.0, 0.0, 1.0]}/>
      <div data-classes='m-t-4'>Note: Hashmarks every 50cm</div>
      <table data-classes='m-t-30' style={{borderCollapse: 'collapse'}}><tbody>
        <tr data-classes={rowClasses}>
          <Tcell>Object 1</Tcell>
          <Tcell><div data-classes='w-20 h-20 c-#0F0-bg'/></Tcell>
        </tr>
        <tr data-classes={rowClasses}>
          <Tcell>Confidence</Tcell>
          <Tcell>{(100 * objectOneAverages.conf/256).toFixed(0)}%</Tcell>
        </tr>
        <tr data-classes={rowClasses} data-tooltip-id="expl" data-tooltip-content="Average distance of all samples with confidence > 10%">
          <Tcell>Average Distance</Tcell>
          <Tcell>{objectOneAverages.dist.toLocaleString('en-US', {maximumFractionDigits: 0})} mm</Tcell>
        </tr>
        <tr data-classes={rowClasses}>
          <Tcell>Object 2</Tcell>
          <Tcell><div data-classes='w-20 h-20 c-#F00-bg'/></Tcell>
        </tr>
        <tr data-classes={rowClasses}>
          <Tcell>Confidence</Tcell>
          <Tcell>{(100 * objectTwoAverages.conf/256).toFixed(0)}%</Tcell>
        </tr>
        <tr data-classes={rowClasses} data-tooltip-id="expl" data-tooltip-content="Average distance of all samples with confidence > 10%">
          <Tcell>Average Distance</Tcell>
          <Tcell>{objectTwoAverages.dist.toLocaleString('en-US', {maximumFractionDigits: 0})} mm</Tcell>
        </tr>
      </tbody></table>
      <RecordPanel data={tofStr} />
      <Tooltip id="expl" />
    </div>
  );
};
