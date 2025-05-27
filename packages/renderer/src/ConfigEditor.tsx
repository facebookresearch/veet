/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { ITimezoneOption } from 'react-timezone-select';
import { useTimezoneSelect } from 'react-timezone-select';
import { useStoreData } from '../../shared/DataStore';
import type { ConfigStore } from '../../shared/ConfigStore';
import { useConfigStoreData } from '../../shared/ConfigStore';
import { editorFont, Row, Label, buttonBorder } from './styles';
import { Button } from './Button';

const MIN_VALUE = 0;


const IntervalEditor = ({
  dataKey,
}: {
  dataKey: Exclude<keyof ConfigStore, 'timeZoneOffset'>,
}) => {
  const curRealVal = useConfigStoreData(dataKey) as number;
  const curVal = Math.max(MIN_VALUE, Math.round(curRealVal / 1000));
  const isValidValue = (curRealVal === curVal * 1000);
  const [tempVal, setTempVal] = useState(curVal);
  const textInput = useRef<HTMLInputElement>(null);

  // Since the change can come from outside, we need to check if we are currently focused before updating
  const isFocussed = textInput && (textInput.current === document.activeElement);
  if (!isFocussed && curVal != tempVal) {
    setTempVal(curVal);
  }

  const onChange = (event: { target: { value: string; }; }) => {
    setTempVal(parseInt(event.target.value));

    // The value set in the store might not match since the config store will enforce legal values
    // Once the input is blurred they will match again.
    window.bridgeApi.sendConfigStoreValue(dataKey, (parseInt(event.target.value) || 0) * 1000);
  };

  const onBlur = () => {
    setTempVal(curVal);
  };

  const onKeyDown = (event: { key: string; }) => {
    if (event.key === 'Enter') {
      textInput && textInput.current && textInput.current.blur();
    }
  };

  let asterisk = null;
  if (!isValidValue) {
    asterisk = <div data-classes='m-l-10'>* Current Actual Value: {curRealVal} ms</div>;
  }

  return <div data-classes='d-f flxd-r ai-c'><input
    data-classes={editorFont + buttonBorder + 'w-70'}
    type='number'
    ref={textInput}
    value={tempVal}
    onChange={onChange}
    onBlur={onBlur}
    onKeyDown={onKeyDown}
    step={1}
    min={MIN_VALUE}
  />{asterisk}</div>;
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
  const curVal: string = useConfigStoreData('timeZoneName');
  const onChange = (timeZone: ITimezoneOption) => {
    const newVal: [string, number] = [timeZone.value, timeZone.offset || 0];
    window.bridgeApi.sendConfigStoreValue('timeZoneOffset', newVal[1]);
    window.bridgeApi.sendConfigStoreValue('timeZoneName', newVal[0]);
  };


  const { options, parseTimezone } = useTimezoneSelect({});

  return (
    <select data-classes={editorFont + buttonBorder + 'p-5 w-264'} value={curVal} onChange={e => onChange(parseTimezone(e.currentTarget.value))}>
      {options.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
};

const TimeDisplay = () => {
  // Once a second, update the time
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);


  // Use the time offset from the veet to calculate the time on the veet
  const timeOffset = useStoreData('veetTimeOffset');
  const timeZoneName = useConfigStoreData('timeZoneName');
  if (timeOffset === null) {
    return <div data-classes={editorFont}>Unknown</div>;
  }

  // Also display if the veet is in sync or not
  let syncStatus = <div data-classes='m-l-10 c-#0F0-fg'> - In Sync</div>;
  if (Math.abs(timeOffset) > 5) {
    syncStatus = <div data-classes='c-#F00-fg'>Out Of Sync</div>;
  }

  const timeOnVeet = time.getTime() + timeOffset * 1000; // expected in ms, not s

  const date = new Date(timeOnVeet); // expected in ms, not s
  const dateString = date.toLocaleString(undefined, { timeZone: timeZoneName });

  return <div data-classes={editorFont + ' d-f flxd-r'}>{dateString}{syncStatus}</div>;
};


export const ConfigEditor = () => {
  const configTemplate = useStoreData('configTemplate');
  const hasTemplate = configTemplate !== null && configTemplate?.length > 0;
  const driveConnected = Boolean(useStoreData('drivePath'));

  let overlay: ReactNode = '';
  if (!driveConnected) {
    overlay = <div data-classes='c-#CCCCCCCC-bg fullSize pos-a' />;
  }

  return (
    <div data-classes='flxg-1 flxd-c d-f'>
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
        <TimezonePicker />
      </Row>
      <Row>
        <Label />
        <div data-classes="flxg-1">Note: Time zone setting does not change actual clock times. Clock times are in UTC.</div>
      </Row>
      <Row>
        <Label>Time on VEET</Label>
        <TimeDisplay />
      </Row>
      <Row>
        <Label />
        <div data-classes="flxg-1">Note: Time on VEET is auto-synchronized with this computer's clock, and in UTC in the data.</div>
      </Row>
      <hr data-classes='m-y-40' />
      <Row>
        <Label>IMU Interval (seconds)</Label>
        <IntervalEditor dataKey='imuInterval' />
      </Row>
      <Row>
        <Label>PHO Interval (seconds)</Label>
        <IntervalEditor dataKey='phoInterval' />
      </Row>
      <Row>
        <Label>TOF Interval (seconds)</Label>
        <IntervalEditor dataKey='tofInterval' />
      </Row>
      <Row>
        <Label>ALS Interval (seconds)</Label>
        <IntervalEditor dataKey='alsInterval' />
      </Row>
      <div data-classes="d-f flxd-r m-t-30">
        <Button data-classes="m-x-10" onClick={window.bridgeApi.saveConfigTemplate}>Save To Template</Button>
        <Button data-classes="m-x-10" onClick={window.bridgeApi.loadConfigTemplate}>Load From Template</Button>
        <Button data-classes="m-x-10" onClick={window.bridgeApi.reuseLastConfigTemplate} disabled={!hasTemplate}>Reuse Last Template</Button>
      </div>
      {overlay}
    </div>
  );
};
