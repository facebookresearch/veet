# Changelog

## 2.2.4 - 08/07/2025

### Firmware

* Increased spectral sensor sensitivity by doubling the sites sampled for all channels.
* Updated lux formula calculation based on ALS sensor profiling to improve accuracy for a wider range of light sources.
* Fixes a critical bug which resulted in data gaps in the Sensor_Data.csv file
* Detects ALS sensor saturation conditions and logs an error to the log.csv, but no longer logs the saturated data to Sensor_Data.csv

### VEET Manager

* Prompts to install Firmware 2.2.4 on compatible devices.
* VEETManager will now install an updated calibration file during firmware upgrade if the latest version is not already installed on the device.
* Enforces minimum VEET charge level of 20% before firmware updates to ensure successful completion.
* Reduces Time of Flight polling frequency to mitigate battery drain while previewing the sensor in VEETManager.

## 2.1.1 - 01/06/2025

* Improved device connecting speed, especially on MacOS
* Improved debug logging

## 2.1.0 - 12/03/2024

* Initial opening of repo.
