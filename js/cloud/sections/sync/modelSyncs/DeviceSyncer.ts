/**
 * Sync schedules in this stone.
 * @param actions
 * @param transferPromises
 * @param state
 * @param cloudSpheresData
 * @param sphere
 * @param stone_from_cloud
 * @param cloudScheduleIds
 * @param sphereInState
 */

import { Platform } from 'react-native'
import {Util} from "../../../../util/Util";
import {SyncingBase} from "./SyncingBase";
import {CLOUD} from "../../../cloudAPI";
import {LOG} from "../../../../logging/Log";
import {APP_NAME} from "../../../../ExternalConfig";
import { core } from "../../../../core";


interface matchingSpecs {
  id: string,
  address: string,
  deviceInCloud: any
}


export class DeviceSyncer extends SyncingBase {
  userId: string;


  download() {
    return CLOUD.forUser(this.userId).getDevices()
  }


  sync(state) {
    this.userId = state.user.userId;
    return this.download()
      .then((devicesInCloud) => {
        this._constructLocalIdMap();

        this.syncDown(state, state.devices, devicesInCloud);
        // this.syncUp(state, state.devices, devicesInCloud);

        return Promise.all(this.transferPromises);
      })
  }


  syncUp(state, devicesInState, devicesInCloud) {
    // cleanup. remove local devices that do not exist in the cloud.
    let cloudDeviceIdList = {};
    for (let i = 0; i < devicesInCloud.length; i++) {
      cloudDeviceIdList[devicesInCloud[i].id] = true;
    }

    let deviceIds = Object.keys(devicesInState);
    for (let i = 0; i < deviceIds.length; i++) {
      let device = devicesInState[deviceIds[i]];
      if (cloudDeviceIdList[device.cloudId] === undefined) {
        this.actions.push({type: 'REMOVE_DEVICE', deviceId: deviceIds[i]});
      }
    }
  }


  syncDown(state, devicesInState, devicesInCloud) {
    // get local device Info:
    let specs = Util.data.getDeviceSpecs(state);

    // find matching local device
    let matchingSpecs = this._findMatchingDeviceInCloud(specs, devicesInCloud);

    // device is not in the cloud!
    if (matchingSpecs.id === undefined) {
      this._createNewDeviceInCloud(specs, state);
    }
    else if (state.devices[matchingSpecs.id] === undefined) {
      // download device data and store locally.
      this._createNewDeviceLocally(state, specs, matchingSpecs);
      this.globalCloudIdMap.devices[matchingSpecs.id] = matchingSpecs.id;
    }
    else {
      // this
      this._updateLocalDevice(state, specs, devicesInState[matchingSpecs.id], matchingSpecs);
      this.globalCloudIdMap.devices[matchingSpecs.id] = matchingSpecs.id
    }


  }


  _createNewDeviceInCloud(specs, state) {
    let newDevice = null;
    LOG.info("Sync: Create new device in cloud", specs.name, specs.address, specs.description);
    let deviceInfo = {
      name:        specs.name,
      address:     specs.address,
      description: specs.description,
    };

    deviceInfo["deviceType"] =  specs.deviceType;
    deviceInfo["locale"]     =  specs.locale;

    if (state.user.uploadDeviceDetails) {
      deviceInfo["os"] =          specs.os;
      deviceInfo["userAgent"] =   specs.userAgent;
      deviceInfo["model"] =       specs.model;
    }

    this.transferPromises.push(
      CLOUD.createDevice(deviceInfo)
        .then((device) => {
          newDevice = device;
          return CLOUD.forDevice(device.id).createInstallation({
            deviceType: Platform.OS,
          })
        })
        .then((installation) => {
          this.actions.push({
            type: 'ADD_INSTALLATION',
            installationId: installation.id,
            data: {deviceToken: null}
          });

          this.actions.push({
            type: 'ADD_DEVICE',
            deviceId: newDevice.id,
            data: {
              name:        specs.name,
              address:     specs.address,
              description: specs.description,
              os:          specs.os,
              model:       specs.model,
              deviceType:  specs.deviceType,
              userAgent:   specs.userAgent,
              locale:      specs.locale,
              installationId: installation.id
            }
          });
          this.globalCloudIdMap.devices[newDevice.id] = newDevice.id;

          // We now push the location of ourselves to the cloud.
          this._updateUserLocationInCloud(state, newDevice.id);
        })
    );
  }

  _updateLocalDevice(state, specs, localDevice, matchingSpecs : matchingSpecs) {
    let installationId = this._getInstallationIdFromDevice(matchingSpecs.deviceInCloud.installations);

    // if the device is known under a different number in the cloud, we update our local identifier
    if (specs.address !== matchingSpecs.address) {
      this.actions.push({
        type: 'SET_APP_IDENTIFIER',
        data: {appIdentifier: matchingSpecs.address}
      });
    }

    // Old bug caused the local db to have a device address of null. This should fix that.
    if (localDevice.address !== matchingSpecs.address) {
      LOG.info("Sync: update address to", matchingSpecs.address);
      this.actions.push({
        type:"UPDATE_DEVICE_CONFIG",
        deviceId: matchingSpecs.id,
        data: {
          name:        specs.name,
          address:     matchingSpecs.address,
          description: specs.description,
          cloudId:     matchingSpecs.id,
          os:          specs.os,
          model:       specs.model,
          deviceType:  specs.deviceType,
          userAgent:   specs.userAgent,
          locale:      specs.locale,
        }
      });
    }

    // if the tap to toggle calibration is available and different from what we have stored, update it.
    if (matchingSpecs.deviceInCloud.tapToToggleCalibration && localDevice.tapToToggleCalibration === null) {
      this.actions.push({
        type: 'SET_TAP_TO_TOGGLE_CALIBRATION',
        deviceId: matchingSpecs.id,
        data: {
          tapToToggleCalibration: matchingSpecs.deviceInCloud.tapToToggleCalibration
        }
      })
    }

    // if our locale and deviceType is different or missing in the cloud, we restore it
    if (specs.locale !== matchingSpecs.deviceInCloud.locale || specs.deviceType !== matchingSpecs.deviceInCloud.deviceType) {
      LOG.info("Sync: Updating cloud device with deviceType and locale.");
      this.transferPromises.push(
        CLOUD.updateDevice(matchingSpecs.id, {
          locale: specs.locale,
          deviceType: specs.deviceType,
        })
      );
    }

    LOG.info("Sync: User device found in cloud, updating installation: ", installationId);
    this._verifyInstallation(state, matchingSpecs.id, installationId);
    this._updateUserLocationInCloud(state, matchingSpecs.id);
  }

  _createNewDeviceLocally(state, specs, matchingSpecs : matchingSpecs) {
    LOG.info("Sync: User device found in cloud, updating local.");
    let installationId = this._getInstallationIdFromDevice(matchingSpecs.deviceInCloud.installations);

    // add the device from the cloud to the redux database
    this.actions.push({
      type: 'ADD_DEVICE',
      deviceId: matchingSpecs.id,
      data: {
        name:         specs.name,
        address:      matchingSpecs.address,
        description:  specs.description,
        os:           specs.os,
        model:        specs.model,
        cloudId:      matchingSpecs.id,
        deviceType:   specs.deviceType,
        userAgent:    specs.userAgent,
        locale:       specs.locale,
        installationId: installationId,
        tapToToggleCalibration: matchingSpecs.deviceInCloud.tapToToggleCalibration,
      }
    });

    // update our unique identifier to match the new device.
    this.actions.push({
      type: 'SET_APP_IDENTIFIER',
      data: {appIdentifier: matchingSpecs.address}
    });

    this._verifyInstallation(state, matchingSpecs.id, installationId);
    // We now push the location of ourselves to the cloud.
    this._updateUserLocationInCloud(state, matchingSpecs.id);
  }


  _verifyInstallation(state, deviceId, installationId) {
    if (installationId) {
      this.transferPromises.push(CLOUD.getInstallation(installationId)
        .then((installation) => {
          this.actions.push({
            type: 'ADD_INSTALLATION',
            installationId: installation.id,
            data: {deviceToken: installation.deviceToken}
          });

          // check if we have to update this installation in the cloud.
          if (installation.developmentApp !== core.sessionMemory.developmentEnvironment) {
            return CLOUD.updateInstallation(installationId, {developmentApp: core.sessionMemory.developmentEnvironment}).catch(() => {})
          }
        }))
    }
    else if (deviceId && state && state.devices && state.devices[deviceId] && state.devices[deviceId].installationId === null) {
      this.transferPromises.push(
        CLOUD.forDevice(deviceId).createInstallation({ deviceType: Platform.OS, developmentApp: core.sessionMemory.developmentEnvironment })
          .then((installation) => {
            this.actions.push({
              type: 'ADD_INSTALLATION',
              installationId: installation.id,
              data: {deviceToken: null}
            });
            this.actions.push({
              type: 'UPDATE_DEVICE_CONFIG',
              deviceId: deviceId,
              data: {installationId: installation.id}
            });
          })
      );
    }
  }


  _getCloudLocationId(localId) {
    if (!localId) { return null; }
    return this.globalLocalIdMap.locations[localId];
  }


  _getCloudSphereId(localId) {
    if (!localId) { return null; }
    return this.globalLocalIdMap.spheres[localId];
  }


  _updateUserLocationInCloud(state, deviceId) {
    if (state.user.uploadLocation === true) {
      if (state.user.userId) {
        let userLocationMap = Util.data.getUserLocations(state, state.user.userId);
        let presentSphereIds = Object.keys(userLocationMap);

        if ( presentSphereIds.length === 0 ) {
          this.transferPromises.push(CLOUD.forDevice(deviceId).exitSphere("*").catch((err) => {}));
        }
        else {
          presentSphereIds.forEach((sphereId) => {
            let cloudSphereId = this._getCloudSphereId(sphereId);
            let cloudLocationId = this._getCloudLocationId(userLocationMap[sphereId]);

            if (cloudLocationId === null) {
              this.transferPromises.push( CLOUD.forDevice(deviceId).exitLocation(cloudSphereId,"*").catch((err) => {}) );
              this.transferPromises.push( CLOUD.forDevice(deviceId).inSphere( cloudSphereId).catch((err) => {}) );
            }
            else {
              this.transferPromises.push( CLOUD.forDevice(deviceId).inLocation(cloudSphereId, cloudLocationId).catch((err) => {}) );
            }
          });
        }
      }
    }
  };


  _findMatchingDeviceInCloud(localDeviceSpecs, devicesInCloud) : matchingSpecs {
    let deviceId = undefined;
    let address = localDeviceSpecs.address;
    let matchingDevice = undefined;
    for (let i = 0; i < devicesInCloud.length; i++) {
      let cloudDevice = devicesInCloud[i];
      if (cloudDevice.address === localDeviceSpecs.address) {
        deviceId = cloudDevice.id;
        matchingDevice = cloudDevice;
        break;
      }
      else if (cloudDevice.name === localDeviceSpecs.name && cloudDevice.description === localDeviceSpecs.description) {
        deviceId = cloudDevice.id;
        address = cloudDevice.address;
        matchingDevice = cloudDevice;
      }
      else if (cloudDevice.description === localDeviceSpecs.description) {
        deviceId = cloudDevice.id;
        address = cloudDevice.address;
        matchingDevice = cloudDevice;
      }
    }

    return { id: deviceId, address: address, deviceInCloud: matchingDevice };
  }


  _getInstallationIdFromDevice(installations) {
    if (installations && Array.isArray(installations) && installations.length > 0) {
      for (let i = 0; i < installations.length; i++) {
        if (installations[i].appName === APP_NAME) {
          return installations[i].id;
        }
      }
    }
    return null;
  }

}
