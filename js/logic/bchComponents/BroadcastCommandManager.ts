import { Platform, AppState } from 'react-native'
import { BluenetPromiseWrapper } from "../../native/libInterface/BluenetPromise";
import { xUtil } from "../../util/StandAloneUtil";
import { core } from "../../core";
import { LOGi } from "../../logging/Log";
import { MINIMUM_FIRMWARE_VERSION_BROADCAST } from "../../ExternalConfig";

export const BROADCAST_ERRORS = {
  CANNOT_BROADCAST:     { message: "CANNOT_BROADCAST",     fatal: false},
  BROADCAST_INCOMPLETE: { message: "BROADCAST_INCOMPLETE", fatal: false},
  BROADCAST_FAILED:     { message: "BROADCAST_FAILED",     fatal: false},
};

class BroadcastCommandManagerClass {
  commandsToBroadcast = {
    multiSwitch: true
  };

  broadcast(commandSummary : commandSummary) : Promise<bchReturnType> {
    // double check here, this api should be able to be used
    if (this.canBroadcast(commandSummary)) {
      switch (commandSummary.command.commandName) {
        case "multiSwitch":
          return this._broadCastMultiSwitch(commandSummary);
        default:
          return Promise.reject(BROADCAST_ERRORS.CANNOT_BROADCAST);
      }
    }
    else {
      return Promise.reject(BROADCAST_ERRORS.CANNOT_BROADCAST);
    }
  }

  _broadCastMultiSwitch(commandSummary) : Promise<bchReturnType> {
    LOGi.broadcast("Switching via broadcast");
    // TODO: Remove hack for advertisements.
    return new Promise((resolve, reject) => {
      let result : bchReturnType = {data:null};
      setTimeout(() => { resolve(result); }, 100);
      BluenetPromiseWrapper.broadcastSwitch(commandSummary.sphereId, commandSummary.stone.config.crownstoneId, commandSummary.command.state)
        .then(() => {
          LOGi.broadcast("Success broadcast", commandSummary.command.state);
          return { data: null }
        })
        .catch((err) => {
          LOGi.broadcast("ERROR broadcast", commandSummary.command.state);
          throw err
        })
        .catch((err) => {
          LOGi.broadcast("Swallow broadcast error", err);
        })
    })



  }

  canBroadcast(commandSummary : commandSummary) {
    let state = core.store.getState();
    if (!commandSummary.stone.config.firmwareVersion) {
      return false;
    }

    if (xUtil.versions.isLower(commandSummary.stone.config.firmwareVersion, MINIMUM_FIRMWARE_VERSION_BROADCAST)) {
      if (state.development.broadcasting_enabled === true) {
        // bypass
      }
      else {
        return false
      }
    }

    // check if this is a valid command
    if (!(commandSummary && commandSummary.command && commandSummary.command.commandName)) {
      return false;
    }


    if ((Platform.OS === 'ios' && AppState.currentState === 'active') || Platform.OS === 'android') {
      // allow broadcast attempt for whitelisted commands
      if (this.commandsToBroadcast[commandSummary.command.commandName] === true) {
        return true
      }
    }
    return false;
  }
}


export const BroadcastCommandManager = new BroadcastCommandManagerClass();