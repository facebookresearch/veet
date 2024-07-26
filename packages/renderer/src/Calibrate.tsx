/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { useCalibStoreData } from '../../shared/CalibStore';

import { buttonBorder, editorFont, Label, Row } from './styles';

export const Calibrate = () => {
  const deviceID = useCalibStoreData('deviceID');
  return (
    <div data-classes='flxg-1'>
      <Row>
        <Label>Set Calibration File</Label>
        <div data-classes={editorFont + buttonBorder} onClick={window.bridgeApi.updateCalibrationFile}>Choose File</div>
      </Row>
      <Row>
        <Label>Current Calibration Device ID</Label>
        <div data-classes={editorFont}>{(deviceID && deviceID.length > 0) ? deviceID : 'None Set'}</div>
      </Row>
    </div>
  );

};
