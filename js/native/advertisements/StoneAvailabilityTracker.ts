import { core } from "../../core";
import { DISABLE_TIMEOUT, FALLBACKS_ENABLED, KEEPALIVE_INTERVAL } from "../../ExternalConfig";
import { Scheduler } from "../../logic/Scheduler";
import { DfuStateHandler } from "../firmware/DfuStateHandler";
import { LOGi } from "../../logging/Log";

let RSSI_TIMEOUT = 5000;

const TRIGGER_ID = "StoneAvailabilityTracker"

class StoneAvailabilityTrackerClass {
  log = {};
  sphereLog = {}
  initialized = false;

  init() {
    if (this.initialized === false) {
      this.initialized = true;

      core.eventBus.on("iBeaconOfValidCrownstone",       (data) => { this._update(data, true); });
      core.eventBus.on("AdvertisementOfValidCrownstone", (data) => { this._update(data, false); });

      Scheduler.setRepeatingTrigger(TRIGGER_ID, {repeatEveryNSeconds: 4});
      Scheduler.loadCallback(TRIGGER_ID, this.notify.bind(this), false);
    }
  }

  notify() {
    let logStoneIds = Object.keys(this.log);
    let stoneIds = {};
    let sphereIds = {};
    let disabledSpheres = {};
    let now = new Date().valueOf();

    for (let i = 0; i < logStoneIds.length; i++) {
      let stoneId = logStoneIds[i];
      //rssi has expired and we have not marked it yet. do it now.
      if (now - this.log[stoneId].t > RSSI_TIMEOUT && this.log[stoneId].rssi !== -1000) {
        stoneIds[stoneId] = true;
        sphereIds[this.log[stoneId].sphereId] = true;
        this.log[stoneId].rssi = -1000;
      }
      // stone is active. Cast.
      if (now - this.log[stoneId].t < RSSI_TIMEOUT) {
        stoneIds[stoneId] = true;
        sphereIds[this.log[stoneId].sphereId] = true;
      }
      // stone has expired and we will remove it.
      if (now - this.log[stoneId].t > DISABLE_TIMEOUT) {
        stoneIds[stoneId] = true;
        sphereIds[this.log[stoneId].sphereId] = true;

        // these have expired. Delete them.
        disabledSpheres[this.log[stoneId].sphereId] = true;
        delete this.sphereLog[this.log[stoneId].sphereId][stoneId];
        delete this.log[stoneId];
      }
    }

    // cast if there is something to cast
    if (Object.keys(stoneIds).length > 0) {
      core.eventBus.emit("databaseChange", {change: {changeStoneState: {stoneIds, sphereIds}}}); // discover a new crownstone!
    }

    let disabledSphereIds = Object.keys(disabledSpheres);
    if (disabledSphereIds.length > 0) {
      disabledSphereIds.forEach((sphereId) => {
        this._evaluateDisabledState(sphereId);
      })
    }
  }

  _update(data, beacon) {
    if (this.sphereLog[data.sphereId] === undefined) {
      this.sphereLog[data.sphereId] = {};
    }

    if (this.log[data.stoneId] === undefined) {
      this.log[data.stoneId] = {t: null, beaconRssi: null, advRssi: null, sphereId: data.sphereId, avgRssi: data.rssi };
      // new Crownstone detected this run!
      let stoneIds = {};
      let sphereIds = {};
      stoneIds[data.stoneId] = true;
      sphereIds[data.sphereId] = true;
      core.eventBus.emit("databaseChange", {change: {changeStoneState: {stoneIds, sphereIds}}}); // discover a new crownstone!
      core.eventBus.emit("rssiChange", {stoneId: data.stoneId, sphereId: data.sphereId, rssi:data.rssi}); // Major change in RSSI
    }

    if (this.sphereLog[data.sphereId][data.stoneId] === undefined) {
      this.sphereLog[data.sphereId][data.stoneId] = {t: null, beaconRssi: null, advRssi: null };
    }

    let now = new Date().valueOf();
    this.sphereLog[data.sphereId][data.stoneId].t = now;
    this.log[data.stoneId].t = now;
    if (beacon) {
      this.log[data.stoneId].beaconRssi = data.rssi;
      this.sphereLog[data.sphereId][data.stoneId].beaconRssi = data.rssi;
    }
    else {
      this.log[data.stoneId].beaconRssi = data.rssi;
      this.sphereLog[data.sphereId][data.stoneId].beaconRssi = data.rssi;
    }


    if (beacon) {
      let prevRssi = this.log[data.stoneId].avgRssi;
      this.log[data.stoneId].avgRssi = 0.7*this.log[data.stoneId].avgRssi + 0.3*data.rssi;
      if (Math.abs(this.log[data.stoneId].avgRssi - prevRssi) > 8) {
        core.eventBus.emit("rssiChange", {stoneId: data.stoneId, sphereId: data.sphereId, rssi:data.rssi}); // Major change in RSSI
      }
    }
  }

  getNearestStoneId(reduxIdMap : map, inTheLastNSeconds : number = 2, rssiThreshold = -100) {
    let ids = Object.keys(reduxIdMap);
    let nearestRssi = -1000;
    let nearestId = null;

    let timeThreshold = new Date().valueOf() - 1000 * inTheLastNSeconds;
    for (let i = 0; i < ids.length; i++) {
      let item = this.log[ids[i]];
      if (item && item.t >= timeThreshold && item.rssi > nearestRssi && (rssiThreshold === null || item.rssi > rssiThreshold)) {
        nearestRssi = item.rssi;
        nearestId = ids[i]
      }
    }

    return nearestId;
  }

  getAvgRssi(stoneId) {
    if (this.log[stoneId]) {
      if (new Date().valueOf() - this.log[stoneId].t < RSSI_TIMEOUT) {
        return this.log[stoneId].avgRssi || -1000;
      }
    }
    return -1000;
  }

  getRssi(stoneId) {
    if (this.log[stoneId]) {
      if (new Date().valueOf() - this.log[stoneId].t < RSSI_TIMEOUT) {
        return this.log[stoneId].beaconRssi || -1000;
      }
    }
    return -1000;
  }

  isDisabled(stoneId) {
    if (this.log[stoneId]) {
      if (new Date().valueOf() - this.log[stoneId].t < DISABLE_TIMEOUT) {
        return false;
      }
    }
    return true;
  }


  _evaluateDisabledState(sphereId) {
    let state = core.store.getState();
    // check if there are any stones left that are not disabled.
    let stoneIds = Object.keys(state.spheres[sphereId].stones);
    let allDisabled = true;
    stoneIds.forEach((stoneId) => {
      if (StoneAvailabilityTracker.isDisabled(stoneId) === false) {
        allDisabled = false;
      }
    });
  }
}

export const StoneAvailabilityTracker = new StoneAvailabilityTrackerClass();