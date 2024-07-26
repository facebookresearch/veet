/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { useRef, useState } from 'react';
import type { ITimezoneOption} from 'react-timezone-select';
import { useTimezoneSelect } from 'react-timezone-select';
import { useStoreData } from '../../shared/DataStore';
import type { ConfigStore} from '../../shared/ConfigStore';
import { useConfigStoreData } from '../../shared/ConfigStore';
import { editorFont, Row, Label, buttonBorder } from './styles';
import { Button } from './Button';


const NumberEditor = ({
  dataKey,
}: {
  dataKey: Exclude<keyof ConfigStore, 'timeZoneOffset'>,
}) => {
  const curVal = useConfigStoreData(dataKey);
  const [tempVal, setTempVal] = useState(curVal);
  const textInput = useRef<HTMLInputElement>(null);

  // Since the change can come from outside, we need to check if we are currently focused before updating
  const isFocussed = textInput && (textInput.current === document.activeElement);
  if (!isFocussed && curVal != tempVal) {
    setTempVal(curVal);
  }

  const onChange = (event: { target: { value: string; }; }) => {
    setTempVal(event.target.value);

    // The value set in the store might not match since the config store will enforce legal values
    // Once the input is blurred they will match again.
    window.bridgeApi.sendConfigStoreValue(dataKey, parseInt(event.target.value));
  };

  const onBlur = () => {
    setTempVal(curVal);
  };

  const onKeyDown = (event: { key: string; }) => {
    if (event.key === 'Enter') {
      textInput && textInput.current && textInput.current.blur();
    }
  };

  return <input
    data-classes={editorFont + buttonBorder + 'w-70'}
    type='number'
    ref={textInput}
    value={tempVal}
    onChange={onChange}
    onBlur={onBlur}
    onKeyDown={onKeyDown}
    step={1}
    min={100}
  />;
};

const TextEditor = ({
  dataKey,
}: {
  dataKey: Exclude<keyof ConfigStore, 'timeZoneOffset'>,
}) => {
  const curVal = useConfigStoreData(dataKey);
  const [tempVal, setTempVal] = useState(curVal);
  const textInput = useRef<HTMLInputElement>(null);

  // Since the change can come from outside, we need to check if we are currently focused before updating
  const isFocussed = textInput && (textInput.current === document.activeElement);
  if (!isFocussed && curVal != tempVal) {
    setTempVal(curVal);
  }

  const onChange = (event: { target: { value: string; }; }) => {
    setTempVal(event.target.value);

    // The value set in the store might not match since the config store will enforce legal values
    // Once the input is blurred they will match again.
    window.bridgeApi.sendConfigStoreValue(dataKey, event.target.value);
  };

  const onBlur = () => {
    setTempVal(curVal);
  };

  const onKeyDown = (event: { key: string; }) => {
    if (event.key === 'Enter') {
      textInput && textInput.current && textInput.current.blur();
    }
  };

  return <input
    data-classes={editorFont + buttonBorder + 'w-250'}
    type='text'
    ref={textInput}
    value={tempVal}
    onChange={onChange}
    onBlur={onBlur}
    onKeyDown={onKeyDown}
  />;
};

const TimezonePicker = () => {
  const curVal:[string, number] = useConfigStoreData('timeZoneOffset');
  const onChange = (timeZone: ITimezoneOption) => {
    const newVal: [string, number] = [timeZone.value, timeZone.offset || 0];
    window.bridgeApi.sendConfigStoreValue('timeZoneOffset', newVal);
  };


  const { options, parseTimezone } = useTimezoneSelect({});

  return (
    <select data-classes={editorFont + buttonBorder + 'p-5'} value={curVal[0]} onChange={e => onChange(parseTimezone(e.currentTarget.value))}>
      {options.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
};

const TimeDisplay = () => {
  const timeOnVeet = useStoreData('timeOnVeet');
  const timeZoneOffset = useConfigStoreData('timeZoneOffset');
  if (!timeOnVeet) {
    return <div data-classes={editorFont}>Unknown</div>;
  }
  const date = new Date(timeOnVeet * 1000); // expected in ms, not s
  const pcDate = new Date();
  const timeDiffMS = Math.abs(date.getTime() - pcDate.getTime());
  // Account for various delays in serial connection, processing, etc.
  // If it's more than 20 seconds off, something is wrong
  let syncStatus = <div data-classes='m-l-10 c-#0F0-fg'> - In Sync</div>;
  if (timeDiffMS > 20 * 1000) {
    syncStatus = <div data-classes='c-#F00-fg'>Out Of Sync</div>;
  }
  const dateString = date.toLocaleString(undefined, {timeZone: timeZoneOffset[0]});
  return <div data-classes={editorFont + ' d-f flxd-r'}>{dateString}{syncStatus}</div>;
};


export const ConfigEditor = () => {
  const configTemplate = useStoreData('configTemplate');
  const hasTemplate = configTemplate !== null && configTemplate?.length > 0;

  return (
    <div data-classes='flxg-1'>
      <Row>
        <Label>Researcher ID</Label>
        <TextEditor dataKey='researcherID' />
      </Row>
      <Row>
        <Label>Participant ID</Label>
        <TextEditor dataKey='participantID' />
      </Row>
      <Row>
        <Label>Time Zone Offset</Label>
        <TimezonePicker/>
      </Row>
      <Row>
        <Label/>
        <div>Note: Time zone setting does not change actual clock times. Clock times are in UTC.</div>
      </Row>
      <Row>
        <Label>Time on VEET</Label>
        <TimeDisplay/>
      </Row>
      <Row>
        <Label/>
        <div>Note: Time on VEET is auto-synchronized with this computer's clock</div>
      </Row>
      <hr data-classes='m-y-40'/>
      <Row>
        <Label>IMU Interval (ms)</Label>
        <NumberEditor dataKey='imuInterval' />
      </Row>
      <Row>
        <Label>PHO Interval (ms)</Label>
        <NumberEditor dataKey='phoInterval' />
      </Row>
      <Row>
        <Label>TOF Interval (ms)</Label>
        <NumberEditor dataKey='tofInterval' />
      </Row>
      <Row>
        <Label>ALS Interval (ms)</Label>
        <NumberEditor dataKey='alsInterval' />
      </Row>
      <div data-classes="d-f flxd-r m-t-30">
        <Button data-classes="m-x-10" onClick={window.bridgeApi.saveConfigTemplate}>Save To Template</Button>
        <Button data-classes="m-x-10" onClick={window.bridgeApi.loadConfigTemplate}>Load From Template</Button>
        <Button data-classes="m-x-10" onClick={window.bridgeApi.reuseLastConfigTemplate} disabled={!hasTemplate}>Reuse Last Template</Button>
      </div>
    </div>
  );
};
