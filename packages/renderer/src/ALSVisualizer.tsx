/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { Bar, BarChart, CartesianGrid, Cell, Label, XAxis, YAxis } from 'recharts';

import { useStoreData } from '../../shared/DataStore';
import { Tooltip } from 'react-tooltip';
import { RecordPanel } from './DataRecorder';

type PhotonBarData = {
  name: string,
  normCount: number,
  color: string,
}

// From the TSL2585 data sheet
const gainRatios:Record<number, number> = {
0.5   : 1/249.13,
1     : 1/123.85,
2     : 1/62.97,
4     : 1/31.72,
8     : 1/15.53,
16    : 1/7.97,
32    : 1/3.99,
64    : 1/2.01,
128   : 1,
256   : 1.93,
512   : 3.80,
1024  : 7.42,
2048  : 14.06,
4096  : 25.35,
};

/*
const luxConversionFactor = [
  1 / (82.8 / 7.42), // UV
  1 / 73.7, // VIS
  1 / 74.8, // IR
]
*/

const colors = [
  '#8000bf', // UV
  '#20d400', // visible (green)
  '#940404', // IR
];

const names = [
  'UV (<400nm)',
  'Visible (400-700nm)',
  'Near IR (>700nm)',
];


export const ALSVisualizer = () => {
  const alsStr = useStoreData('alsData');
  const windowSize = useStoreData('windowSize');

  if (!alsStr) {
    return <div/>;
  }

  // Timestamp, ALS, uvGain, visGain, irGain, uvValue, visValue, irValue, flickerValue, Lux
  const start = alsStr.indexOf(',ALS,');
  if (start < 0)  {
    return <div>Invalid alsStr: {alsStr}</div>;
  }
  const actualData = alsStr.slice(start + 5);
  const alsDataStr = actualData.split(',');
  if (alsDataStr.length !== 9) {
    return <div>Invalid alsStr length: {alsDataStr.length}</div>;
  }

  const photonBarData:PhotonBarData[] = new Array(3);
  for (let i=0; i < 3; ++i) {
    const gain = parseFloat(alsDataStr[i+1]);
    let gainRatio = 1.0;
    if (gain == 65535) {
      gainRatio = 0.0; // saturated channel
    } else if (!gainRatios[gain]) {
      return <div>Channel saturated!</div>;
    } else {
      // valid gain
      gainRatio = gainRatios[gain];
    }
    const rawCount = parseFloat(alsDataStr[i + 4]);
    const normCount = rawCount / gainRatio;
    /*
    const integrationTime = 100; // device integration time is fixed at 100ms
    const datasheetIntegrationTime = 10; // datasheet assumes 10ms
    const scaledCount = normCount * (datasheetIntegrationTime / integrationTime);
    const lux = luxConversionFactor[i] * scaledCount;
    */
    photonBarData[i] = {
      name: names[i],
      color: colors[i],
      normCount: normCount,
    };
  }

  let flickerValue = parseFloat(alsDataStr[7]);
  if (Math.abs(flickerValue - 65534) < 0.1) {
    flickerValue = 0.0;
  }
  const luxValue = parseFloat(alsDataStr[8]);

  const graphWidth = Math.round(windowSize[0] * 0.7);
  const graphHeight = Math.round(graphWidth * 0.6);


  return (
    <div data-classes='c-#FFF-bg d-f flxd-c ai-c'>
      <div data-classes='fs-24 m-b-10'>Ambient Light Sensor (TSL2585)</div>
      <BarChart width={graphWidth} height={graphHeight} data={photonBarData}>
        <CartesianGrid strokeDasharray="3 3"/>
        <XAxis dataKey='name'/>
        <YAxis width={70}>
          <Label  position="left" offset={15} angle={270} value="Normalized Counts"/>
        </YAxis>
        <Bar dataKey='normCount'>
          {
            photonBarData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index]} stroke="#000" />
            ))
          }
        </Bar>
      </BarChart>
      <div data-classes='m-t-50 fs-24 m-l-70'>
        {
          flickerValue == 0.0 ?
          'No Flicker detected' :
          `Flicker Rate: ${flickerValue.toLocaleString('en-US', {maximumFractionDigits: 1})} Hz`
        }
      </div>
      <div data-classes='m-t-50 fs-24 m-l-70'>Lux: {luxValue.toLocaleString('en-US', {maximumFractionDigits: 1})}</div>
      <RecordPanel data={alsStr} />
      <Tooltip id="expl" />
    </div>
  );
};
