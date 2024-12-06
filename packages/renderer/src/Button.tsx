/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { joinClasses } from '../../shared/utils';

export type ButtonType = 'primary' | 'secondary' | 'critical';

type ButtonProps = React.PropsWithChildren<{
  type?: ButtonType;
  'data-classes'?: string;
  onClick: () => void;
  disabled?: boolean;
}>;

const defaultClasses = [
  'b-0',
  'p-y-7',
  'p-x-12',
  'c-#acacac-bg',
  'br-4',
];


export const Button = (props: ButtonProps) => {
  const { onClick, disabled} = props;

  const dynamicClasses = [];

  if (disabled) {
    dynamicClasses.push('op-0.35');
  }

  return <button
    className="vscodeFont"
    data-classes={joinClasses(defaultClasses, dynamicClasses, props['data-classes'])}
    disabled={disabled}
    onClick={onClick}
  >{props.children}</button>;
};
