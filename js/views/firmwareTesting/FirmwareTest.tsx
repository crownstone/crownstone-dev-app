import { LiveComponent } from "../LiveComponent";
import * as React from "react";
import { ScrollView, View, Text, ActivityIndicator, Alert, TouchableOpacity, Platform } from "react-native";
import { core } from "../../core";
import Toast from 'react-native-same-toast';
import { ListEditableItems } from "../components/ListEditableItems";
import { colors, screenWidth, styles } from "../styles";
import { SetupHelper } from "../../native/setup/SetupHelper";
import { TopBarUtil } from "../../util/TopBarUtil";
import { AnimatedBackground } from "../components/animated/AnimatedBackground";
import { Icon } from "../components/Icon";
import { BleUtil } from "../../util/BleUtil";
import { SlideInView } from "../components/animated/SlideInView";
import { BluenetPromiseWrapper } from "../../native/libInterface/BluenetPromise";
import { Stacks } from "../../router/Stacks";
import { NavigationUtil } from "../../util/NavigationUtil";
import { BlePromiseManager } from "../../logic/BlePromiseManager";
import { ConnectionManager } from "../../backgroundProcesses/ConnectionManager";
import { FocusManager } from "../../backgroundProcesses/FocusManager";
import { BroadcastStateManager } from "../../backgroundProcesses/BroadcastStateManager";


const BLE_STATE_READY = "ready";
const BLE_STATE_BUSY = "busy";

const PROXY_OPTIONS = {keepConnectionOpen: true}

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

  bleStateResetTimeout;

  unsubscribe = [];

  constructor(props) {
    super(props);

    this.state = {
      bleState: BLE_STATE_READY,
      setupActive: false,
      setupProgress: 0
    }
  }

  navigationButtonPressed({buttonId}) {
    if (buttonId === 'back') {
      NavigationUtil.setRoot( Stacks.searchingForCrownstones() )
      FocusManager.stopScanning()
      ConnectionManager.disconnect();
    }
  }

  componentDidMount() {
    this.unsubscribe.push(core.eventBus.on("FOCUS_RSSI_UPDATE", () => {
      TopBarUtil.updateOptions(this.props.componentId, { title: FocusManager.name + " " + FocusManager.crownstoneState.rssiAverage })
    }));

    this.unsubscribe.push(core.eventBus.on("FOCUS_UPDATE", () => {
      this.forceUpdate();
    }));
  }

  componentWillUnmount(): void {
    this.unsubscribe.forEach((unsub) => { unsub(); });
  }


  bleAction(action : (...any) => {}, props = [], type = null, resultHandler = (any) => {}, connect = true, immediate = false) {
    if (this.state.bleState === BLE_STATE_BUSY) {
      Toast.showWithGravity('  Bluetooth Busy!  ', Toast.SHORT, Toast.CENTER);
      return;
    }

    FocusManager.setUpdateFreeze(type);


    let promise = null;
    this.setState({bleState: BLE_STATE_BUSY})
    let state = core.store.getState();

    if (connect) {
      ConnectionManager.connectWillStart()
      let proxy = BleUtil.getProxy(this.props.handle, FocusManager.crownstoneState.referenceId || state.user.sphereUsedForSetup);
      promise = proxy.performPriority(action, props, PROXY_OPTIONS)
    }
    else {
      ConnectionManager.disconnect()
      let actionPromise = () => {
        if (immediate) {
          return new Promise((resolve, reject) => {
            // @ts-ignore
            action.apply(this, props).catch((err) => {});
            setTimeout(() => {
              resolve();
            },100);
          })
        }
        return action.apply(this, props);
      };
      // @ts-ignore
      promise = BlePromiseManager.registerPriority(actionPromise, { from: 'performing self contained action' })
    }

    // perform.
    promise
      .then((result) => {
        resultHandler(result);
        FocusManager.setFreezeTimeout(type);
        this.setState({bleState: BLE_STATE_READY});
        if (connect) { ConnectionManager.setDisconnectTimeout() }
      })
      .catch((err) => {
        FocusManager.clearUpdateFreeze(type);
        this.showBleError(err);
        if (connect) { ConnectionManager.disconnect() }
      })
  }


  _setupCrownstone() {
    if (this.state.bleState === BLE_STATE_BUSY) {
      Toast.showWithGravity('  Bluetooth Busy!  ', Toast.SHORT, Toast.CENTER);
      return;
    }

    let state = core.store.getState();

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
    helper.claim(state.user.sphereUsedForSetup, false)
      .then(() => {
        unsubscribeSetupEvents.forEach((unsub) => { unsub() });
        this.setState({bleState: BLE_STATE_READY, setupActive: false, setupProgress:0})
        BroadcastStateManager._updateLocationState(state.user.sphereUsedForSetup);
        BroadcastStateManager._reloadDevicePreferences();
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
    if (FocusManager.crownstoneMode === 'setup') {
      items.push({
        label: "Reboot Crownstone",
        type: 'button',
        style: { color: colors.menuTextSelected.hex },
        callback: () => {
          this.bleAction(BluenetPromiseWrapper.restartCrownstone)
        }
      });
      items.push({
        label: this.state.setupActive ? "Setting up Crownstone..." : "Perform setup",
        type: 'button',
        style: {color:colors.menuTextSelected.hex},
        progress: this.state.setupProgress,
        callback: () => {
          this._setupCrownstone();
        }
      });
      items.push({label:"Using sphere: \"" + state.spheres[state.user.sphereUsedForSetup].config.name + "\" for setup.", type: 'explanation', below: true, color: explanationColor});
    }

    if (FocusManager.crownstoneMode === "verified") {
      items.push({
        label: "Reboot Crownstone",
        type: 'button',
        style: { color: colors.menuTextSelected.hex },
        callback: () => {
          this.bleAction(BluenetPromiseWrapper.restartCrownstone)
        }
      });
      items.push({
        label: "Factory Reset",
        type: 'button',
        callback: () => {
          this.bleAction(BluenetPromiseWrapper.commandFactoryReset)
        }
      });
      items.push({label:"Put your Crownstone back in setup mode.", type: 'explanation', below: true, color: explanationColor});
    }

    if (FocusManager.crownstoneMode === 'unverified') {
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
    if (FocusManager.crownstoneMode === 'unverified') {
      items.push({label:"Disabled for unverified Crownstone.", type: 'info'});
    }
    else {
      if (FocusManager.crownstoneState.dimmingEnabled) {
        items.push({
          label: 'Set Switch',
          type: 'slider',
          disabled: FocusManager.crownstoneState.switchState === null,
          value: FocusManager.crownstoneState.switchStateValue,
          min: 0,
          max: 1,
          callback: (value) => {
            this.bleAction(BluenetPromiseWrapper.setSwitchState, [value], 'switchState')
            FocusManager.crownstoneState.switchStateValue = value;
            this.forceUpdate();
          }
        });
      }
      else {
        items.push({
          label: 'Set Switch',
          type: 'switch',
          disabled: FocusManager.crownstoneState.switchStateValue === null,
          value: FocusManager.crownstoneState.switchStateValue === 1,
          callback: (value) => {
            this.bleAction(BluenetPromiseWrapper.setSwitchState, [value], 'switchState')
            FocusManager.crownstoneState.switchStateValue = value ? 1 : 0;
            this.forceUpdate();
          }
        });
      }
      if (FocusManager.crownstoneState.dimmingEnabled) {
        items.push({
          label: 'Cast Switch',
          type: 'slider',
          disabled: FocusManager.crownstoneState.switchState === null,
          value: FocusManager.crownstoneState.switchStateValue,
          min: 0,
          max: 1,
          callback: (value) => {
            this.bleAction(BluenetPromiseWrapper.broadcastSwitch, [FocusManager.crownstoneState.referenceId, FocusManager.crownstoneState.stoneId, value], 'switchState', () => {}, false, true)
            FocusManager.crownstoneState.switchStateValue = value;
            this.forceUpdate();
          }
        });
      }
      else {
        items.push({
          label: 'Cast Switch',
          type: 'switch',
          disabled: FocusManager.crownstoneState.switchStateValue === null,
          value: FocusManager.crownstoneState.switchStateValue === 1,
          callback: (value) => {
            this.bleAction(BluenetPromiseWrapper.broadcastSwitch, [FocusManager.crownstoneState.referenceId, FocusManager.crownstoneState.stoneId, value], 'switchState',() => {},false, true);
            FocusManager.crownstoneState.switchStateValue = value ? 1 : 0;
            this.forceUpdate();
          }
        });
      }
      items.push({
        label: 'Set Relay',
        type: 'switch',
        disabled: FocusManager.crownstoneState.relayState === null,
        value: FocusManager.crownstoneState.relayState === 1,
        callback: (value) => {
          this.bleAction(BluenetPromiseWrapper.switchRelay, [value], 'relayState');
          FocusManager.crownstoneState.relayState = value ? 1 : 0;
          this.forceUpdate();
        }
      });
      if (FocusManager.crownstoneState.dimmingEnabled) {
        items.push({
          label: 'Set Dimmer',
          type: 'slider',
          disabled: FocusManager.crownstoneState.dimmerState === null,
          value: FocusManager.crownstoneState.dimmerState,
          min: 0,
          max: 0.99,
          callback: (value) => {
            this.bleAction(BluenetPromiseWrapper.switchDimmer, [value], 'dimmerState');
            FocusManager.crownstoneState.dimmerState = value;
            this.forceUpdate();
          }
        });
      }
      else {
        items.push({label:"Dimming is disabled.", type: 'info'});
      }
    }

    items.push({label:"CONFIG", type: 'explanation', below: false, color: explanationColor});
    if (FocusManager.crownstoneMode === 'unverified') {
      items.push({label:"Disabled for unverified Crownstone.", type: 'info'});
    }
    else {
      items.push({
        label: 'Allow Dimming',
        type: 'switch',
        disabled: FocusManager.crownstoneState.dimmingEnabled === null,
        value: FocusManager.crownstoneState.dimmingEnabled,
        callback: (value) => {
          this.bleAction(BluenetPromiseWrapper.allowDimming, [value], 'dimmingEnabled')
          FocusManager.crownstoneState.dimmingEnabled = value;
        }
      });
      items.push({
        label: 'Switch Locked',
        type: 'switch',
        disabled: FocusManager.crownstoneState.locked === null,
        value: FocusManager.crownstoneState.locked,
        callback: (value) => {
          this.bleAction(BluenetPromiseWrapper.lockSwitch, [value], 'locked');
          FocusManager.crownstoneState.locked = value;
        }
      });
      items.push({
        label: 'Switchcraft',
        type: 'switch',
        disabled: FocusManager.crownstoneState.switchCraft === null,
        value: FocusManager.crownstoneState.switchCraft,
        callback: (value) => {
          this.bleAction(BluenetPromiseWrapper.setSwitchCraft, [value], 'switchCraft')
          FocusManager.crownstoneState.switchCraft = value;
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

    items.push({ label: "GET INFORMATION", type: 'explanation', color: explanationColor });

    if (Platform.OS === 'android') {
      items.push({
        label: "MAC address",
        type: 'info',
        value: FocusManager.crownstoneState.macAddress,
      });
    }
    else if (FocusManager.crownstoneMode === 'setup') {
      items.push({
        label: "MAC address",
        type: 'buttonGetValue',
        value: FocusManager.crownstoneState.macAddress,
        getter: () => {
          this.bleAction(BluenetPromiseWrapper.getMACAddress, [], null, (macAddress) => {
            FocusManager.crownstoneState.macAddress = macAddress.data;
            this.forceUpdate();
          })
        }
      });
    }

    items.push({
      label: "Firmware Version",
      type: 'buttonGetValue',
      value: FocusManager.crownstoneState.firmwareVersion,
      getter: () => {
        this.bleAction(BluenetPromiseWrapper.getFirmwareVersion, [], null, (firmwareVersion) => {
          FocusManager.crownstoneState.firmwareVersion = firmwareVersion.data;
          this.forceUpdate();
        })
      }
    });

    items.push({
      label: "Hardware Version",
      type: 'buttonGetValue',
      value: FocusManager.crownstoneState.hardwareVersion,
      getter: () => {
        this.bleAction(BluenetPromiseWrapper.getHardwareVersion, [], null, (hardwareVersion) => {
          FocusManager.crownstoneState.hardwareVersion = hardwareVersion.data;
          this.forceUpdate();
        })
      }
    });


    items.push({
      label: "Reset Counter",
      type: 'buttonGetValue',
      value: FocusManager.crownstoneState.resetCounter,
      getter: () => {
        this.bleAction(BluenetPromiseWrapper.getResetCounter, [], null, (resetCounter) => {
          FocusManager.crownstoneState.resetCounter = resetCounter.data;
          this.forceUpdate();
        })
      }
    });

    if (FocusManager.crownstoneMode === "verified") {
      let state = core.store.getState();
      let sphere = state.spheres[FocusManager.crownstoneState.referenceId];
      if (sphere) {
        items.push({ label: "In Sphere " + sphere.config.name, type: 'explanation', below: false, color: explanationColor });
      }
    }

    if (FocusManager.crownstoneMode  !== 'unverified') {
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

    switch (FocusManager.crownstoneMode ) {
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

    if (FocusManager.crownstoneState.error) {
      backgroundImage = require('../../images/backgrounds/somethingWrong.png');
      explanationColor = colors.white.rgba(0.5);
    }


    let triggerErrorMessage = () => {
      if (!(this.state.bleState === BLE_STATE_READY || this.state.bleState === BLE_STATE_BUSY)) {
        Alert.alert("BLE Error:", JSON.stringify(this.state.bleState, undefined, 2))
      }
    }


    return (
      <AnimatedBackground image={backgroundImage} >
        <View style={{flexDirection: 'row', paddingTop: 10, paddingBottom: 10, width:screenWidth, backgroundColor: colors.white.rgba(0.8), borderBottomWidth: 1, borderBottomColor: colors.black.rgba(0.2)}}>
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
            disabled={FocusManager.crownstoneMode === 'unverified'}
            pending={FocusManager.crownstoneState.error === null}
            backgroundColor={FocusManager.crownstoneState.error ? (FocusManager.crownstoneState.errorDetails === null ? colors.csOrange.hex : colors.red.hex) : colors.csBlueDark.hex}
            callback={() => {
              if (FocusManager.crownstoneState.error) {
                if (FocusManager.crownstoneState.errorDetails) {
                  Alert.alert("Errors:", JSON.stringify(FocusManager.crownstoneState.errorDetails, undefined, 2))
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
            disabled={FocusManager.crownstoneMode === 'unverified'}
            pending={FocusManager.crownstoneState.temperature === null}
            value={FocusManager.crownstoneState.temperature + " C"}
            backgroundColor={colors.green.blend(colors.red, (FocusManager.crownstoneState.temperature - 40) / 40).hex}
          />
          <View style={{flex:1}} />
          <StatusIndicator
            label={'Power'}
            icon={'ios-flash'}
            disabled={FocusManager.crownstoneMode === 'unverified'}
            pending={FocusManager.crownstoneState.powerUsage === null}
            value={FocusManager.crownstoneState.powerUsage + " W"}
            backgroundColor={colors.green.blend(colors.red, FocusManager.crownstoneState.powerUsage / 4000).hex}
          />
          <View style={{flex:1}} />
          <StatusIndicator
            label={'Dimmer'}
            icon={'ios-sunny'}
            iconSize={32}
            disabled={FocusManager.crownstoneMode === 'unverified'}
            pending={FocusManager.crownstoneState.dimmingAvailable === null}
            backgroundColor={FocusManager.crownstoneState.dimmingAvailable ? colors.green.hex : colors.csBlueDark.hex}
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

export function StatusIndicator(props) {
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
    <TouchableOpacity style={{alignItems:'center'}} onPress={() => { if (props.callback) { props.callback(); } }}>
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

