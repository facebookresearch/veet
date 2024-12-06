/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ErrorMessageHandler } from './constants';
import JSON5 from 'json5';

export function clamp(x:number, min:number, max:number):number {
  return Math.max(Math.min(x,max),min);
}

// p is from 0 - 1
export function lerp(a:number, b:number, p:number):number {
  return (b-a)*p + a;
}

// Returns fractional value of x from a to b
export function invLerp(a:number, b:number, x:number):number {
  return (x-a)/(b-a);
}

// Returns fractional value of x from a to b, clamped 0-1
export function invLerpClamped(a:number, b:number, x:number):number {
  return clamp(invLerp(a, b, x), 0, 1);
}

export function isRenderer () {
  if (typeof process === 'undefined' || !process) {
    return true;
  }

  return process.type === 'renderer';
}

// Only goes up to MB for now
export function humanReadableFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  } else {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
}


export const joinClasses = (...classes: Array<string[] | string | undefined>) => classes.filter(c => c).
  map(c => Array.isArray(c) ? c.join(' ') : c).join(' ');

export const parseJSON = (str: string, errorHandler?: ErrorMessageHandler) => {
  try {
    return JSON5.parse(str);
  } catch (e) {
    errorHandler?.(`Failed to parse config.json.\n${e}`, 'Config Error');
    return undefined;
  }
};
