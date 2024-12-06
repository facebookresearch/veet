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

export const BatteryDisplay = () => {
  const batteryFrac = useStoreData('batteryPct');
  if (batteryFrac == null) {
    return <div/>;
  }
  const batteryPct = Math.round(batteryFrac * 100) + '%';
  let batteryFiller;
  if (batteryFrac > 0.97) {
    // round right side too
    batteryFiller = <div data-classes={`h-100% br-5 w-${batteryPct} c-#00e800-bg`} />;
  } else if (batteryFrac > 0.7) {
    // just round left side
    batteryFiller = <div data-classes={`h-100% br-l-5 w-${batteryPct} c-#00e800-bg`} />;
  } else if (batteryFrac > 0.4) {
    // turn yellow
    batteryFiller = <div data-classes={`h-100% br-l-5 w-${batteryPct} c-#FFE500-bg`} />;
  } else {
    // turn red
    batteryFiller = <div data-classes={`h-100% br-l-5 w-${batteryPct} c-#FF0000-bg`} />;
  }
  return (
    <div data-classes='d-f h-40 ai-c'>
      <div data-classes='pos-r d-f b-1 br-5 h-27 w-53'>
        {batteryFiller}
        <div data-classes='pos-a fullSize fs-10 d-f cc'> {batteryPct} </div>
      </div>
      <div data-classes='d-f h-11 w-4 br-r-2 c-#000-bg'/>
    </div>
  );
};
