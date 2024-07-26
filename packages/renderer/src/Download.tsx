/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { humanReadableFileSize } from '../../shared/utils';
import { SENSOR_DATA_FILENAME } from '../../shared/constants';

import { useStoreData } from '../../shared/DataStore';
import { buttonBorder, editorFont, Label, Row, subtleFontColor } from './styles';

export const Download = () => {
  const drivePath = useStoreData('drivePath');
  const sensorDataPath = drivePath ? drivePath + SENSOR_DATA_FILENAME : null;
  const sensorDataFileSize = humanReadableFileSize(useStoreData('sensorDataFileSize'));

  const ShowFolder = async () => {
    if (sensorDataPath) {
      try {
        await window.bridgeApi.showFolder(sensorDataPath);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div data-classes='flxg-1'>
      <Row>
        <Label>Device Data Path</Label>
        <div data-classes={editorFont + buttonBorder} onClick={ShowFolder}>LOCATE</div>
        <div data-classes={editorFont + subtleFontColor + 'm-l-20'}>{sensorDataPath}</div>
      </Row>
      <Row>
        <Label>Sensor Data File Size</Label>
        <div data-classes={editorFont}>{sensorDataFileSize}</div>
      </Row>
    </div>
  );

};
