/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { dialog } from 'electron';
import { getDataStore, setDatastoreValue } from '../../shared/DataStore';
import { logger } from '../../shared/Logger';
import fs from 'fs-extra';

export class StreamRecorder {
  private stream_: NodeJS.WritableStream|null = null;
  constructor(private browserWindow_: Electron.BrowserWindow) {}

  public async StartRecording(): Promise<void> {
    const saveConfigInfo = await dialog.showSaveDialog(this.browserWindow_, {
      title: 'Record Data Stream',
      buttonLabel: 'Record Data Stream',
      filters: [{name: 'All Files', extensions: ['csv']}],
    });
    if (saveConfigInfo.canceled) {
      return;
    }

    try {
      this.stream_ = fs.createWriteStream(saveConfigInfo.filePath);
    } catch (e) {
      logger.error('StreamRecorder: Failed to create write stream');
      return;
    }
    setDatastoreValue('recordingStream', true);
  }

  public StopRecording(): void {
    this.stream_?.end();
    this.stream_ = null;
    setDatastoreValue('recordingStream', false);
  }

  public ToggleRecording() {
    if (getDataStore().recordingStream) {
      this.StopRecording();
    } else {
      void this.StartRecording();
    }
  }

  public WriteIfRecording(data: string): void {
    if (getDataStore().recordingStream) {
      if (!this.stream_) {
        logger.error('StreamRecorder: Recording stream is null');
        this.StopRecording();
        return;
      }
      this.stream_?.write(data + '\n');
    }
  }
}
