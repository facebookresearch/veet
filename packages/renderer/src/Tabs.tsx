/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import type { PropsWithChildren } from 'react';
import React, { createElement } from 'react';
import type { TAB_TYPE } from '../../shared/constants';
import { useSettingsStoreData } from '../../shared/SettingsStore';

// This is what the user uses to describe and encapsulate a tab panel
type TabProps = {
  label: TAB_TYPE;
  hidden?: boolean;
  startGroup?: boolean;
};

export const Tab = (props:PropsWithChildren<TabProps>) => {
  return (
    <div data-classes='d-f h-40 ai-c'>
      {props.label}
      {props.children}
    </div>
  );
};

// This is generated from the tab label, and is the actual 'tab' you can click on to activate the tab
type TabLabelProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
}
const TabLabel = (props: TabLabelProps) => {
  const bgColor = props.isActive ? '#f5f5f5' : '#a9a9a9';
  const fgColor = props.isActive ? '#000' : '#0006';
  return (
    <div data-classes={`c-${bgColor}-bg c-${fgColor}-fg c-#0003-b fs-16 p-x-10 p-y-6 m-x-3 br-t-10 b-1 b-b-0 m-b--1 z-1`} onClick={props.onClick}>{props.label.toUpperCase()}</div>
  );
};

const TabSeparator = () => {
  return <div data-classes='d-f flxg-1'/>;
};


// This is the encapsulating component for the set of tabs
type TabCollectionProps = {
  children:  React.ReactElement<PropsWithChildren<TabProps>>[]; // we require at least two children of type Tab
}
export const TabCollection = (props:TabCollectionProps) => {
  const activeTab = useSettingsStoreData('currentTab');

  // First, create tabs
  const tabArray = [];
  let panel = null;
  for (const child of props.children) {
    const label = child.props.label;
    const isActive = label == activeTab;
    if (child.props.startGroup === true) {
      tabArray.push(createElement(TabSeparator, {key: label + '-separator'}));
    }
    if (child.props.hidden === true) {
      continue;
    }
    tabArray.push(createElement(TabLabel, {
      label: label,
      isActive: isActive,
      key: label,
      onClick: () => window.bridgeApi.setCurrentTab(label),
    }));

    // If this is the active tab, pull the tab's children into the panel
    if (isActive) {
      panel = child.props.children;
    }
  }
  return (
    <div data-classes='d-f flxg-1 flxd-c o-h'>
      <div data-classes='d-f flxd-r c-#ddd-bg p-x-30'>
        {tabArray}
      </div>
      <div data-classes='d-f flxg-1 p-30 p-t-50 b-0 b-t-1 c-#0003-b o-a pos-r'>{panel}</div>
    </div>
  );
};
