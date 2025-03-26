/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {z} from 'zod';

export const calibrationFileSchema = z.object({
  calib_fw_version: z.string(),
  calib_version: z.string(),
  calib_timestamp: z.string(),
  deviceID: z.string(),
  PHO: z.object({
    F415: z.object({gain: z.number(), off: z.number()}),
    F445: z.object({gain: z.number(), off: z.number()}),
    F480: z.object({gain: z.number(), off: z.number()}),
    F515: z.object({gain: z.number(), off: z.number()}),
    F555: z.object({gain: z.number(), off: z.number()}),
    F590: z.object({gain: z.number(), off: z.number()}),
    F630: z.object({gain: z.number(), off: z.number()}),
    F680: z.object({gain: z.number(), off: z.number()}),
    F910: z.object({gain: z.number(), off: z.number()}),
    Fclear: z.object({gain: z.number(), off: z.number()}),
  }),
  ALS: z.object({
    Fuv: z.object({gain: z.number(), off: z.number()}),
    Fpho: z.object({gain: z.number(), off: z.number()}),
    Fir: z.object({gain: z.number(), off: z.number()}),
  }),
  LUX: z.object({
    IR_PHO_REGION: z.tuple([z.number(), z.number(), z.number()]),
    PHO_COEFF: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    IR_COEFF: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    DGF: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  }),
  UVI: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

export const calibrationDBSchema = z.object({
  creation_timestamp: z.string(),
  calibrations: z.record(z.string(), calibrationFileSchema),
});

export type CalibrationDB = z.infer<typeof calibrationDBSchema>;
