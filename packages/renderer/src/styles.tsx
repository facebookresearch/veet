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

export const Row = (props: PropsWithChildren) => <div data-classes='d-f ai-c flxd-r p-y-8'>{props.children}</div>;
export const Label = (props: PropsWithChildren) => <div data-classes={'w-250 ' + labelFont}>{props.children}</div>;

export const subtleFontColor = ' c-#6b6b6b-fg ';
export const labelFont = ' c-#314C66-fg fs-18 fw-500 ';
export const editorFont = ' fs-18 c-#000-fg fw-400 ';
export const buttonBorder = ' br-4 b-1 c-#ccc-b p-6 ';
export const subHeadingFont = ' fy-i fs-12 ' + subtleFontColor;
