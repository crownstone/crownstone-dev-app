import { BEHAVIOUR_TYPE_TO_INTENT, INTENTS } from '../native/libInterface/Constants';
import { BatchCommandHandler } from '../logic/BatchCommandHandler';
import {LOG, LOGe} from '../logging/Log';
import { Util } from './Util';
import { BEHAVIOUR_TYPES } from "../Enums";
import { xUtil } from "./StandAloneUtil";
const SunCalc = require('suncalc');

export const BehaviourUtil = {

  performCommandCheck: function(state, behaviourType) {
    if (state.app.indoorLocalizationEnabled === false) {
      return false;
    }

    // keepAlives are required for roomExit. Home Exit is only done by keepAlives and should never go through this code.
    if ((state.app.keepAlivesEnabled === false && behaviourType === BEHAVIOUR_TYPES.ROOM_EXIT) || behaviourType === BEHAVIOUR_TYPES.HOME_EXIT) {
      return false;
    }

    return true;
  },

  /**
   * Trigger the behaviour for all crownstones in a certain location
   * @param { Object } store            // redux store
   * @param { String } sphereId         // ID of sphere
   * @param { String } behaviourType    // type of behaviour to be used in the logging and switching intent
   * @param { String } locationId       // ID of location to get the stones from
   * @param { Object } callbacks        // hooks for the enacting of the behaviour.
   *                                        {
   *                                          onCancelled: function(sphereId, stoneId),               // triggered if the behaviour is not used
   *                                          onTrigger: function(sphereId, stoneId),                 // triggered when the behaviour is executed
   *                                          onSchedule: function(sphereId, stoneId, abortSchedule)  // triggered if the behaviour is scheduled
   *                                        }
   */
  enactBehaviourInLocation: function(store, sphereId, locationId, behaviourType, callbacks = {}) {
    // turn on crownstones in room
    let state = store.getState();

    // Check if the behaviour should be performed, given the app settings
    if (this.performCommandCheck(state, behaviourType) === false) {
      return;
    }

    let sphere = state.spheres[sphereId];
    let stoneIds = Object.keys(sphere.stones);

    stoneIds.forEach((stoneId) => {
      // for each stone in sphere select the behaviour we want to copy into the keep Alive
      let stone = sphere.stones[stoneId];
      if (stone.config.locationId !== locationId)
        return;

      this._enactBehaviour(store, sphereId, stoneId, behaviourType, callbacks);
    });

    BatchCommandHandler.execute();
  },


  /**
   * Trigger the behaviour for all crownstones in a sphere
   * @param { Object } store            // redux store
   * @param { String } sphereId         // ID of sphere to get the stones from
   * @param { String } behaviourType    // type of behaviour to be used in the logging and switching intent
   * @param { Object } callbacks        // hooks for the enacting of the behaviour.
   *                                        {
   *                                          onCancelled: function(sphereId, stoneId),               // triggered if the behaviour is not used
   *                                          onTrigger: function(sphereId, stoneId),                 // triggered when the behaviour is executed
   *                                          onSchedule: function(sphereId, stoneId, abortSchedule)  // triggered if the behaviour is scheduled
   *                                        }

   */
  enactBehaviourInSphere: function(store : any, sphereId : string, behaviourType : string, callbacks : any = {}) {
    let state = store.getState();

    // Check if the behaviour should be performed, given the app settings
    if (this.performCommandCheck(state, behaviourType) === false) {
      return;
    }

    let sphere = state.spheres[sphereId];
    let stoneIds = Object.keys(sphere.stones);

    stoneIds.forEach((stoneId) => {
      this._enactBehaviour(store, sphereId, stoneId, behaviourType, callbacks = {})
    });

    BatchCommandHandler.execute();
  },


  /**
   * Trigger behaviour for a certain stone in a sphere
   * @param { Object } store            // redux store
   * @param { String } sphereId         // ID of sphere
   * @param { String } behaviourType    // type of behaviour to be used in the logging and switching intent
   * @param { String } stoneId          // ID of stone
   * @param { Object } callbacks        // hooks for the enacting of the behaviour.
   *                                        {
   *                                          onCancelled: function(sphereId, stoneId),               // triggered if the behaviour is not used
   *                                          onTrigger: function(sphereId, stoneId),                 // triggered when the behaviour is executed
   *                                          onSchedule: function(sphereId, stoneId, abortSchedule)  // triggered if the behaviour is scheduled
   *                                        }
   */
  enactBehaviour: function(store, sphereId, stoneId, behaviourType, callbacks = {}) {
    // Check if the behaviour should be performed, given the app settings
    if (this.performCommandCheck(store.getState(), behaviourType) === false) {
      return;
    }

    this._enactBehaviour(store, sphereId, stoneId, behaviourType, callbacks);
    BatchCommandHandler.execute();
  },

  /**
   * Trigger behaviour for a certain stone in a sphere, this internal method does not execute by itself!
   * @param { Object } store            // redux store
   * @param { String } sphereId         // ID of sphere
   * @param { String } behaviourType    // type of behaviour to be used in the logging and switching intent
   * @param { String } stoneId          // ID of stone
   * @param { Object } callbacks        // hooks for the enacting of the behaviour.
   *                                        {
   *                                          onCancelled: function(sphereId, stoneId),               // triggered if the behaviour is not used
   *                                          onTrigger: function(sphereId, stoneId),                 // triggered when the behaviour is executed
   *                                          onSchedule: function(sphereId, stoneId, abortSchedule)  // triggered if the behaviour is scheduled
   *                                        }
   */
  _enactBehaviour: function(store, sphereId, stoneId, behaviourType, callbacks = {}) {
    let state = store.getState();

    // Check if the behaviour should be performed, given the app settings
    if (this.performCommandCheck(state, behaviourType) === false) {
      return;
    }

    let sphere = state.spheres[sphereId];
    let stone = sphere.stones[stoneId];
    let element = Util.data.getElement(store, sphereId, stoneId, stone);
    let behaviour = element.behaviour[behaviourType];

    this._enactBehaviourCore(store, sphere, sphereId, behaviour, behaviourType, stone, stoneId, element, callbacks);
  },


  /**
   * Trigger the behaviour for a certain stone in a sphere. This method is where the actual triggering is done.
   *
   *
   * @param { Object } store            // redux store
   * @param { Object } sphere           // specific sphere from the state of the store
   * @param { String } sphereId         // ID of sphere
   * @param { Object } behaviour        // behaviour object from element object
   * @param { String } behaviourType    // type of behaviour to be used in the logging and switching intent
   * @param { Object } stone            // stone object from sphere
   * @param { String } stoneId          // ID of stone
   * @param { Object } element          // the appliance or element, depending on if the stone has an appliance. This is used for behaviour
   * @param { Object } callbacks        // hooks for the enacting of the behaviour.
   *                                        {
   *                                          onCancelled: function(sphereId, stoneId),               // triggered if the behaviour is not used
   *                                          onTrigger: function(sphereId, stoneId),                 // triggered when the behaviour is executed
   *                                          onSchedule: function(sphereId, stoneId, abortSchedule)  // triggered if the behaviour is scheduled
   *                                        }
   */
  _enactBehaviourCore: function(store, sphere, sphereId, behaviour, behaviourType, stone, stoneId, element, callbacks : any = {}) {
    // Check if the behaviour should be performed, given the app settings
    if (this.performCommandCheck(store.getState(), behaviourType) === false) {
      return;
    }

    // we set the state regardless of the current state since it may not be correct in the background.
    if (behaviour.active && stone.config.handle) {
      // setup the trigger method.

      LOG.info("ENACT BEHAVIOUR", sphereId, behaviour, behaviourType, this.allowBehaviourBasedOnDarkOutside(sphere, behaviour, element));

      // if the device is supposed to go on and it is only allowed to go on when it's dark, check if its dark.
      if (this.allowBehaviourBasedOnDarkOutside(sphere, behaviour, element) === false) {
        if (callbacks && callbacks.onCancelled && typeof callbacks.onCancelled === 'function') {
          callbacks.onCancelled(sphereId, stoneId);
        }
        return;
      }

      if (callbacks && callbacks.onTrigger && typeof callbacks.onTrigger === 'function') {
        callbacks.onTrigger(sphereId, stoneId);
      }

      // if we need to switch, configure the data to update the store with.
      let data = {state: behaviour.state};
      if (behaviour.state === 0) {
        data['currentUsage'] = 0;
      }

      BatchCommandHandler.load(
        stone,
        stoneId,
        sphereId,
        {
          commandName:'multiSwitch',
          state: behaviour.state,
          intent:INTENTS[BEHAVIOUR_TYPE_TO_INTENT[behaviourType]],
          timeout:behaviour.delay},
        {},
        15,
        'from _enactBehaviourCore in BehaviourUtil'
      )
        .then(() => {
          store.dispatch({
            type: 'UPDATE_STONE_SWITCH_STATE',
            sphereId: sphereId,
            stoneId: stoneId,
            data: data
          });
        })
        .catch((err) => {
          LOGe.info("BehaviourUtil: Could not fire", behaviourType, ' due to ', err);
        });
    }
    else {
      if (callbacks && callbacks.onCancelled && typeof callbacks.onCancelled === 'function') {
        callbacks.onCancelled(sphereId, stoneId);
      }
    }
  },


  /**
   * Check if you need to switch this device based on the time of sunrise and sunset
   * @param sphere
   * @param behaviour
   * @param element
   * @returns {boolean}
   */
  allowBehaviourBasedOnDarkOutside: function(sphere, behaviour, element) {
    // if the device is supposed to go on and it is only allowed to go on when it's dark, check if its dark.
    if (behaviour.state > 0 && element.config.onlyOnWhenDark === true) {
      let now = new Date().valueOf();
      // the time in our rotterdam office
      let times = this.getEveningTimes(sphere);

      // if it is light outside and the onlyOnWhenDark is on, we have to return false.
      // it is light outside between the end of the sunrise and the start of the sunset.
      return (now < times.morning || now > times.evening); // = is dark outside
    }
    return true;
  },

  getEveningTimes: function(sphere) {
    if (!(sphere && sphere.state)) {
      sphere = {state:{}};
    }

    // the time in our rotterdam office
    let latitude = sphere.state.latitude || 51.923611570463152;
    let longitude = sphere.state.longitude || 4.4667693378575288;
    let allTimes = SunCalc.getTimes(new Date(), latitude, longitude);
    let times = {
      morning: 0.5*(allTimes.sunrise.valueOf() + allTimes.dawn.valueOf()),
      evening: 0.5*(allTimes.dusk.valueOf()    + allTimes.sunsetStart.valueOf()),
    };
    return {
      morning: times.morning,
      evening: times.evening,
      morningReadable: xUtil.getTimeFormat(times.morning),
      eveningReadable: xUtil.getTimeFormat(times.evening),
    };
  }
};