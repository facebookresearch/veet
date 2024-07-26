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

interface LogDisplayProps {
  log: string[];
}
const LogDisplay: React.FC<LogDisplayProps> = ({log}) => {
  const logLines = log.map((line, idx) => {
    return <div data-classes='ww-b' key={idx}>{line}</div>;
  });

  return <div data-classes='d-f flxd-c flxg-1 o-h o-y-s'>{logLines}</div>;
};

export const SerialLog = () => {
  return <LogDisplay log={useStoreData('serialLog')}/>;
};
