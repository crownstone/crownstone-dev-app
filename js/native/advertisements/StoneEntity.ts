import { LOG_LEVEL }        from "../../logging/LogLevels";
import {LOGd, LOGi, LOGw} from "../../logging/Log";
import { DISABLE_TIMEOUT, FALLBACKS_ENABLED } from "../../ExternalConfig";
import { Util }             from "../../util/Util";
import { Scheduler }        from "../../logic/Scheduler";
import { StoneMeshTracker } from "./StoneMeshTracker";
import { StoneBehaviour }   from "./StoneBehaviour";
import { StoneStoreManager } from "./StoneStoreManager";
import { core } from "../../core";
import { xUtil } from "../../util/StandAloneUtil";

const UPDATE_CONFIG_FROM_ADVERTISEMENT     = 'UPDATE_CONFIG_FROM_ADVERTISEMENT';
const UPDATE_STATE_FROM_ADVERTISEMENT      = 'UPDATE_STATE_FROM_ADVERTISEMENT';
const UPDATE_STONE_TIME_LAST_SEEN          = 'UPDATE_STONE_TIME_LAST_SEEN';
const UPDATE_STONE_TIME_LAST_SEEN_VIA_MESH = 'UPDATE_STONE_TIME_LAST_SEEN_VIA_MESH';


export const conditionMap = {
  SWITCH_STATE: 'switchState',
};

interface condition {
  type: string,
  expectedValue: any
}

/**
 * This will control a stone. It will make sure advertisements will update its state and keep track of its position in the mesh.
 */
export class StoneEntity {
  subscriptions = [];

  stoneId;
  sphereId;
  store;
  storeManager : StoneStoreManager;
  meshTracker : StoneMeshTracker;
  behaviour : StoneBehaviour;

  lastKnownTimestamp = 0;
  lastKnownUniqueElement;
  disabledTimeout;
  clearRssiTimeout;

  ignoreTimeout = null;
  ignoreAdvertisements = false;
  ignoreConditions : condition[] = null;

  debugging = false;
  debugInterval = null;

  constructor(store, storeManager, sphereId, stoneId) {
    LOGi.native("StoneEntity: Creating entity for ", stoneId);
    this.store = store;
    this.storeManager = storeManager;
    this.sphereId = sphereId;
    this.stoneId = stoneId;

    this.behaviour   = new StoneBehaviour(  store, sphereId, stoneId);
    this.meshTracker = new StoneMeshTracker(store, sphereId, stoneId);

    this.subscribe();
    // core.eventBus.on("ADVERTISEMENT_DEBUGGING", (state) => {
    //   this._debug(state);
    // })
  }

  // _debug(state) {
  //   // this can be used to fill the database with fake advertisements
  //   if (state) {
  //     if (this.debugging === false) {
  //       this.debugging = true;
  //       this.debugInterval = setInterval(() => {
  //         let state = this.store.getState();
  //         let stone = state.spheres[this.sphereId].stones[this.stoneId];
  //
  //         let adv = generateFakeAdvertisement(this.sphereId, stone);
  //         this.handleDirectAdvertisement(stone, adv)
  //       }, 50);
  //     }
  //   }
  //   else {
  //     clearInterval(this.debugInterval)
  //   }
  // }




  _validate(state = undefined) {
    if (!state) {
      state = this.store.getState();
    }
    if (!state.spheres[this.sphereId])                      { return false; }
    if (!state.spheres[this.sphereId].stones[this.stoneId]) { return false; }

    return true;
  }


  subscribe() {
    // make sure we clear any pending advertisement package updates that are scheduled for this crownstone
    // This is to avoid the case where a state that was recorded pre-connection is shown post-connection
    // (ie. switch off instead of on)
    this.subscriptions.push(core.eventBus.on("connecting", (handle) => {
      let state = this.store.getState();
      let sphere = state.spheres[this.sphereId];
      let stone = sphere.stones[this.stoneId];

      if (stone.config.handle === handle) {
        this.storeManager.clearActions(this.stoneId);
      }
    }));

    // these timeouts are required for mesh propagation
    this.subscriptions.push(core.eventBus.on(Util.events.getIgnoreTopic(this.stoneId), (data) => {
      if (!data.timeoutMs) { return; }

      // clear any previous timeouts
      this._clearTimeout();

      // use conditions if we have them
      if (data.conditions) {
        this.ignoreConditions = data.conditions;
      }
      else {
        this.ignoreConditions = null;
      }

      // set the ignore flag
      this.ignoreAdvertisements = true;

      // clear any pending advertisementUpdates for this Crownstone.
      this.storeManager.clearActions(this.stoneId);

      // set the timoeut which will cancel the ignore
      this.ignoreTimeout = Scheduler.scheduleCallback(() => {
        this.ignoreTimeout = null;
        this._clearTimeout();
      }, data.timeoutMs, "ignore timeout for Crownstone " + this.stoneId );
    }));
  }


  destroy() {
    this.storeManager.clearActions(this.stoneId);
    this.subscriptions.forEach((unsubscribe) => { unsubscribe(); });
    this.behaviour.destroy();
    this.meshTracker.destroy();
  }


  ibeaconUpdate(ibeaconPackage : ibeaconPackage) {
    let state = this.store.getState();
    let sphere = state.spheres[this.sphereId];
    let stone = sphere.stones[this.stoneId];

    // handle the case of a failed DFU that requires a reset. If it boots in normal mode, we can not use it until the
    // reset is complete.
    if (stone.config.dfuResetRequired === true) {
      LOGd.advertisements("AdvertisementHandler: IGNORE: DFU reset is required for this Crownstone.");
      return;
    }

    // If the app has not yet seen this Crownstone, it could be that it does not have a handle.
    // Without handle we do not propagate the update events since we do not know what how to connect to it
    // if we only hear the ibeacon event.
    if (stone.config.handle) {
      this._emitUpdateEvents(stone, ibeaconPackage.rssi);
    }
    else {
      LOGd.advertisements("StoneStateHandler: IGNORE iBeacon message: store has no handle.");
    }

    this._handleBehaviour(state, stone, ibeaconPackage.rssi);
  }


  _emitUpdateEvents(stone, rssi) {
    // These events are used in the Batch Command Handler
    core.eventBus.emit(Util.events.getCrownstoneTopic(this.sphereId, this.stoneId), {
      handle: stone.config.handle,
      stone: stone,
      stoneId: this.stoneId,
      sphereId: this.sphereId,
      rssi: rssi,
    });

    if (stone.config.meshNetworkId) {
      core.eventBus.emit(Util.events.getMeshTopic(this.sphereId, stone.config.meshNetworkId), {
        handle: stone.config.handle,
        stoneId: this.stoneId,
        stone: stone,
        sphereId: this.sphereId,
        meshNetworkId: stone.config.meshNetworkId,
        rssi: rssi,
      });
    }
  }


  _updateExternalRssiIndicator(stoneId, stone, externalId, externalStone, rssi ) {
    if (stone.mesh[externalId] && stone.mesh[externalId].rssi === rssi) {
      // this is the same value as before, ignore
      return;
    }

    // invalid measurement
    if (rssi > 0) { return; }

    const BAD_CONNECTION = -150;

    if (rssi === 0) {
      // One of the Crownstones says there is no connection. We check if the other one says there IS one, if not, we delete the links
      if (externalStone.mesh[stoneId]) {
        // the external stone thinks its connected to this stone
        if (externalStone.mesh[stoneId].rssi === BAD_CONNECTION) {
          // the connection from the external stone is bad, as is this one. Clear them both.
          let actions = [];
          actions.push({
            type: 'REMOVE_MESH_LINK',
            sphereId: this.sphereId,
            stoneId: this.stoneId,
            nodeId: externalId,
            __logLevel: LOG_LEVEL.verbose, // this command only lets this log skip the LOG.store unless LOG_VERBOSE is on.
          });
          actions.push({
            type: 'REMOVE_MESH_LINK',
            sphereId: this.sphereId,
            stoneId: externalId,
            nodeId: this.stoneId,
            __logLevel: LOG_LEVEL.verbose, // this command only lets this log skip the LOG.store unless LOG_VERBOSE is on.
          });
          this.store.batchDispatch(actions);
        }
        else {
          // the connection from the external stone is OK, this one is bad. Store it as a bad connection
          this.store.dispatch({
            type: 'SET_MESH_INDICATOR',
            sphereId: this.sphereId,
            stoneId: this.stoneId,
            nodeId: externalId,
            data: {rssi: BAD_CONNECTION},
            __logLevel: LOG_LEVEL.verbose, // this command only lets this log skip the LOG.store unless LOG_VERBOSE is on.
          });
        }
      }
      else if (stone.mesh[externalId]) {
        // the crownstone currently has a link in the store

        // its already bad, clean it up.
        if (stone.mesh[externalId].rssi === BAD_CONNECTION) {
          this.store.dispatch({
            type: 'REMOVE_MESH_LINK',
            sphereId: this.sphereId,
            stoneId: this.stoneId,
            nodeId: externalId,
            __logLevel: LOG_LEVEL.verbose, // this command only lets this log skip the LOG.store unless LOG_VERBOSE is on.
          })
        }
        else {
          // there is an existing link which is not bad, what do we do here?
          this.store.dispatch({
            type: 'SET_MESH_INDICATOR',
            sphereId: this.sphereId,
            stoneId: this.stoneId,
            nodeId: externalId,
            data: {rssi: BAD_CONNECTION},
            __logLevel: LOG_LEVEL.verbose, // this command only lets this log skip the LOG.store unless LOG_VERBOSE is on.
          });
        }
      }
      else {
        // the external stone is not connected to this stone, nor is this stone connected to the external one.
        // this means we do not have to do anything.
      }
    }
    else {
      this.store.dispatch({
        type: 'SET_MESH_INDICATOR',
        sphereId: this.sphereId,
        stoneId: this.stoneId,
        nodeId: externalId,
        data: {rssi: rssi},
        __logLevel: LOG_LEVEL.verbose, // this command only lets this log skip the LOG.store unless LOG_VERBOSE is on.
      });
    }
  }


  /**
   * This stone entity has sent an advertisement containing the state of ANOTHER crownstone. Handle this.
   * @param stoneId
   * @param stoneId
   * @param externalId
   * @param externalStone
   * @param stoneId
   * @param externalId
   * @param externalStone
   * @param stone
   * @param externalId
   * @param externalStone
   * @param {crownstoneAdvertisement} advertisement
   */
  handleAdvertisementOfExternalCrownstone(stoneId: string, stone, externalId: string, externalStone, advertisement : crownstoneAdvertisement) {
    this._updateStoneLastSeen(stone);

    // if this crownstone was disabled, change this since we saw it directly
    this._updateExternalRssiIndicator(stoneId, stone, externalId, externalStone, advertisement.serviceData.rssiOfExternalCrownstone);

    /// tell the rest of the app this stone was seen, and its meshnetwork was heard from.
    this._emitUpdateEvents(stone, advertisement.rssi); // emit
  }


  /**
   * This stone entity has sent an advertisement containing it's own state. Handle this.
   * @param stone
   * @param {crownstoneAdvertisement} advertisement
   */
  handleDirectAdvertisement(stone, advertisement : crownstoneAdvertisement) {
    this._updateStoneLastSeen(stone);


    // update the state entity
    this._handleAdvertisementContent(stone, advertisement);

    // tell the rest of the app this stone was seen, and its meshnetwork was heard from.
    this._emitUpdateEvents(stone, advertisement.rssi); // emit
  }


  /**
   * This stones service data was advertised by another crownstone
   * @param stone
   * @param {crownstoneAdvertisement} advertisement
   */
  handleContentViaMesh(stone, advertisement : crownstoneAdvertisement) {
    core.eventBus.emit(Util.events.getViaMeshTopic(this.sphereId, stone.config.meshNetworkId), {
      id: this.stoneId,
      serviceData: advertisement.serviceData
    });

    // update the state entity
    this._handleAdvertisementContent(stone, advertisement);
  }

  _handleBehaviour(state, stone, rssi) {
    // update the behaviour controller.
    this.behaviour.update(state, stone, rssi);
  }


  /**
   * Handle the data in the serviceData of the advertisement. This data belongs to this entity
   * @param stone
   * @param {crownstoneAdvertisement} advertisement
   * @private
   */
  _handleAdvertisementContent(stone, advertisement : crownstoneAdvertisement) {
    // these timestamps are in seconds.
    let dtWithLastDataPoint = advertisement.serviceData.timestamp - this.lastKnownTimestamp;
    if (advertisement.serviceData.timestamp !== -1 && dtWithLastDataPoint <= 0 && Math.abs(dtWithLastDataPoint) < 2000) { // the ABS is to make sure an incorrect overflow correction will not block advertisements for hours.
      LOGd.advertisements("StoneEntity: IGNORE: we already know a newer state.");
      return;
    }
    else if (this.lastKnownUniqueElement === advertisement.serviceData.uniqueElement) { // this is a fallback for before 2.0.0 firmware. The lastKnownUniqueElement is not perse a timestamp.
      LOGd.advertisements("StoneEntity: IGNORE: already seen this message.");
      return;
    }

    // ensure we do not re-use old data
    this.lastKnownUniqueElement = advertisement.serviceData.uniqueElement;
    this.lastKnownTimestamp     = advertisement.serviceData.timestamp;

    if (this.ignoreAdvertisements === true) {
      let allowData = this._checkForClearConditions(stone, advertisement);
      LOGd.advertisements('StoneEntity: IGNORE: ignore timeout is set for this Crownstone.');
      if (!allowData) {
        return;
      }
    }

    // handle the case of a failed DFU that requires a reset. If it boots in normal mode, we can not use it until the
    // reset is complete.
    if (stone.config.dfuResetRequired === true) {
      LOGd.advertisements('StoneEntity: IGNORE: DFU reset is required for this Crownstone.');
      return;
    }

    this.handleConfig(stone, advertisement);

    this.handleTransientConfig(stone, advertisement);

    this.handleErrors(stone, advertisement);

    if (!advertisement.serviceData.errorMode) {
      this.handleState(stone, advertisement);
    }

  }


  /**
   * This function will check if the ignore conditions are validated and the dataflow can be resumed.
   * @param stone
   * @param {crownstoneAdvertisement} advertisement
   * @returns {boolean}
   * @private
   */
  _checkForClearConditions(stone, advertisement : crownstoneAdvertisement) {
    if (this.ignoreConditions) {
      let result = true;
      if (Array.isArray(this.ignoreConditions)) {
        for (let i = 0; i < this.ignoreConditions.length; i++) {
          let condition : condition = this.ignoreConditions[i];

          if (condition.type === conditionMap.SWITCH_STATE) {
            let switchState = Math.min(1,advertisement.serviceData[condition.type] / 100);
            if (switchState !== condition.expectedValue) {
              result = false;
              break;
            }
          }
          else {
            if (advertisement.serviceData[condition.type] !== condition.expectedValue) {
              result = false;
              break;
            }
          }
        }

        // clean up timeout
        if (result === true) {
          core.eventBus.emit(Util.events.getIgnoreConditionFulfilledTopic(this.stoneId));
          LOGi.advertisements("StoneEntity: Conditions met for cancellation of advertisement ignore.");
          this._clearTimeout();
        }

        return result;
      }
      else {
        LOGw.advertisements("StoneEntity: ILLEGAL IGNORECONDITION. EXPETED ARRAY");
      }
    }

    return false;
  }

  _clearTimeout() {
    this.ignoreConditions = null;
    this.ignoreAdvertisements = false;
    if (typeof this.ignoreTimeout === 'function') {
      this.ignoreTimeout();
      this.ignoreTimeout = null;
    }
  }


  /**
   * This will take any configuration from the Crownstone that we don't currently have up to date in the app and update it
   * These are only transient values that are not worth it to send them to the cloud
   * This goes for:
   *  DimmingAvailable
   * @param stone
   * @param {crownstoneAdvertisement} advertisement
   */
  handleTransientConfig(stone, advertisement : crownstoneAdvertisement) {
    let changeData : any = {};
    let changed = false;
    if (stone.config.dimmingAvailable !== advertisement.serviceData.dimmingAvailable) {
      changed = true;
      changeData.dimmingAvailable = advertisement.serviceData.dimmingAvailable;
    }

    if (changed) {
      this.storeManager.loadAction(this.stoneId, UPDATE_CONFIG_FROM_ADVERTISEMENT, {
        type: 'UPDATE_STONE_CONFIG_TRANSIENT',
        sphereId: this.sphereId,
        stoneId: this.stoneId,
        data: changeData,
        updatedAt: new Date().valueOf(),
      });
    }

  }
  /**
   * This will take any configuration from the Crownstone that we don't currently have up to date in the app and update it
   * This goes for:
   *  Locked
   *  DimmingAvailable
   *  DimmingAllowed
   * @param stone
   * @param {crownstoneAdvertisement} advertisement
   */
  handleConfig(stone, advertisement : crownstoneAdvertisement) {
    let changeData : any = {};
    let changed = false;
    let transient = false; // transient does not store data in the cloud and optionally persists it. It is used for momentary changes to the DB

    if (stone.config.dimmingAvailable !== advertisement.serviceData.dimmingAvailable) {
      changed = true;
      transient = true;
      changeData.dimmingAvailable = advertisement.serviceData.dimmingAvailable;
    }
    if (stone.config.locked !== advertisement.serviceData.switchLocked) {
      changed = true;
      transient = false;
      changeData.locked = advertisement.serviceData.switchLocked;
    }
    if (stone.config.dimmingEnabled !== advertisement.serviceData.dimmingAllowed) {
      changed = true;
      transient = false;
      changeData.dimmingEnabled = advertisement.serviceData.dimmingAllowed;
    }
    if (stone.config.switchCraft !== advertisement.serviceData.switchCraftEnabled) {
      changed = true;
      transient = false;
      changeData.switchCraft = advertisement.serviceData.switchCraftEnabled;
    }

    if (stone.state.timeSet !== advertisement.serviceData.timeSet) {
      this.store.dispatch({
        type: 'UPDATE_STONE_TIME_STATE',
        sphereId: this.sphereId,
        stoneId: this.stoneId,
        data: {
          timeSet: advertisement.serviceData.timeSet
        }
      })
    }


    if (changed) {
      this.storeManager.loadAction(this.stoneId, UPDATE_CONFIG_FROM_ADVERTISEMENT, {
        type: transient ? 'UPDATE_STONE_CONFIG_TRANSIENT' : 'UPDATE_STONE_CONFIG',
        sphereId: this.sphereId,
        stoneId: this.stoneId,
        data: changeData,
        updatedAt: new Date().valueOf(),
      });
    }
  }


  _errorsHaveChanged(stoneErrors, advertisementErrors : errorData) {
    if (stoneErrors.hasError === false) {
      return true;
    }
    if (
      stoneErrors.overCurrent       !== advertisementErrors.overCurrent       ||
      stoneErrors.overCurrentDimmer !== advertisementErrors.overCurrentDimmer ||
      stoneErrors.temperatureChip   !== advertisementErrors.temperatureChip   ||
      stoneErrors.temperatureDimmer !== advertisementErrors.temperatureDimmer ||
      stoneErrors.dimmerOnFailure   !== advertisementErrors.dimmerOnFailure   ||
      stoneErrors.dimmerOffFailure  !== advertisementErrors.dimmerOffFailure
    ) {
      return true;
    }

    return false;
  }

  handleErrors(stone, advertisement : crownstoneAdvertisement) {
    if (xUtil.versions.canIUse(stone.config.firmwareVersion, '2.0.0')) {
      if (advertisement.serviceData.hasError === true) {
        LOGi.advertisements("StoneEntity: GOT ERROR", advertisement.serviceData);
        if (advertisement.serviceData.errorMode) {
          // only mark as error is it is not already marked as error
          if (stone.errors.hasError === false) {
            this.store.dispatch({
              type: 'UPDATE_STONE_ERRORS',
              sphereId: this.sphereId,
              stoneId: this.stoneId,
              data: { hasError: true }
            });
          }

          // store errors in the db
          if (this._errorsHaveChanged(stone.errors, advertisement.serviceData.errors)) {
            this.store.dispatch({
              type: 'UPDATE_STONE_ERRORS',
              sphereId: this.sphereId,
              stoneId: this.stoneId,
              data: {
                overCurrent:       advertisement.serviceData.errors.overCurrent,
                overCurrentDimmer: advertisement.serviceData.errors.overCurrentDimmer,
                temperatureChip:   advertisement.serviceData.errors.temperatureChip,
                temperatureDimmer: advertisement.serviceData.errors.temperatureDimmer,
                dimmerOnFailure:   advertisement.serviceData.errors.dimmerOnFailure,
                dimmerOffFailure:  advertisement.serviceData.errors.dimmerOffFailure,
              }
            });
          }
        }
      }
      else if (stone.errors.hasError === true) {
        LOGi.advertisements("StoneEntity: GOT NO ERROR WHERE THERE WAS AN ERROR BEFORE", advertisement.serviceData);
        this.store.dispatch({
          type:     'CLEAR_STONE_ERRORS',
          sphereId: this.sphereId,
          stoneId:  this.stoneId,
        });
      }
    }
  }


  handleState(stone, advertisement : crownstoneAdvertisement) {
    let serviceData = advertisement.serviceData;
    let measuredUsage = Math.floor(serviceData.powerUsageReal);
    let powerFactor = serviceData.powerFactor;

    let currentTime = new Date().valueOf();

    let switchState = Math.min(1,serviceData.switchState / 100);

    // small aesthetic fix: force no measurement when its supposed to be off.
    if (switchState === 0 && measuredUsage !== 0) {
      measuredUsage = 0;
    }

    // hide negative measurements from the user
    if (measuredUsage < 0) {
      measuredUsage = 0;
    }

    // do not feed duplicates
    if (stone.state.state === switchState && stone.state.currentUsage === measuredUsage) {
      return;
    }

    this.storeManager.loadAction(this.stoneId, UPDATE_STATE_FROM_ADVERTISEMENT, {
      type: 'UPDATE_STONE_STATE',
      sphereId: this.sphereId,
      stoneId: this.stoneId,
      data: {
        state: switchState,
        currentUsage: measuredUsage,
        powerFactor: powerFactor,
        applianceId: stone.config.applianceId,
      },
      updatedAt: currentTime,
      __logLevel: LOG_LEVEL.verbose, // this command only lets this log skip the LOG.store unless LOG_VERBOSE is on.
    });

  }


  /**
   * Util method to avoid code duplication
   * @private
   */
  _updateStoneLastSeen(stone) {
    let now = new Date().valueOf();
    // only update if the difference is more than 3 seconds.
    if (now - stone.reachability.lastSeen > 3000) {
      this.storeManager.loadAction(this.stoneId, UPDATE_STONE_TIME_LAST_SEEN, {
        type: 'UPDATE_STONE_REACHABILITY',
        sphereId: this.sphereId,
        stoneId: this.stoneId,
        data: {
          lastSeen: new Date().valueOf(),
        },
        __logLevel: LOG_LEVEL.verbose, // this command only lets this log skip the LOG.store unless LOG_VERBOSE is on.
      });
    }
  }
}