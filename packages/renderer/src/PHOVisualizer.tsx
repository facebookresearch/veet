/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Label} from 'recharts';

import { useStoreData } from '../../shared/DataStore';
import { Button } from './Button';
import { Tooltip } from 'react-tooltip';
import { useCallback } from 'react';

const gainRatios:Record<number, number> = {
0.5   : 0.008,
1     : 0.016,
2     : 0.032,
4     : 0.065,
8     : 0.125,
16    : 0.25,
32    : 0.5,
64    : 1,
128   : 2,
256   : 3.95,
512   : 7.75,
};

type BarData = {
  name: string,
  normCount: number,
  color: string,
}

export const PHOVisualizer = () => {
  const phoStr = useStoreData('phoData');
  const windowSize = useStoreData('windowSize');

  const copyData = useCallback(() => {
    navigator.clipboard.writeText(phoStr ?? '');
  }, [phoStr]);

  if (!phoStr) {
    return <div/>;
  }

  // PHO DATA: ['time_stamp', 'PHO', Integration (Time "is fixed 50"), 'Gain', '415', '445', '480', '515', '555', '590', '630', '680', 'IR','Dark','ClearL','ClearR']
  const wavelengths = [415, 445, 480, 515, 555, 590, 630, 680, 910];
  //const irradianceScale = [1.425, 1.031, 1.342, 0.550, 0.872, 0.373, 0.648, 0.425, 0.173];
  const colors = ['#7600ed','#0028ff','#00d5ff','#1fff00','#b3ff00','#ffdf00','#ff4f00','#ff0000', '#440000'];
  const phoStrValues = phoStr.split(',');
  const gainIndex = 3;
  const gainIndexValue = parseFloat(phoStrValues[gainIndex]);
  const photonCountIndex = gainIndex + 1; // 3
  const photonCounts = phoStrValues.slice(photonCountIndex, photonCountIndex + wavelengths.length);
  if (photonCounts.length != wavelengths.length) {
    return <div>PhotonCount length mismatch {photonCounts.length}</div>;
  }

  const barData:BarData[] = new Array(photonCounts.length);
  for (let i = 0; i < barData.length; ++i) {
    const rawCount = parseInt(photonCounts[i]) ?? 0;
    const gain = gainRatios[gainIndexValue];
    if (!gain) {
      return <div>Gain not found: {gainIndexValue}</div>;
    }
    const normCount = rawCount / gain;
    /*
    const integrationTime = 50; // 50ms, fixed on device
    const irradiance = (normCount / integrationTime) * irradianceScale[i];
    */
    barData[i] = {
      color: colors[i],
      name: wavelengths[i] + 'nm',
      normCount: normCount,
    };
  }

  const graphWidth = Math.round(windowSize[0] * 0.7);
  const graphHeight = Math.round(graphWidth * 0.6);


  return (
    <div data-classes='c-#FFF-bg d-f flxd-c ai-c'>
      <div data-classes='fs-24 m-b-30'>Spectral Sensor (AS7341)</div>
      <BarChart width={graphWidth} height={graphHeight} data={barData}>
        <CartesianGrid strokeDasharray="3 3"/>
        <XAxis dataKey='name'/>
        <YAxis width={70}>
          <Label  position="left" offset={15} angle={270} value="Normalized Counts"/>
        </YAxis>
        <Bar dataKey='normCount'>
          {
            barData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index]} stroke="#000" />
            ))
          }
        </Bar>
      </BarChart>
      <div data-classes="m-t-20" data-tooltip-id="expl" data-tooltip-content="Copy last sampled data to clipboard">
        <Button onClick={copyData}>Copy Data</Button>
      </div>
      <Tooltip id="expl" />
    </div>
  );
};
