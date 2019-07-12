import { LiveComponent } from "../LiveComponent";
import * as React from "react";
import { ScrollView, View, Text, ActivityIndicator, Alert, TouchableOpacity, TouchableHighlight } from "react-native";
import { core } from "../../core";
import Toast from 'react-native-same-toast';
import { ListEditableItems } from "../components/ListEditableItems";
import { colors, styles } from "../styles";
import { SetupHelper } from "../../native/setup/SetupHelper";
import { TopBarUtil } from "../../util/TopBarUtil";
import { AnimatedBackground } from "../components/animated/AnimatedBackground";
import { NativeBus } from "../../native/libInterface/NativeBus";
import { Icon } from "../components/Icon";
import { BleUtil } from "../../util/BleUtil";
import { SlideInView } from "../components/animated/SlideInView";
import { BluenetPromiseWrapper } from "../../native/libInterface/BluenetPromise";
import { Stacks } from "../../router/Stacks";
import { NavigationUtil } from "../../util/NavigationUtil";
import { xUtil } from "../../util/StandAloneUtil";
import { LargeExplanation } from "../components/editComponents/LargeExplanation";
import { LOG, LOGe } from "../../logging/Log";
import { BlePromiseManager } from "../../logic/BlePromiseManager";


const BLE_STATE_READY = "ready";
const BLE_STATE_BUSY = "busy";



export class FirmwareTest extends LiveComponent<{
  item: crownstoneAdvertisement,
  handle: string,
  name: string,
  mode:string,
  componentId: string
}, any> {
  static options(props) {
    return TopBarUtil.getOptions({title: props.name, leftNav: {id: 'back', text:'Back'}})
  }


  scanning = false;
  unsubscribe = [];
  crownstoneState = {
    stoneId: null,
    error: null,
    errorDetails: null,
    temperature: null,
    powerUsage: null,
    dimmingEnabled: null,
    dimmingAvailable: null,
    locked: null,
    switchCraft: null,
    switchStateValue: null,
    switchState: null,
    relayState: null,
    dimmerState: null,
    dimmerThreshold: null,
    resetCounter: null,
    rssiAverage: null,
    referenceId: null,
    firmwareVersion: null,
    bootloaderVersion: null,
  }


  updateFreeze = {
    error: false,
    errorDetails: false,
    dimmingEnabled: false,
    dimmingAvailable: false,
    locked: false,
    switchCraft: false,
    switchState: false,
    relayState: false,
    dimmerState: false,
  }

  updateFreezeTimeouts = {
    error: null,
    errorDetails: null,
    dimmingEnabled: null,
    dimmingAvailable: null,
    locked: null,
    switchCraft: null,
    switchState: null,
    relayState: null,
    dimmerState: null,
  }


  bleStateResetTimeout;

  constructor(props) {
    super(props);

    this.state = {
      bleState: BLE_STATE_READY,
      mode: props.mode || 'unverified',
      setupActive: false,
      setupProgress: 0
    }

    this.startScanning();
  }

  navigationButtonPressed({buttonId}) {
    if (buttonId === 'back') {
      NavigationUtil.setRoot( Stacks.searchingForCrownstones() )
    }
  }

  componentWillUnmount(): void {
    this.stopScanning();
  }

  startScanning() {
    if (this.scanning === false) {
      this.scanning = true;
      this.unsubscribe.push(NativeBus.on(NativeBus.topics.advertisement, (data: crownstoneAdvertisement) => {
        if (data.handle === this.props.handle) {
          this.update(data, 'verified');
        }
      }))
      this.unsubscribe.push(NativeBus.on(NativeBus.topics.unverifiedAdvertisementData, (data: crownstoneAdvertisement) => {
        if (data.handle === this.props.handle) {
          this.update(data, 'unverified');
        }
      }))
      this.unsubscribe.push(NativeBus.on(NativeBus.topics.setupAdvertisement, (data: crownstoneAdvertisement) => {
        if (data.handle === this.props.handle) {
          this.update(data, 'setup');
        }
      }))
      // this.unsubscribe.push(NativeBus.on(NativeBus.topics.dfuAdvertisement, (data : crownstoneAdvertisement) => {
      //
      // }))
    }
  }

  stopScanning() {
    this.scanning = false;
    this.unsubscribe.forEach((unsub) => { unsub(); });
    this.unsubscribe = [];
  }

  update(data: crownstoneAdvertisement, type) {
    let updateRssi = false;
    if (this.crownstoneState.rssiAverage === null) {
      if (data.rssi < 0) {
        this.crownstoneState.rssiAverage = data.rssi;
        updateRssi = true;
      }
    }

    let rssi = this.crownstoneState.rssiAverage;

    if (data.rssi < 0) {
      this.crownstoneState.rssiAverage = Math.round(0.3 * data.rssi + 0.7 * this.crownstoneState.rssiAverage);
    }


    if (rssi !== this.crownstoneState.rssiAverage) {
      updateRssi = true;
    }

    if (updateRssi) {
      TopBarUtil.updateOptions(this.props.componentId, { title: this.props.name + " " + this.crownstoneState.rssiAverage })
    }

    if (type === 'verified' && data.serviceData.setupMode === true) {
      return;
    }

    if (type !== this.state.mode) {
      this.setState({mode: type})
    }


    if (type === "unverified") { return; }

    // check if this is a mesh message or a direct one
    if (data.serviceData.stateOfExternalCrownstone === true) { return; }

    let updateRequired = false;

    let updateCheck = (field, source) => {
      if (this.updateFreeze[field] !== true) {
        if (this.crownstoneState[field] !== source) {
          updateRequired = true;
          this.crownstoneState[field] = source;
        }
      }
    }

    // these are available in both the errorData as well as the normal service Data
    updateCheck('powerUsage', data.serviceData.powerUsageReal);
    updateCheck('temperature', data.serviceData.temperature);

    if (this.crownstoneState.powerUsage !== data.serviceData.powerUsageReal) { updateRequired = true; this.crownstoneState.powerUsage  = data.serviceData.powerUsageReal; }
    if (this.crownstoneState.temperature !== data.serviceData.temperature)   { updateRequired = true; this.crownstoneState.temperature = data.serviceData.temperature;    }

    if (data.serviceData.errorMode) {
      updateCheck('error', false);
      if (!xUtil.deepCompare(this.crownstoneState.errorDetails,data.serviceData.errors)) { updateRequired = true; this.crownstoneState.errorDetails = data.serviceData.errors; }
      return;
    }

    updateCheck('error', data.serviceData.hasError);
    updateCheck('dimmingEnabled', data.serviceData.dimmingAllowed);
    updateCheck('dimmingAvailable', data.serviceData.dimmingAvailable);
    updateCheck('locked', data.serviceData.switchLocked);
    updateCheck('switchCraft', data.serviceData.switchCraftEnabled);
    updateCheck('referenceId', data.referenceId);
    updateCheck('stoneId', data.serviceData.crownstoneId);

    if (this.crownstoneState.error === false && this.crownstoneState.errorDetails !== null) {
      this.crownstoneState.errorDetails = null;
    }

    if (this.crownstoneState.switchState !== data.serviceData.switchState) {
      updateCheck('switchState', data.serviceData.switchState);
      updateCheck('relayState', data.serviceData.switchState >= 128 ? 1 : 0);
      updateCheck('dimmerState', (data.serviceData.switchState % 128 / 100) * 0.99);
      if (this.updateFreeze.switchState === false) {
        updateRequired = true;
        this.crownstoneState.switchStateValue = this.crownstoneState.relayState === 1 ? 1 : this.crownstoneState.dimmerState;
      }
    }

    if (updateRequired) {
      this.forceUpdate();
    }
  }


  setUpdateFreeze(type) {
    if (this.updateFreezeTimeouts[type] === undefined) { return }
    clearTimeout(this.updateFreezeTimeouts[type]);
    this.updateFreeze[type] = true;
  }

  setFreezeTimeout(type) {
    if (this.updateFreezeTimeouts[type] === undefined) { return }
    clearTimeout(this.updateFreezeTimeouts[type]);
    this.updateFreezeTimeouts[type] = setTimeout(() => {
      this.clearUpdateFreeze(type);
    }, 1500);
  }

  clearUpdateFreeze(type) {
    if (this.updateFreezeTimeouts[type] === undefined) { return }
    clearTimeout(this.updateFreezeTimeouts[type]);
    this.updateFreeze[type] = false;
  }


  bleAction(action : (...any) => {}, props = [], type = null, resultHandler = (any) => {}, connect = true) {
    if (this.state.bleState === BLE_STATE_BUSY) {
      Toast.showWithGravity('  Bluetooth Busy!  ', Toast.SHORT, Toast.CENTER);
      return;
    }

    this.setUpdateFreeze(type);

    clearTimeout(this.bleStateResetTimeout);
    let promise = null;
    this.setState({bleState: BLE_STATE_BUSY})

    if (connect) {
      let proxy = BleUtil.getProxy(this.props.handle, this.crownstoneState.referenceId || core.sessionMemory.usingSphereForSetup);
      promise = proxy.performPriority(action, props)
    }
    else {
      let actionPromise = () => {
        return action.apply(this, props);
      };
      // @ts-ignore
      promise = BlePromiseManager.registerPriority(actionPromise, { from: 'performing self contained action' })
    }

    // perform.
    promise
      .then((result) => {
        resultHandler(result);
        this.setFreezeTimeout(null);
        this.setState({bleState: BLE_STATE_READY});
      })
      .catch((err) => {
        this.clearUpdateFreeze(null);
        this.showBleError(err);
      })
  }


  _setupCrownstone() {
    if (this.state.bleState === BLE_STATE_BUSY) {
      Toast.showWithGravity('  Bluetooth Busy!  ', Toast.SHORT, Toast.CENTER);
      return;
    }

    clearTimeout(this.bleStateResetTimeout);
    this.setState({setupActive: true, setupProgress:0, bleState: BLE_STATE_BUSY})

    let helper = new SetupHelper(this.props.handle, "Dev Crownstone", this.props.item.serviceData.deviceType, "c2-crownstone");
    let unsubscribeSetupEvents = [];
    unsubscribeSetupEvents.push(core.eventBus.on("setupCancelled", (handle) => {
      this.setState({setupActive: false, setupProgress: 0});
    }));
    unsubscribeSetupEvents.push(core.eventBus.on("setupInProgress", (data) => {
      this.setState({setupProgress: data.progress/20});
    }));
    unsubscribeSetupEvents.push(core.eventBus.on("setupComplete", (handle) => {
      this.setState({setupActive: false, setupProgress: 1});
    }));
    helper.claim(core.sessionMemory.usingSphereForSetup, false)
      .then(() => {
        unsubscribeSetupEvents.forEach((unsub) => { unsub() });
        this.setState({bleState: BLE_STATE_READY, setupActive: false, setupProgress:0})
      })
      .catch((err) => {
        this.setState({setupActive: false, setupProgress:0})
        this.showBleError(err);
      })
  }

  showBleError(err) {
    clearTimeout(this.bleStateResetTimeout);
    this.setState({ bleState: err });
    this.bleStateResetTimeout = setTimeout(() => {
      this.setState({ bleState: BLE_STATE_READY });
    }, 6000);
  }

  _getItems(explanationColor) {
    const store = core.store;
    let state = store.getState();

    let items = [];

    items.push({label:"OPERATIONS", type: 'explanation', below: false, color: explanationColor});
    if (this.state.mode === 'setup') {
      items.push({
        label: this.state.setupActive ? "Setting up Crownstone..." : "Perform setup",
        type: 'button',
        style: {color:colors.menuTextSelected.hex},
        progress: this.state.setupProgress,
        callback: () => {
          this._setupCrownstone();
        }
      });
      items.push({label:"Using sphere: \"" + state.spheres[core.sessionMemory.usingSphereForSetup].config.name + "\" for setup.", type: 'explanation', below: true, color: explanationColor});
    }

    if (this.state.mode === "verified") {
      items.push({
        label: "Factory Reset",
        type: 'button',
        callback: () => {
          this.bleAction(BluenetPromiseWrapper.commandFactoryReset)
        }
      });
      items.push({label:"Put your Crownstone back in setup mode.", type: 'explanation', below: true, color: explanationColor});
    }

    if (this.state.mode === 'unverified') {
      items.push({
        label: "Recover",
        type: 'button',
        callback: () => {
          this.bleAction(BluenetPromiseWrapper.recover, [this.props.handle], null, () => {}, false);
        }
      });
      items.push({label:"Recovery is possible in the first 30 seconds after power on.", type: 'explanation', below: true, color: explanationColor});
    }



    items.push({label:"CONTROL", type: 'explanation', below: false, color: explanationColor, alreadyPadded:true});
    if (this.state.mode === 'unverified') {
      items.push({label:"Disabled for unverified Crownstone.", type: 'info'});
    }
    else {
      if (this.crownstoneState.dimmingEnabled) {
        items.push({
          label: 'Set Switch',
          type: 'slider',
          disabled: this.crownstoneState.switchState === null,
          value: this.crownstoneState.switchStateValue,
          min: 0,
          max: 1,
          callback: (value) => {
            this.bleAction(BluenetPromiseWrapper.setSwitchState, [value], 'switchState')
            this.crownstoneState.switchStateValue = value;
          }
        });
      }
      else {
        items.push({
          label: 'Set Switch',
          type: 'switch',
          disabled: this.crownstoneState.switchStateValue === null,
          value: this.crownstoneState.switchStateValue === 1,
          callback: (value) => {
            this.bleAction(BluenetPromiseWrapper.setSwitchState, [value], 'switchState')
            this.crownstoneState.switchStateValue = value ? 1 : 0;
          }
        });
      }
      if (this.crownstoneState.dimmingEnabled) {
        items.push({
          label: 'Cast Switch',
          type: 'slider',
          disabled: this.crownstoneState.switchState === null,
          value: this.crownstoneState.switchStateValue,
          min: 0,
          max: 1,
          callback: (value) => {
            this.bleAction(BluenetPromiseWrapper.broadcastSwitch, [this.crownstoneState.referenceId, this.crownstoneState.stoneId, value], 'switchState')
            this.crownstoneState.switchStateValue = value;
          }
        });
      }
      else {
        items.push({
          label: 'Cast Switch',
          type: 'switch',
          disabled: this.crownstoneState.switchStateValue === null,
          value: this.crownstoneState.switchStateValue === 1,
          callback: (value) => {
            this.bleAction(BluenetPromiseWrapper.broadcastSwitch, [this.crownstoneState.referenceId, this.crownstoneState.stoneId, value], 'switchState');
            this.crownstoneState.switchStateValue = value ? 1 : 0;
          }
        });
      }
      items.push({
        label: 'Set Relay',
        type: 'switch',
        disabled: this.crownstoneState.relayState === null,
        value: this.crownstoneState.relayState === 1,
        callback: (value) => {
          this.bleAction(BluenetPromiseWrapper.switchRelay, [value], 'relayState');
          this.crownstoneState.relayState = value ? 1 : 0;
        }
      });
      if (this.crownstoneState.dimmingEnabled) {
        items.push({
          label: 'Set Dimmer',
          type: 'slider',
          disabled: this.crownstoneState.dimmerState === null,
          value: this.crownstoneState.dimmerState,
          min: 0,
          max: 0.99,
          callback: (value) => {
            this.bleAction(BluenetPromiseWrapper.switchDimmer, [value], 'dimmerState');
            this.crownstoneState.dimmerState = value;
          }
        });
      }
      else {
        items.push({label:"Dimming is disabled.", type: 'info'});
      }
    }

    items.push({label:"CONFIG", type: 'explanation', below: false, color: explanationColor});
    if (this.state.mode === 'unverified') {
      items.push({label:"Disabled for unverified Crownstone.", type: 'info'});
    }
    else {
      items.push({
        label: 'Allow Dimming',
        type: 'switch',
        disabled: this.crownstoneState.dimmingEnabled === null,
        value: this.crownstoneState.dimmingEnabled,
        callback: (value) => {
          this.bleAction(BluenetPromiseWrapper.allowDimming, [value], 'dimmingEnabled')
          this.crownstoneState.dimmingEnabled = value;
        }
      });
      items.push({
        label: 'Dimmer Threshold',
        type: 'textEdit',
        value: this.crownstoneState.dimmerThreshold || "",
        callback: (value) => {
          Alert.alert("Not implemented yet")
        }
      });
      items.push({
        label: 'Request Dimmer Threshold',
        type: 'button',
        style: {color:colors.menuTextSelected.hex},
        callback: (value) => {
          Alert.alert("Not implemented yet")
        }
      });
      items.push({
        label: 'Switch Locked',
        type: 'switch',
        disabled: this.crownstoneState.locked === null,
        value: this.crownstoneState.locked,
        callback: (value) => {
          this.bleAction(BluenetPromiseWrapper.lockSwitch, [value], 'locked');
          this.crownstoneState.locked = value;
        }
      });
      items.push({
        label: 'Switchcraft',
        type: 'switch',
        disabled: this.crownstoneState.switchCraft === null,
        value: this.crownstoneState.switchCraft,
        callback: (value) => {
          this.bleAction(BluenetPromiseWrapper.setSwitchCraft, [value], 'switchCraft')
          this.crownstoneState.switchCraft = value;
        }
      });
      items.push({
        label: 'Reset Errors',
        type: 'button',
        style: {color:colors.menuTextSelected.hex},
        callback: (value) => {
          this.bleAction(BluenetPromiseWrapper.clearErrors, [{
            dimmerOnFailure:    true,
            dimmerOffFailure:   true,
            temperatureDimmer:  true,
            temperatureChip:    true,
            overCurrentDimmer:  true,
            overCurrent:        true,
          }])
        }
      });
    }

    items.push({
      label: "Get Firmware Version",
      type: 'button',
      style: {color:colors.menuTextSelected.hex},
      callback: () => {
        this.bleAction(BluenetPromiseWrapper.getFirmwareVersion, [this.props.handle], null, (firmwareVersion) => {
          this.crownstoneState.firmwareVersion = firmwareVersion.data;
          this.forceUpdate();
        })
      }
    });
    items.push({ label: "Firmware: " + this.crownstoneState.firmwareVersion || " not requested yet.", type: 'explanation', below: true, color: explanationColor });

    items.push({
      label: "Get Reset Counter",
      type: 'button',
      style: {color:colors.menuTextSelected.hex},
      callback: () => {
        this.bleAction(BluenetPromiseWrapper.getResetCounter, [this.props.handle], null, (resetCounter) => {
          this.crownstoneState.resetCounter = resetCounter.data;
          this.forceUpdate();
        })
      }
    });
    items.push({ label: "Reset Count: " + this.crownstoneState.resetCounter || " not requested yet.", type: 'explanation', below: true, color: explanationColor });

    if (this.state.mode === "verified") {
      let state = core.store.getState();
      let sphere = state.spheres[this.crownstoneState.referenceId];
      if (sphere) {
        items.push({ label: "In Sphere " + sphere.config.name, type: 'explanation', below: false, color: explanationColor });
      }
    }

    if (this.state.mode !== 'unverified') {
      items.push({
        label: "Go in DFU mode",
        type: 'button',
        style: {color:colors.red.hex},
        callback: () => {
          this.bleAction(BluenetPromiseWrapper.putInDFU, [this.props.handle], null, () => {
            NavigationUtil.setRoot( Stacks.searchingForCrownstones() )
          })
        }
      });
    }
    items.push({type: 'spacer'});
    items.push({type: 'spacer'});
    items.push({type: 'spacer'});


    return items;
  }


  render() {
    let backgroundImage = core.background.light;
    let explanationColor = colors.black.rgba(0.9);

    switch (this.state.mode) {
      case "setup":
        explanationColor = colors.white.hex;
        backgroundImage = require('../../images/backgrounds/blueBackground2.png');
        break;
      case "verified":
        backgroundImage = core.background.light;
        break;
      case "unverified":
        backgroundImage = core.background.menu;
        break;

    }

    let triggerErrorMessage = () => {
      if (!(this.state.bleState === BLE_STATE_READY || this.state.bleState === BLE_STATE_BUSY)) {
        Alert.alert("BLE Error:", JSON.stringify(this.state.bleState, undefined, 2))
      }
    }


    return (
      <AnimatedBackground image={backgroundImage} >
        <View style={{flexDirection: 'row', paddingTop: 10, paddingBottom: 10, backgroundColor: colors.white.rgba(0.8), borderBottomWidth: 1, borderBottomColor: colors.black.rgba(0.2)}}>
          <View style={{flex:1}} />
          <StatusIndicator
            label={'BLE'}
            icon={'ios-bluetooth'}
            pending={this.state.bleState === BLE_STATE_BUSY}
            backgroundColor={this.state.bleState === BLE_STATE_READY || this.state.bleState === BLE_STATE_BUSY ? colors.green.hex : colors.red.hex}
            callback={() => {
              triggerErrorMessage();
            }}
          />
          <View style={{flex:1}} />
          <StatusIndicator
            label={'HW Errors'}
            icon={'ios-bug'}
            disabled={this.state.mode === 'unverified'}
            pending={this.crownstoneState.error === null}
            backgroundColor={this.crownstoneState.error ? (this.crownstoneState.errorDetails === null ? colors.csOrange.hex : colors.red.hex) : colors.csBlueDark.hex}
            callback={() => {
              if (this.crownstoneState.error) {
                if (this.crownstoneState.errorDetails) {
                  Alert.alert("Errors:", JSON.stringify(this.crownstoneState.errorDetails, undefined, 2))
                } else {
                  Alert.alert("Errors:", "No details yet...")
                }
              }
              else {
                Alert.alert("No Hardware Errors.");
              }
            }}
          />
          <View style={{flex:1}} />
          <StatusIndicator
            label={'Temp'}
            icon={'md-thermometer'}
            disabled={this.state.mode === 'unverified'}
            pending={this.crownstoneState.temperature === null}
            value={this.crownstoneState.temperature + " C"}
            backgroundColor={colors.green.blend(colors.red, (this.crownstoneState.temperature - 25) / 50).hex}
          />
          <View style={{flex:1}} />
          <StatusIndicator
            label={'Power'}
            icon={'ios-flash'}
            disabled={this.state.mode === 'unverified'}
            pending={this.crownstoneState.powerUsage === null}
            value={this.crownstoneState.powerUsage + " W"}
            backgroundColor={colors.green.blend(colors.red, this.crownstoneState.powerUsage / 4000).hex}
          />
          <View style={{flex:1}} />
          <StatusIndicator
            label={'Dimmer'}
            icon={'ios-sunny'}
            iconSize={32}
            disabled={this.state.mode === 'unverified'}
            pending={this.crownstoneState.dimmingAvailable === null}
            backgroundColor={this.crownstoneState.dimmingAvailable ? colors.green.hex : colors.csBlueDark.hex}
          />
          <View style={{flex:1}} />
        </View>
        <SlideInView hidden={true} height={50} visible={this.state.bleState !== BLE_STATE_READY && this.state.bleState !== BLE_STATE_BUSY}>
          <TouchableOpacity onPress={triggerErrorMessage} style={{paddingLeft: 10, paddingRight: 10, backgroundColor: colors.red.hex, borderBottomWidth: 1, borderBottomColor: colors.black.rgba(0.2), height: 50, ...styles.centered}}>
            <Text style={{fontSize: 15, fontWeight: 'bold', color: colors.white.hex}}>Error during BLE command.</Text>
          </TouchableOpacity>
        </SlideInView>
        <ScrollView keyboardShouldPersistTaps="always">
          <ListEditableItems items={this._getItems(explanationColor)} separatorIndent={true} />
        </ScrollView>
      </AnimatedBackground>
    )
  }
}

function StatusIndicator(props) {
  let iconColorBase = props.iconColor && props.iconColor.hex || colors.white.hex;
  let iconColor = iconColorBase;
  let backgroundColor = props.backgroundColor;
  if (props.value) {
    iconColor = props.iconColor && props.iconColor.rgba(0.2) || colors.white.rgba(0.2)
  }


  let pending = props.pending;
  if (props.disabled) {
    iconColor = colors.white.rgba(0.75);
    backgroundColor = colors.gray.rgba(0.5)
    pending = false;
  }
  if (pending) {
    backgroundColor = colors.csBlue.rgba(0.5)
  }


  return (
    <TouchableOpacity style={{alignItems:'center', width: 70}} onPress={() => { if (props.callback) { props.callback(); } }}>
      {pending ?
        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: backgroundColor, ...styles.centered }}>
          <ActivityIndicator size={1} color={colors.white.hex} />
        </View>
        :
        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: backgroundColor }}>
          <View style={{ width: 50, height: 50, ...styles.centered, position: 'absolute', top: 0, left: 0 }}>
            <Icon name={props.icon} size={props.iconSize || 30} color={iconColor}/>
          </View>
          {props.value && !props.disabled ? <View
            style={{ width: 50, height: 50, ...styles.centered, position: 'absolute', top: 0, left: 0, padding: 3 }}>
            <Text style={{ fontSize: 15, color: iconColorBase, fontWeight: 'bold' }} minimumFontScale={0.2}
                  numberOfLines={1} adjustsFontSizeToFit={true}>{props.value}</Text></View> : undefined}
        </View>
      }

      <Text style={{fontSize:14, color: props.color || colors.black.rgba(0.8)}}>{props.label}</Text>
    </TouchableOpacity>
  )

}