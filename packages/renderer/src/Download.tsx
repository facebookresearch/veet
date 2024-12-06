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

import { useStoreData } from '../../shared/DataStore';
import { buttonBorder, editorFont, Label, Row, subtleFontColor } from './styles';
import { logger } from '../../shared/Logger';
import type { ReactNode } from 'react';

export const Download = () => {
  const sensorDataPath = useStoreData('sensorDataFilePath');
  const sensorDataFileSize = humanReadableFileSize(useStoreData('sensorDataFileSize'));
  const driveConnected = Boolean(useStoreData('drivePath'));

  let overlay:ReactNode = '';
  if (!driveConnected) {
    overlay = <div data-classes='c-#CCCCCCCC-bg fullSize pos-a' />;
  }

  const ShowFolder = async () => {
    if (sensorDataPath) {
      try {
        window.bridgeApi.showFolder(sensorDataPath);
      } catch (err) {
        logger.error(err);
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
      {overlay}
    </div>
  );

};
