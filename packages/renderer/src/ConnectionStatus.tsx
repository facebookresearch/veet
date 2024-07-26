/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { useConfigStoreData } from '../../shared/ConfigStore';

import { useStoreData } from '../../shared/DataStore';
import { subHeadingFont } from './styles';

export const ConnectionStatus = () => {
  const connectionPort = useStoreData('connectionPort');
  const connectColor = connectionPort ? '#4fff2f' : '#ff0000';
  const connectionLight = <span data-classes={`c-${connectColor}-bg w-24 h-24 br-24 d-ib m-r-10 m-t-3 b-1`} />;

  // We must call these use hooks every render or react complains, hence the odd arrangement
  let participantID = useConfigStoreData('participantID');
  const deviceSide:string|null = useStoreData('deviceSide');
  let researcherID:string|null = useConfigStoreData('researcherID');
  const drivePath = useStoreData('drivePath');

  // Have we found the drive yet?
  if (!drivePath) {
    participantID = 'VEET';
    researcherID = null;
  }

  let deviceSideStr = '';
  if (deviceSide == 'L') {
    deviceSideStr = 'Left';
  } else if (deviceSide == 'R') {
    deviceSideStr = 'Right';
  }
  const connectionString = connectionPort ?
    (<span data-classes='fs-24'><span data-classes='fw-700'>{participantID} {deviceSideStr}</span> Connected.</span>) :
    (<span data-classes='fs-24'>Searching for VEET...</span>);

 let researcherString = <span/>;
 if (connectionPort) {
   if (researcherID) {
     researcherString = <span data-classes={subHeadingFont}>RESEARCHER_ID: {researcherID}</span>;
   } else {
     researcherString = <span data-classes={subHeadingFont}>Searching for storage device...</span>;
   }
 }




  return (
    <div data-classes='h-40 d-f flxd-r ai-fs'>
      {connectionLight}
      <div data-classes='ai-fe d-f flxd-c'>
        {connectionString}
        {researcherString}
      </div>
    </div>
  );
};
