/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { list } from 'drivelist';
import type { DriveInfo, IDriveList, MountPoint } from './HardwareInterfaces';

/**
 * Production implementation of IDriveList that wraps the drivelist library.
 * This maintains backward compatibility while providing the abstraction layer
 * needed for dependency injection and testing.
 */
export class ProductionDriveList implements IDriveList {
    /**
     * List all available drives using the drivelist library.
     * @returns Promise that resolves to an array of drive information
     */
    async list(): Promise<DriveInfo[]> {
        const drives = await list();

        // Convert drivelist format to our interface format
        return drives.map(drive => ({
            device: drive.device,
            description: drive.description,
            size: drive.size,
            mountpoints: drive.mountpoints.map((mp): MountPoint => ({
                path: mp.path,
                label: mp.label ?? undefined,
            })),
            isUSB: drive.isUSB,
            isRemovable: drive.isRemovable,
        }));
    }
}
