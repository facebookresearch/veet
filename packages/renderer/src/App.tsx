/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import {q} from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars

import {createRoot} from 'react-dom/client';
import {useStoreData} from '../../shared/DataStore';
import {BatteryDisplay} from './BatteryDisplay';
import {ConnectionStatus} from './ConnectionStatus';
import * as QuarkStyles from 'quark-styles';
import {Download} from './Download';
import {ConfigEditor} from './ConfigEditor';
import {TOFVisualizer} from './TOFVisualizer';
import {SerialLog} from './SerialLog';
import {PHOVisualizer} from './PHOVisualizer';
import {IMUVisualizer} from './IMUVisualizer';
import {ALSVisualizer} from './ALSVisualizer';
import {DiskUsage} from './DiskUsage';
import {Tab, TabCollection} from './Tabs';
import {useSettingsStoreData} from '../../shared/SettingsStore';
import type {ReactNode} from 'react';
import {TAB_NAMES} from '../../shared/constants';

QuarkStyles.init(false);

const App = () => {
  const isConnected = Boolean(useStoreData('connectionPort'));
  const modalMessage = useStoreData('modalMessage');
  const showSerialTab = useSettingsStoreData('showSerialLog');
  const modalOverlay = modalMessage ? (
    <div data-classes="c-#CCCCCCDD-bg fullSize pos-a cc d-f z-2 fs-44">{modalMessage}</div>
  ) : (
    ''
  );

  let overlay: ReactNode = '';
  if (!isConnected) {
    overlay = <div data-classes="c-#CCCCCCCC-bg fullSize pos-a" />;
  }

  return (
    <div data-classes="c-#022-fg d-f flxd-c pos-a fullSize">
      <div data-classes="c-#ddd-bg d-f ai-s p-20 p-b-50">
        <ConnectionStatus />
        <DiskUsage />
        <div data-classes="flxg-100" />
        <BatteryDisplay />
      </div>
      <div data-classes="d-f flxg-1 pos-r c-#fff-bg">
        <TabCollection>
          <Tab label={TAB_NAMES.CONFIG}>
            <ConfigEditor />
          </Tab>
          <Tab label={TAB_NAMES.DOWNLOAD}>
            <Download />
          </Tab>
          <Tab label={TAB_NAMES.TOF} startGroup={true}>
            <div data-classes="d-f flxd-c flxg-1 ai-c">
              <TOFVisualizer />
            </div>
          </Tab>
          <Tab label={TAB_NAMES.PHO}>
            <div data-classes="d-f flxd-c flxg-1 ai-c">
              <PHOVisualizer />
            </div>
          </Tab>
          <Tab label={TAB_NAMES.IMU}>
            <div data-classes="d-f flxd-c flxg-1 ai-c">
              <IMUVisualizer />
            </div>
          </Tab>
          <Tab label={TAB_NAMES.ALS}>
            <div data-classes="d-f flxd-c flxg-1 ai-c">
              <ALSVisualizer />
            </div>
          </Tab>
          <Tab label={TAB_NAMES.SERIAL_LOG} hidden={!showSerialTab}>
            <SerialLog />
          </Tab>
        </TabCollection>
        {overlay}
      </div>
      {modalOverlay}
    </div>
  );
};

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
