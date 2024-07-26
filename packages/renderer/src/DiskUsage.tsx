/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars

import { useStoreData } from '../../shared/DataStore';
import { subHeadingFont } from './styles';

export const DiskUsage = () => {
  const drivePath = useStoreData('drivePath');
  const driveSpaceAvailable = useStoreData('driveSpaceAvailable');
  const driveSpaceTotal = useStoreData('driveSpaceTotal');
  const diskUsage = driveSpaceTotal - driveSpaceAvailable;
  const diskUsageMB = diskUsage / (1024*1024);
  const diskTotalMB = driveSpaceTotal / (1024*1024);
  const diskPct = driveSpaceTotal ? (diskUsage / driveSpaceTotal) * 100 : 0;
  const firmwareVersion = useStoreData('firmwareVersion') || 'Unknown';
  const hardwareVersion = useStoreData('hardwareVersion') || 'Unknown';
  let diskUsageColor = '#00b000'; // green
  if (diskPct >= 70 ) {
    diskUsageColor = '#FF0000'; // red
  } else if (diskPct > 30) {
    diskUsageColor = '#ccaa00'; // yellow
  }

  // Have we found the drive yet?
  if (!drivePath) {
    return <span/>;
  }

  return (
    <div data-classes='d-f flxd-c b-0 b-l-1 m-l-15 p-l-15 c-#aaa-b'>
      <div data-classes='fs-24'>
        Disk Usage: {diskUsageMB.toLocaleString('en-US', {maximumFractionDigits: 1})}MB / {diskTotalMB.toLocaleString('en-US', {maximumFractionDigits: 1})}MB - <span data-classes={`m-l-7 c-${diskUsageColor}-fg`}>{diskPct.toFixed(1)}%</span>
      </div>
      <div data-classes={subHeadingFont}>Hardware Version: {hardwareVersion}  |   Firmware Version: {firmwareVersion} </div>
    </div>
  );
};
