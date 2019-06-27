import { Languages } from "../Languages";

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("AppUtil", key)(a, b, c, d, e);
}

import { Alert, Platform }       from 'react-native';
import { StoreManager }          from '../router/store/storeManager'
import { Bluenet }               from '../native/libInterface/Bluenet';
import {CLOUD} from "../cloud/cloudAPI";
import {Scheduler} from "../logic/Scheduler";
import { core } from "../core";
import { Util } from "./Util";
import { NavigationUtil } from "./NavigationUtil";
import { Stacks } from "../router/Stacks";
import { BluenetPromiseWrapper } from "../native/libInterface/BluenetPromise";
import { LOG, LOGe, LOGi } from "../logging/Log";
const RNFS    = require('react-native-fs');
import { FileUtil } from "./FileUtil";

export const AppUtil = {
  quit: function() {
    Bluenet.quitApp();
  },

  resetBle: function() {
    if (Platform.OS === 'android') {
      Bluenet.resetBle();
    }
  },

  resetDatabase(store, eventBus) {
    core.eventBus.emit("showLoading", lang("Preparing_for_download___"));
    let clearDB = () => {
      core.eventBus.clearMostEvents();
      core.nativeBus.clearAllEvents();
      Scheduler.reset();

      core.eventBus.emit("showLoading", lang("Clearing_database___"));

      store.dispatch({type:"USER_LOGGED_OUT_CLEAR_STORE", __purelyLocal: true, __noEvents: true});
      core.eventBus.emit("showLoading", lang("Getting_new_data___"));
      CLOUD.__syncTriggerDatabaseEvents = false;
      CLOUD.sync(store)
        .then(() => {
          core.eventBus.emit("showLoading", lang("Finalizing___"));
          return new Promise((resolve, reject) => {
            setTimeout(() => { core.eventBus.emit("showLoading", lang("App_will_close_in___secon",5)); }, 1000);
            setTimeout(() => { core.eventBus.emit("showLoading", lang("App_will_close_in___secon",4)); }, 2000);
            setTimeout(() => { core.eventBus.emit("showLoading", lang("App_will_close_in___secon",3)); }, 3000);
            setTimeout(() => { core.eventBus.emit("showLoading", lang("App_will_close_in___secon",2)); }, 4000);
            setTimeout(() => { core.eventBus.emit("showLoading", lang("App_will_close_in___secon",1)); }, 5000);
            setTimeout(() => { Bluenet.quitApp(); resolve(true); }, 6000)
          })
        })
        .catch((err) => {
          core.eventBus.emit("showLoading", "Falling back to full clean...");
          return StoreManager.destroyActiveUser()
        })
        .then((success) => {
          if (!success) {
            setTimeout(() => { core.eventBus.emit("showLoading", lang("App_will_close_in___secon",5)); }, 1000);
            setTimeout(() => { core.eventBus.emit("showLoading", lang("App_will_close_in___secon",4)); }, 2000);
            setTimeout(() => { core.eventBus.emit("showLoading", lang("App_will_close_in___secon",3)); }, 3000);
            setTimeout(() => { core.eventBus.emit("showLoading", lang("App_will_close_in___secon",2)); }, 4000);
            setTimeout(() => { core.eventBus.emit("showLoading", lang("App_will_close_in___secon",1)); }, 5000);
            setTimeout(() => { Bluenet.quitApp(); }, 6000)
          }
        })
        .catch((err) => {
          Alert.alert(lang("Data_reset_failed___"), lang("Something_went_wrong_in_t"),[{text: lang("OK")}])
        })
    };

    if (CLOUD.__currentlySyncing) {
      let unsub = core.eventBus.on('CloudSyncComplete', () => {
        setTimeout(() => { unsub(); clearDB(); }, 200);
      })
    }
    else {
      clearDB();
    }
  },


  logOut: function(store, message = null) {
    if (message) {
      Alert.alert(message.title, message.body, [{text:'OK', onPress:() => {
          AppUtil._logOut(store, () => {Bluenet.quitApp();});
        }}], { cancelable: false });
    }
    else {
      let gracefulExit = () => {
        setTimeout(() => {
          Bluenet.quitApp();
        }, 3500);
      };

      AppUtil._logOut(store, gracefulExit);
    }
  },

  _logOut: function(store, gracefulExit) {
    core.eventBus.emit("showLoading", {text:lang("Logging_out_and_closing_a"), opacity:0.25});

    // clear position for this device.
    let state = store.getState();
    let deviceId = Util.data.getCurrentDeviceId(state);
    NavigationUtil.setRoot(Stacks.logout());

    // clear all events listeners, should fix a lot of redraw issues which will crash at logout
    core.eventBus.clearAllEvents();
    core.nativeBus.clearAllEvents();


    // sign out of all spheres.
    let sphereIds = Object.keys(state.spheres);
    sphereIds.forEach((sphereId) => {
      store.dispatch({type: 'SET_SPHERE_STATE', sphereId: sphereId, data: {reachable: false, present: false}});
    });

    StoreManager.destroyActiveUser();
    store.dispatch({type:"USER_LOGGED_OUT_CLEAR_STORE", __purelyLocal: true, __noEvents: true});

    BluenetPromiseWrapper.clearTrackedBeacons().catch(() => {});
    Bluenet.stopScanning();

    let promises = [];
    new Promise((resolve, reject) => {
      let handleFiles = (files) => {
        files.forEach((file) => {
          LOGi.info("log out: check file", file);
          let ext = file.name.substr(file.name.length-3);
          LOGi.info("log out: ext", ext);
          if (file.isFile() && ext === "jpg" || ext === "tmp") {
            promises.push(FileUtil.safeDeleteFile(file.path));
          }
        })

        Promise.all(promises)
          .then(() => {
            resolve();
          })

      };

      // read the document dir for files that have been created during the registration process
      RNFS.readDir(FileUtil.getPath())
        .then(handleFiles)
        .then(() => {
          resolve();
        })
    })
      .then(() => {
        CLOUD.forDevice(deviceId).exitSphere("*")  // will also clear location
          .catch(() => {})
          .then(() => {
            return StoreManager.userLogOut()
          })
          .then(() => {
            LOG.info("Quit app due to logout.");
            gracefulExit();
          })
          .catch((err) => {
            LOGe.info("Could not log user out!", err);
            gracefulExit();
          });
      })



  },

};