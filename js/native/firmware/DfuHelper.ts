import { BlePromiseManager }     from '../../logic/BlePromiseManager'
import { BluenetPromiseWrapper}  from '../libInterface/BluenetPromise';
import {LOG, LOGd, LOGe, LOGi} from '../../logging/Log'
import { SetupStateHandler } from "../setup/SetupStateHandler";
import { core } from "../../core";
import { StoneUtil } from "../../util/StoneUtil";
import { delay } from "../../util/Util";

export class DfuHelper {
  handle : any;
  sphereId : string;
  stoneId : string;

  abortedDFU = false;

  // Ensure the provided cloudhelper has already gotten information and downloaded the bootloader/fw.
  constructor(sphereId, stoneId, stone?) {
    stone = stone ? stone : StoneUtil.getStoneObject(sphereId, stoneId);
    this.handle = stone.config.handle;
    this.sphereId = sphereId;
    this.stoneId = stoneId;
  }

  putInDFU(crownstoneMode: crownstoneModes) {
    if (crownstoneMode.dfuMode === true) {
      LOGi.info("DfuHelper: putInDFU: already in DFU mode!", crownstoneMode);
      return Promise.resolve();
    }

    let setupPromise = () => {
      return this._putInDFU(crownstoneMode.setupMode);
    };

    // we load the DFU into the promise manager with priority so we are not interrupted
    return BlePromiseManager.registerPriority(setupPromise, {from: 'DFU: setting in dfu mode: ' + this.handle});
  }

  _putInDFU(stoneIsInSetupMode : boolean) {
    return new Promise((resolve, reject) => {
      BluenetPromiseWrapper.connect(this.handle, this.sphereId)
        .then(() => {
          LOG.info("DfuHelper: DFU progress: Connected.");
          if (stoneIsInSetupMode) {
            return BluenetPromiseWrapper.setupPutInDFU();
          }
          else {
            return BluenetPromiseWrapper.putInDFU();
          }
        })
        .then(() => {
          LOG.info("DfuHelper: DFU progress: Placed in DFU mode.");
          if (stoneIsInSetupMode) {
            return BluenetPromiseWrapper.phoneDisconnect();
          }
          else {
            return BluenetPromiseWrapper.disconnectCommand();
          }
        })
        .then(() => { return delay(3000); })
        .then(() => { resolve(); })
        .catch((err) => {
          LOGe.info("DfuHelper: Error during putInDFU.", err);
          BluenetPromiseWrapper.phoneDisconnect().catch(() => {});
          reject(err);
        })
    })
  }

  restartInAppMode() {
    let action = () => {
      LOG.info("DfuHelper: performing bootloaderToNormalMode.");
      return BluenetPromiseWrapper.bootloaderToNormalMode( this.handle ).then(() => { return delay(1000); });
    };
    return BlePromiseManager.registerPriority(action, {from: 'DFU: bootloaderToNormalMode' + this.handle});
  }

  updateBootloader(crownstoneMode: crownstoneModes, bootloaderPath, progressCallback) {
    let action = () => {
      let unsubscribe = core.nativeBus.on(core.nativeBus.topics.dfuProgress, (data) => {
        LOGd.info("DfuHelper: DFU event:", data);
        progressCallback(data.progress*0.01);
      });
      console.log("HERE", crownstoneMode)

      let updateProcess = () => {
        LOG.info("DfuHelper: performing bootloader update.");
        return BluenetPromiseWrapper.performDFU(this.handle, bootloaderPath)
          .then(() => { return delay(1500); })
          .then(() => { unsubscribe(); })
          .catch((err) => {
            unsubscribe();
            BluenetPromiseWrapper.phoneDisconnect();
            throw err;
          })
      };

      if (crownstoneMode.dfuMode === false) {
        return this._putInDFU(crownstoneMode.setupMode)
          .then(() => { return updateProcess(); })
      }
      else {
        return updateProcess();
      }
    };
    // we load the DFU into the promise manager with priority so we are not interrupted
    LOG.info("DfuHelper: Scheduling bootloader update in promise manager for handle:", this.handle);
    return BlePromiseManager.registerPriority(action, {from: 'DFU: updating Bootloader ' + this.handle}, 300000); // 5 min timeout
  }

  updateFirmware(crownstoneMode: crownstoneModes, firmwarePath, progressCallback) {
    let action = () => {
      let updateProcess = () => {
        let unsubscribe = core.nativeBus.on(core.nativeBus.topics.dfuProgress, (data) => {
          LOGd.info("DfuHelper: DFU event:", data);
          progressCallback(data.progress*0.01);
        });

        return BluenetPromiseWrapper.performDFU(this.handle, firmwarePath)
          .then(() => { return delay(1500); })
          .then(() => { unsubscribe(); })
          .catch((err) => {
            unsubscribe();
            BluenetPromiseWrapper.phoneDisconnect();
            throw err;
          })
      };

      if (crownstoneMode.dfuMode === false) {
        return this._putInDFU(crownstoneMode.setupMode)
          .then(() => { return updateProcess(); })
      }
      else {
        return updateProcess()
      }
    };
    // we load the DFU into the promise manager with priority so we are not interrupted
    return BlePromiseManager.registerPriority(action, {from: 'DFU: updating firmware ' + this.handle}, 300000); // 5 min timeout
  }


  setup(crownstoneMode: crownstoneModes, progressCallback) : Promise<void> {
    if (crownstoneMode.dfuMode === true) {
      return new Promise((resolve, reject) => {
        LOGe.info("DfuHelper: Cannot perform setup in DFU mode!");
        reject("Cannot perform setup in DFU mode!");
      });
    }
    else {
      if (!crownstoneMode.setupMode) {
        return Promise.resolve();
      }

      let unsubscribe = core.nativeBus.on(core.nativeBus.topics.setupProgress, (progress) => {
        LOGd.info("DfuHelper: Setup event:", progress);
        progressCallback(progress/13);
      });

      // the setupStateHandler already uses the PromiseManager so we cant do it here. It would lead to dfu waiting on setup waiting on dfu.
      return SetupStateHandler.setupExistingStone(this.handle, this.sphereId, this.stoneId, true)
        .catch((err) => {
          if (this.abortedDFU) { throw err; }
          // try again
          progressCallback(0);
          return SetupStateHandler.setupExistingStone(this.handle, this.sphereId, this.stoneId, true)
        })
        .then(() => {
          unsubscribe();
          LOG.info("DfuHelper: DFU progress: Setup complete.");
        })
        .catch((err) => {
          unsubscribe();
          throw err;
        })
    }
  }
}


