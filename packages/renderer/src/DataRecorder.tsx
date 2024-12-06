/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { Button } from './Button';
import { useStoreData } from '../../shared/DataStore';
import { useCallback } from 'react';
import { Row } from './styles';

type RecordPanelProps = {
  data: string;
};

export const RecordPanel = (props: RecordPanelProps) => {
  const copyData = useCallback(() => {
    window.bridgeApi.writeClipboard(props.data ?? '');
  }, [props.data]);
  return (
    <Row data-classes='m-t-20'>
      <div data-tooltip-id="expl" data-tooltip-content="Copy last sampled data to clipboard">
        <Button onClick={copyData}>Copy Data</Button>
      </div>
      <div data-classes="m-l-10" data-tooltip-id="expl" data-tooltip-content="Record stream of data to file on disk">
        <DataRecorder />
      </div>
    </Row>
  );
};

export const DataRecorder = () => {
  const isRecording = useStoreData('recordingStream');
  const onClick = useCallback(() => window.bridgeApi.toggleRecording(), []);
  return <Button data-classes={isRecording?'c-#F00-bg':''} onClick={onClick}>{!isRecording ? 'Record Data' : 'STOP Recording'}</Button>;
};
