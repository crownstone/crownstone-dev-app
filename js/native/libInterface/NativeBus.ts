import { NativeModules, NativeEventEmitter } from 'react-native';
import { LOGe, LOGi } from '../../logging/Log'
import { DISABLE_NATIVE } from "../../ExternalConfig";
import { xUtil } from "../../util/StandAloneUtil";
import { Bluenet } from "./Bluenet";

let BluenetEmitter = { addListener: (a,b) => { return {remove:() => {}} }};

if (DISABLE_NATIVE !== true) {
  BluenetEmitter = new NativeEventEmitter(NativeModules.BluenetJS);
}

export class NativeBusClass {
  topics: any;
  refMap: any;

  _registeredEvents = {};

  subscribersForNearest = 0;
  subscribersForUnverified = 0;


  constructor() {
    this.topics = {
      setupAdvertisement:   "verifiedSetupAdvertisementData",   // data type = crownstoneAdvertisement
      dfuAdvertisement:     "verifiedDFUAdvertisementData",     // data type = crownstoneBaseAdvertisement
      advertisement:        "verifiedAdvertisementData",        // data type = crownstoneAdvertisement // Any verfied advertisement, only normal operation mode.
      crownstoneAdvertisementReceived: "crownstoneAdvertisementReceived",   // data type = string, this is only the handle. // Any advertisement, verified and unverified from crownstones.
      unverifiedAdvertisementData:     "unverifiedAdvertisementData",       // data type = crownstoneAdvertisement // Any unverified advertisement from crownstones.
      setupProgress:        "setupProgress",                    // data type = number ([1 .. 13], 0 for error) // Is 0 required? Or is rejecting the promise enough?
      dfuProgress:          "dfuProgress",                      // data type = {part: number, totalParts: number, progress: number, currentSpeedBytesPerSecond: number, avgSpeedBytesPerSecond: number}
      bleStatus:            "bleStatus",                        // data type = string ("unauthorized", "poweredOff", "poweredOn", "unknown")
      locationStatus:       "locationStatus",                   // data type = string ("unknown", "off", "foreground", "on", "noPermission")

      nearest:              "nearestCrownstone",                // data type = nearestStone // Any stone, validated or not, any operation mode.
      nearestSetup:         "nearestSetupCrownstone",           // data type = nearestStone

      iBeaconAdvertisement: "iBeaconAdvertisement",             // data type = ibeaconPackage[]
      enterSphere:          "enterSphere",                      // data type = string (sphereId)
      exitSphere:           "exitSphere",                       // data type = string (sphereId)
      enterRoom:            "enterLocation",                    // data type = {region: sphereId, location: locationId}
      exitRoom:             "exitLocation",                     // data type = {region: sphereId, location: locationId}
      currentRoom:          "currentLocation",                  // Sent every time the location is calculated. data type = {region: sphereId, location: locationId}

      libAlert:             "libAlert",                         // data type = {header: string, body: string, buttonText: string }
      libPopup:             "libPopup",                         // data type = {header: string, body: string, buttonText: string, type: <not used yet> }

      classifierProbabilities: "classifierProbabilities",       // data type = {locationId1: {sampleSize: number, probability: number }, locationId2: {sampleSize: number, probability: number }, ...}
      classifierResult:        "classifierResult",              // data type = {highestPredictionLabel: string, highestPrediction: number } // highestPredictionLabel == locationId with highest probability and highestPrediction is that probability

      callbackUrlInvoked:      "callbackUrlInvoked",            // data type = string (url)
    };

    this.refMap = {};
    Object.keys(this.topics).forEach((key) => {
      this.refMap[this.topics[key]] = true;
    });
  }

  on(topic, callback) {
    if (!(topic)) {
      LOGe.event("Attempting to subscribe to undefined topic:", topic);
      return;
    }
    if (!(callback)) {
      LOGe.event("Attempting to subscribe without callback to topic:", topic);
      return;
    }
    if (this.refMap[topic] === undefined) {
      LOGe.event("Attempting to subscribe to a topic that does not exist in the native bus.", topic);
      return;
    }

    // if required, enable topics we dont use often
    this._checkTopicAvailability(topic);

    // generate unique id
    let id = xUtil.getUUID();

    // subscribe to native event.
    let subscription = BluenetEmitter.addListener(topic, callback);

    let removeCallback = () => {
      if (this._registeredEvents[id]) {
        subscription.remove();

        // disable unused topics if possible.
        this._cleanupTopicAvailability(topic);

        this._registeredEvents[id] = undefined;
        delete this._registeredEvents[id];
      }
    };

    this._registeredEvents[id] = removeCallback;

    // return unsubscribe function.
    return removeCallback;
  }

  clearAllEvents() {
    LOGi.info("Clearing all native event listeners.");
    let keys = Object.keys(this._registeredEvents);
    keys.forEach((key) => {
      if (typeof this._registeredEvents[key] === 'function') {
        this._registeredEvents[key]();
      }
    });
  }


  _checkTopicAvailability(topic) {
    if (topic === this.topics.nearest || topic === this.topics.nearestSetup) {
      if (this.subscribersForNearest === 0) {
        Bluenet.subscribeToNearest();
      }
      this.subscribersForNearest++;
    }
    else if (topic === this.topics.crownstoneAdvertisementReceived || topic === this.topics.unverifiedAdvertisementData) {
      if (this.subscribersForUnverified === 0) {
        Bluenet.subscribeToUnverified();
      }
      this.subscribersForUnverified++;
    }
  }

  _cleanupTopicAvailability(topic) {
    if (topic === this.topics.nearest || topic === this.topics.nearestSetup) {
      if (this.subscribersForNearest > 0) {
        this.subscribersForNearest--;
      }

      if (this.subscribersForNearest === 0) {
        Bluenet.unsubscribeNearest();
      }
    }
    else if (topic === this.topics.crownstoneAdvertisementReceived || topic === this.topics.unverifiedAdvertisementData) {
      if (this.subscribersForUnverified > 0) {
        this.subscribersForUnverified--;
      }

      if (this.subscribersForUnverified === 0) {
        Bluenet.unsubscribeUnverified();
      }
    }
  }
}

export const NativeBus = new NativeBusClass();


/** type defs **/

//
// type type_beacon = {
//   id        : string,
//   uuid      : string,
//   major     : number,
//   minor     : number,
//   rssi      : number,
//   referenceId : string,
// }


/** end of type **/
