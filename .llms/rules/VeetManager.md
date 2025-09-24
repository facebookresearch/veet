---
oncalls: [xred_swes]
---

# VEET Manager - Project Overview

## Introduction

VEET Manager is an Electron desktop application that serves as the interface for managing and communicating with VEET (Visual Environment Evaluation Tool) devices. The VEET device is a pair of temple arm form-factor wearable sensors that collect visual environment data continuously for research purposes. The devices gather data from multiple sensors including Time of Flight sensors, Ambient Light sensors, Spectral sensors, and Inertial Measurement Units without using cameras or image sensors to maintain privacy.

The VEET Manager software enables researchers to:

- Connect to VEET devices via USB serial communication
- Configure device settings and parameters
- Download and visualize sensor data
- Manage device firmware and calibration
- Monitor device status, battery levels, and storage

Each VEET device presents both a serial port interface for command communication and a mass storage device for data access. The software sends ASCII commands over the serial port and reads/writes data files from the mounted mass storage to manage the device.

## Project Architecture

### Electron Application Structure

The project follows a typical Electron multi-process architecture with three main components:

- **Main Process** (`packages/main/`): Node.js backend that handles device communication, file system operations, and window management
- **Renderer Process** (`packages/renderer/`): React-based frontend UI that displays data and provides user interaction
- **Preload Script** (`packages/preload/`): Security bridge that exposes specific APIs from main process to renderer

### Build System

- **Framework**: Electron v31.2.0 with TypeScript
- **Bundler**: Vite for fast development and building
- **UI Library**: React 18 with custom styling using quark-styles
- **Packaging**: electron-builder for creating distributable packages
- **Package Manager**: Yarn v1.18.0
- **Testing**: Vitest for unit tests, Playwright for E2E tests

### Main Process Structure (`packages/main/src/`)

Key components of the main process:

- **`index.ts`**: Application entry point, window lifecycle management, auto-updater
- **`MainWindow.ts`**: Window creation and management
- **`SerialManager.ts`**: USB serial communication with VEET devices (115200 baud, CR line endings)
- **`CalibManager.ts`**: Device calibration data management
- **`StreamRecorder.ts`**: Real-time sensor data recording
- **`VersionManager.ts`**: Firmware version and update management
- **`Menu.ts`**: Application menu configuration

### Renderer Process Structure (`packages/renderer/src/`)

The UI is organized as a tabbed interface with components for:

- **`App.tsx`**: Main application component with tab navigation
- **`ConnectionStatus.tsx`**: Device connection status display
- **`ConfigEditor.tsx`**: Device configuration interface
- **`Download.tsx`**: Data download and file management
- **Visualizer Components**: Real-time sensor data visualization
  - `TOFVisualizer.tsx`: Time of Flight sensor visualization with 3D canvas
  - `PHOVisualizer.tsx`: Spectral sensor data display
  - `IMUVisualizer.tsx`: Inertial measurement unit data
  - `ALSVisualizer.tsx`: Ambient light sensor data
- **`SerialLog.tsx`**: Serial communication logging (developer feature)
- **`BatteryDisplay.tsx`**: Device battery status
- **`DiskUsage.tsx`**: Device storage monitoring

### Inter-Process Communication

Communication between main and renderer processes uses Electron's IPC system through a type-safe context bridge API defined in `packages/shared/ContextBridgeApi.ts`:

**Renderer → Main Process**:

- `runCommand(cmd: string)`: Send ASCII commands to VEET device
- `requestStoresUpdate()`: Request data store refresh
- `showFolder(path: string)`: Open file system folders
- `setCurrentTab(tabName)`: Update active UI tab
- `toggleRecording()`: Start/stop sensor data recording

**Main → Renderer Process**:

- `updateDataStore()`: Push device state updates
- `updateConfigStore()`: Push configuration changes
- `updateSettingsStore()`: Push application settings

### Shared Code (`packages/shared/`)

Common utilities and type definitions:

- **`DataStore.ts`**: Central state management with React hooks
- **`ConfigStore.ts`**: Device configuration management
- **`SettingsStore.ts`**: Application settings
- **`commands.ts`**: VEET device command definitions
- **`constants.ts`**: Application constants and sensor parameters
- **`Logger.ts`**: Winston-based logging system
- **`utils.ts`**: Common utility functions

### Device Communication Protocol

- **Connection**: USB serial communication (Vendor ID: 04d8, Product ID: 0001)
- **Baud Rate**: 115200 (hardware controlled)
- **Command Format**: ASCII commands terminated with carriage return (`\r`)
- **Response Format**: ASCII responses terminated with EOT (0x04)
- **Timeout**: 1 second per command
- **Queue**: Single concurrent command with async queue management

### Data Management

The application manages several types of data:

- **Sensor Data**: CSV files stored on device mass storage (`Sensor_Data.csv`)
- **Configuration**: JSON configuration files (`.config/config.json`)
- **Calibration**: Device calibration data (`.config/calib.json`, `calibrationDB.json`)
- **Firmware**: Device firmware binaries and manifests
- **Logs**: Application and serial communication logs

### UI Architecture

- **Styling**: Custom CSS-in-JS using quark-styles with data-classes attributes
- **State Management**: React hooks with global immutable data stores
- **Visualization**: 3D TOF sensor visualization using Babylon.js, 2D charts using Recharts
- **Layout**: Tabbed interface with responsive design
- **Themes**: Dark theme optimized for research environments

### Build and Distribution

- **Development**: `yarn watch` for hot-reload development
- **Building**: `yarn build` creates production Vite bundles + electron-builder packaging
- **Platforms**: Windows (NSIS installer), macOS (Universal DMG)
- **Code Signing**: Configured for macOS with entitlements for hardware access
- **Auto-Updates**: electron-updater integration for seamless updates
- **Commit Titles**: Preface commit messages with `[veet]`

### Key Dependencies

- **Device Communication**: serialport, drivelist, diskusage
- **UI Framework**: React, react-dom, react-select, react-tooltip
- **Visualization**: @babylonjs/core, recharts
- **Utilities**: fs-extra, md5-file, winston, zod, async-await-queue
- **Styling**: quark-styles, color

This architecture enables reliable, real-time communication with VEET research devices while providing an intuitive interface for researchers to configure, monitor, and extract data from their wearable sensor systems.
