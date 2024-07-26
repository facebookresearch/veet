/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {vi} from 'vitest';

// TODO: Remove this workaround after unplugin-auto-expose will be fixed for ESM support
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: () => {},
  },
}));
