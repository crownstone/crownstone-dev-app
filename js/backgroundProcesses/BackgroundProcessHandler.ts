import { Alert, AppState }       from 'react-native';

import { Bluenet }               from "../native/libInterface/Bluenet";
import { BluenetPromiseWrapper } from "../native/libInterface/BluenetPromise";
import { CLOUD }                 from "../cloud/cloudAPI";
import { AppUtil }               from "../util/AppUtil";
import { Util }                  from "../util/Util";

import { DataUtil, prepareStoreForUser } from "../util/DataUtil";

import { StoreManager }          from "../router/store/storeManager";
import { Scheduler }             from "../logic/Scheduler";
import { SetupStateHandler }     from "../native/setup/SetupStateHandler";
import { LOG_EXTENDED_TO_FILE, LOG_TO_FILE, CLOUD_POLLING_INTERVAL, SYNC_INTERVAL } from "../ExternalConfig";
import { BatterySavingUtil }     from "../util/BatterySavingUtil";
import { MapProvider }           from "./MapProvider";
import { DfuStateHandler }       from "../native/firmware/DfuStateHandler";
import { LOG, LOGe, LOGw }       from "../logging/Log";
import { LogProcessor }          from "../logging/LogProcessor";
import { BleLogger }             from "../native/advertisements/BleLogger";
import { StoneManager }          from "../native/advertisements/StoneManager";
import { MeshUtil }              from "../util/MeshUtil";
import { Sentry }                from "react-native-sentry";
import { EncryptionManager }     from "../native/libInterface/Encryption";
import { BroadcastStateManager } from "./BroadcastStateManager";

import { core } from "../core";
import { cleanLogs } from "../logging/LogUtil";
import { migrate } from "./migration/StoreMigration";
import { StoneAvailabilityTracker } from "../native/advertisements/StoneAvailabilityTracker";
import { StoneDataSyncer } from "./StoneDataSyncer";
import { insertInitialState, setDefaultSessionData } from "./InitialState";
import { OverlayManager } from "./OverlayManager";
import { base_core } from "../base_core";


class BackgroundProcessHandlerClass {
  started : boolean = false;
  userLoggedIn : boolean = false;
  storePrepared : boolean = false;
  connectionPopupActive : boolean = false;

  cancelPauseTrackingCallback = null;
  trackingPaused = false;

  constructor() { }

  start() {if (!this.started) {
    LOG.info("BackgroundProcessHandler: Starting the background processes.");
    // start the BLE things.
    // route the events to React Native
    Bluenet.rerouteEvents();

    BluenetPromiseWrapper.isDevelopmentEnvironment().then((result) => {
      base_core.sessionMemory.developmentEnvironment = result;
    });

    // when the user is logged in we track spheres and scan for Crownstones
    // This event is triggered on boot by the start store or by the login process.
    core.eventBus.on('storePrepared', () => {
      LOG.info("BackgroundProcessHandler: Store is prepared.");
      this.storePrepared = true;

      insertInitialState();

      // clear the temporary data like state and disability of stones so no old data will be shown
      prepareStoreForUser();

      Bluenet.setBackgroundScanning(false);

      LOG.info("BackgroundProcessHandler: received userLoggedIn event.");

      // disable battery saving (meaning, no BLE scans reach the app)
      Bluenet.batterySaving(false);

      // pass the store to the singletons
      LOG.info("BackgroundProcessHandler: Starting singletons.");
      this.startSingletons();

      this.startCloudService();

      this.startEventTriggers();

      this.startBluetoothListener();

      this.updateDeviceDetails();

      this.setupLogging();

      // init behaviour based on if we are in the foreground or the background.
      this._applyAppStateOnScanning(AppState.currentState);

      BroadcastStateManager.init();


    });
    // when the user is logged in we track spheres and scan for Crownstones
    // This event is triggered on boot by the start store or by the login process.
    core.eventBus.on('userLoggedIn', () => {
      MapProvider.refreshAll();
      this.userLoggedIn = true;
    });


    // Create the store from local storage. If there is no local store yet (first open), this is synchronous
    this.startStore();

  }
    this.started = true;
  }



  setupLogging() {
    let state = core.store.getState();
    Bluenet.enableLoggingToFile((state.user.developer === true && state.development.logging_enabled === true) || LOG_TO_FILE === true);
    if ((state.user.developer === true && state.development.logging_enabled === true && state.development.nativeExtendedLogging === true) || LOG_EXTENDED_TO_FILE === true) {
      Bluenet.enableExtendedLogging(true);
    }


    // use periodic events to clean the logs.
    let triggerId = "LOG_CLEANING_TRIGGER";
    Scheduler.setRepeatingTrigger(triggerId, {repeatEveryNSeconds: 5*3600});
    Scheduler.loadCallback(triggerId,() => { cleanLogs() }, true);
  }


  /**
   * Triggers background sync, sets the networkError handler which is used when there is no internet connection
   */
  startCloudService() {
    // set the global network error handler.
    CLOUD.setNetworkErrorHandler((err) => {
      if (this.connectionPopupActive === false) {
        this.connectionPopupActive = true;
        this.connectionPopupActive = false; core.eventBus.emit('hideLoading');
        LOGw.cloud("Could not connect to the cloud.", err);
        Alert.alert(
          "Connection Problem",
          "Could not connect to the Cloud. Please check your internet connection.",
          [{text: 'OK'}],
        );
      }
    });
  }


  /**
   * Update device specs: Since name is user editable, it can change over time. We use this to update the model.
   */
  updateDeviceDetails() {
    let state = core.store.getState();
    let currentDeviceSpecs = Util.data.getDeviceSpecs(state);
    let deviceInDatabaseId = Util.data.getDeviceIdFromState(state, currentDeviceSpecs.address);
    if (currentDeviceSpecs.address && deviceInDatabaseId) {
      let deviceInDatabase = state.devices[deviceInDatabaseId];
      // if the address matches but the name does not, update the device name in the cloud.
      if (deviceInDatabase.address === currentDeviceSpecs.address && 
        (currentDeviceSpecs.name != deviceInDatabase.name) || 
        (currentDeviceSpecs.os != deviceInDatabase.os) || 
        (currentDeviceSpecs.userAgent != deviceInDatabase.userAgent) || 
        (currentDeviceSpecs.deviceType != deviceInDatabase.deviceType) || 
        (currentDeviceSpecs.model != deviceInDatabase.model) || 
        (currentDeviceSpecs.locale != deviceInDatabase.locale) || 
        (currentDeviceSpecs.description != deviceInDatabase.description))
        {
        core.store.dispatch({type: 'UPDATE_DEVICE_CONFIG', deviceId: deviceInDatabaseId, data: {
          name: currentDeviceSpecs.name,
          os: currentDeviceSpecs.os,
          userAgent: currentDeviceSpecs.userAgent,
          deviceType: currentDeviceSpecs.deviceType,
          model: currentDeviceSpecs.model,
          locale: currentDeviceSpecs.locale,
          description: currentDeviceSpecs.description
        }})
      }
    }
  }

  /**
   * - When the user is logged in, we start listening for BLE and tracking spheres.
   *
   */
  startEventTriggers() {
    // listen to the state of the app: if it is in the foreground or background
    AppState.addEventListener('change', (appState) => {
      LOG.info("App State Change", appState);
      Sentry.captureBreadcrumb({
        category: 'AppState',
        data: {
          state: appState,
        }
      });

      this._applyAppStateOnScanning(appState);
    });
  }

  _applyAppStateOnScanning(appState) {
    // in the foreground: start scanning!
    if (appState === "active") {
      BatterySavingUtil.startNormalUsage();

      // clear all mesh network ids in all spheres on opening the app.
      MeshUtil.clearMeshNetworkIds(core.store);

      // restore tracking state if required. An independent check for the indoorlocalization state is not required.
      if (this.cancelPauseTrackingCallback !== null) {
        this.cancelPauseTrackingCallback();
        this.cancelPauseTrackingCallback = null;
      }
      if (this.trackingPaused) {
        Bluenet.resumeTracking();
        BluenetPromiseWrapper.isReady().then(() => {
          LOG.info("BackgroundProcessHandler: Start Scanning after inactive.");
          return Bluenet.startScanningForCrownstonesUniqueOnly();
        });
        this.trackingPaused = false;
      }
    }
    else if (appState === 'background') {
      // in the background: stop scanning to save battery!
      BatterySavingUtil.startBatterySaving();

      // check if we require indoor localization, pause tracking if we dont.
      let state = core.store.getState();
      if (state.app.indoorLocalizationEnabled === false) {
        this.cancelPauseTrackingCallback = Scheduler.scheduleCallback(() => {
          // stop all scanning and tracking to save battery. This will only happen if the app lives in the background for 5 minutes when it shouldnt.
          Bluenet.pauseTracking();
          Bluenet.stopScanning();
          this.cancelPauseTrackingCallback = null;
          this.trackingPaused = true;
        }, 5*60*1000, 'pauseTracking');
      }
    }
  }

  startBluetoothListener() {
    // Ensure we start scanning when the bluetooth module is powered on.
    core.nativeBus.on(core.nativeBus.topics.bleStatus, (status) => {
      if (status === 'poweredOn') {
        BatterySavingUtil.startNormalUsage();
      }
    });

    Bluenet.requestBleState();
  }

  startStore() {
    // there can be a race condition where the event has already been fired before this module has initialized
    // This check is to ensure that it doesn't matter what comes first.
    if (StoreManager.isInitialized() === true) {
      this._verifyStore();
    }
    else {
      core.eventBus.on('storeManagerInitialized', () => { this._verifyStore(); });
    }
  }

  _verifyStore() {
    core.store = StoreManager.getStore();
    let state = core.store.getState();

    // if we have an accessToken, we proceed with logging in automatically
    if (state.user.accessToken !== null) {
      // in the background we check if we're authenticated, if not we log out.
      CLOUD.setAccess(state.user.accessToken);
      CLOUD.forUser(state.user.userId).getUserData()
        .catch((err) => {
          if (err.status === 401) {
            LOGw.info("BackgroundProcessHandler: Could not verify user, attempting to login again.");
            return CLOUD.login({
              email: state.user.email,
              password: state.user.passwordHash,
              background: true
            })
              .then((response) => {
                CLOUD.setAccess(response.id);
                CLOUD.setUserId(response.userId);
                core.store.dispatch({type:'USER_APPEND', data:{accessToken: response.id}});
              })
          }
          else {
            throw err;
          }
        })
        .then((reply) => {
          LOG.info("BackgroundProcessHandler: Verified User.", reply);
          // CLOUD.sync(core.store, true).catch(() => {})
        })
        .catch((err) => {
          LOG.info("BackgroundProcessHandler: COULD NOT VERIFY USER -- ERROR", err);
          if (err.status === 401) {
            AppUtil.logOut({title:'Logging out.', body:"Could not verify user in the cloud. The app will reset and close."});
          }
        });
      this.userLoggedIn = true;

      migrate();

      let healthyDatabase = DataUtil.verifyDatabase(true);
      if (!healthyDatabase) {
        Alert.alert("Something went wrong...","I have identified a problem with the Sphere on your phone... I'll have to redownload it from the Cloud to fix this.", [{text:'OK', onPress: () => {
            AppUtil.resetDatabase(core.store, core.eventBus);
          }}], {cancelable:false});
        return;
      }

      setDefaultSessionData();
      core.eventBus.emit("userLoggedIn");
      core.eventBus.emit("storePrepared");
      if (state.user.isNew === false) {
        core.eventBus.emit("userLoggedInFinished");
      }
    }
    else {
      insertInitialState();
      core.eventBus.emit("storePrepared");
    }
  }



  startSingletons() {
    BleLogger.init();
    DfuStateHandler.init();
    EncryptionManager.init();
    LogProcessor.init();
    MapProvider.init();
    OverlayManager.init();
    Scheduler.init();
    StoneAvailabilityTracker.init();
    StoneManager.init();
    SetupStateHandler.init();
  }
}



export const BackgroundProcessHandler = new BackgroundProcessHandlerClass();
