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
import { BluenetPromise, BluenetPromiseWrapper } from "../../native/libInterface/BluenetPromise";
import { Stacks } from "../../router/Stacks";
import { NavigationUtil } from "../../util/NavigationUtil";
import { xUtil } from "../../util/StandAloneUtil";
import { LargeExplanation } from "../components/editComponents/LargeExplanation";
import { LOG, LOGe } from "../../logging/Log";
import { BlePromiseManager } from "../../logic/BlePromiseManager";
import { ConnectionManager } from "../../backgroundProcesses/ConnectionManager";
import { FocusManager } from "../../backgroundProcesses/FocusManager";
import { StatusIndicator } from "./FirmwareTest";


const BLE_STATE_READY = "ready";
const BLE_STATE_BUSY = "busy";

const PROXY_OPTIONS = {keepConnectionOpen: true}

export class AdvancedConfig extends LiveComponent<{
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
      mode: props.mode || 'unverified',
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


  bleAction(action : (...any) => {}, props = [], type = null, resultHandler = (any) => {}, connect = true) {
    if (this.state.bleState === BLE_STATE_BUSY) {
      Toast.showWithGravity('  Bluetooth Busy!  ', Toast.SHORT, Toast.CENTER);
      return;
    }

    FocusManager.setUpdateFreeze(type);

    let promise = null;
    this.setState({bleState: BLE_STATE_BUSY})

    if (connect) {
      ConnectionManager.connectWillStart()
      let proxy = BleUtil.getProxy(this.props.handle, FocusManager.crownstoneState.referenceId || core.sessionMemory.usingSphereForSetup);
      promise = proxy.performPriority(action, props, PROXY_OPTIONS)
    }
    else {
      ConnectionManager.disconnect()
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

    if (this.state.mode === 'unverified') {
      items.push({label:"Disabled for unverified Crownstone.", type: 'info'});
    }
    else {
      items.push({label:"CONFIGS", type: 'explanation', color: explanationColor});

      items.push({
        label: 'Switchcraft Threshold',
        type: 'numericGetSet',
        value: FocusManager.crownstoneState.switchCraftThreshold || null,
        getCallback: (value) => {
          Alert.alert("Not implemented getCallback!")
        },
        setCallback: (value) => {
          Alert.alert("Not implemented setCallback!")
        }
      });

      items.push({
        label: 'Max Chip Temp',
        type: 'numericGetSet',
        value: FocusManager.crownstoneState.maxChipTemp || null,
        getCallback: (value) => {
          Alert.alert("Not implemented getCallback!")
        },
        setCallback: (value) => {
          Alert.alert("Not implemented setCallback!")
        }
      });

      items.push({label:"DIMMER", type: 'explanation', color: explanationColor});
      items.push({
        label: 'Dimmer Threshold',
        type: 'numericGetSet',
        value: FocusManager.crownstoneState.dimmerThreshold || null,
        getCallback: (value) => {
          Alert.alert("Not implemented getCallback!")
        },
        setCallback: (value) => {
          Alert.alert("Not implemented setCallback!")
        }
      });

      items.push({
        label: 'Dimmer Temp Up',
        type: 'numericGetSet',
        value: FocusManager.crownstoneState.dimmerTempUpThreshold || null,
        getCallback: (value) => {
          Alert.alert("Not implemented getCallback!")
        },
        setCallback: (value) => {
          Alert.alert("Not implemented setCallback!")
        }
      });

      items.push({
        label: 'Dimmer Temp Down',
        type: 'numericGetSet',
        value: FocusManager.crownstoneState.dimmerTempDownThreshold || null,
        getCallback: (value) => {
          Alert.alert("Not implemented getCallback!")
        },
        setCallback: (value) => {
          Alert.alert("Not implemented setCallback!")
        }
      });

      items.push({label:"POWER MEASUREMENT", type: 'explanation', color: explanationColor});
      items.push({
        label: 'Voltage Zero',
        type: 'numericGetSet',
        value: FocusManager.crownstoneState.voltageZero || null,
        getCallback: (value) => {
          Alert.alert("Not implemented getCallback!")
        },
        setCallback: (value) => {
          Alert.alert("Not implemented setCallback!")
        }
      });
      items.push({
        label: 'Current Zero',
        type: 'numericGetSet',
        value: FocusManager.crownstoneState.currentZero || null,
        getCallback: (value) => {
          Alert.alert("Not implemented getCallback!")
        },
        setCallback: (value) => {
          Alert.alert("Not implemented setCallback!")
        }
      });
      items.push({
        label: 'Power Zero',
        type: 'numericGetSet',
        value: FocusManager.crownstoneState.powerZero || null,
        getCallback: (value) => {
          Alert.alert("Not implemented getCallback!")
        },
        setCallback: (value) => {
          Alert.alert("Not implemented setCallback!")
        }
      });


      items.push({label:"ADC CONFIG", type: 'explanation', color: explanationColor});
      items.push({
        label: 'Voltage Multiplier',
        type: 'numericGetSet',
        value: FocusManager.crownstoneState.voltageMultiplier || null,
        getCallback: (value) => {
          Alert.alert("Not implemented getCallback!")
        },
        setCallback: (value) => {
          Alert.alert("Not implemented setCallback!")
        }
      });
      items.push({
        label: 'Current Multiplier',
        type: 'numericGetSet',
        value: FocusManager.crownstoneState.currentMultiplier || null,
        getCallback: (value) => {
          Alert.alert("Not implemented getCallback!")
        },
        setCallback: (value) => {
          Alert.alert("Not implemented setCallback!")
        }
      });



      items.push({label:"DEV COMMANDS", type: 'explanation', color: explanationColor});
      items.push({
        label: "Enable UART",
        type: 'button',
        style: {color:colors.menuTextSelected.hex},
        callback: () => {
          Alert.alert("Not implemented yet!")
        }
      });

    }

    if (this.state.mode === "verified") {
      let state = core.store.getState();
      let sphere = state.spheres[FocusManager.crownstoneState.referenceId];
      if (sphere) {
        items.push({ label: "In Sphere " + sphere.config.name, type: 'explanation', below: false, color: explanationColor });
      }
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
            disabled={this.state.mode === 'unverified'}
            pending={FocusManager.crownstoneState.temperature === null}
            value={FocusManager.crownstoneState.temperature + " C"}
            backgroundColor={colors.green.blend(colors.red, (FocusManager.crownstoneState.temperature - 25) / 50).hex}
          />
          <View style={{flex:1}} />
          <StatusIndicator
            label={'Power'}
            icon={'ios-flash'}
            disabled={this.state.mode === 'unverified'}
            pending={FocusManager.crownstoneState.powerUsage === null}
            value={FocusManager.crownstoneState.powerUsage + " W"}
            backgroundColor={colors.green.blend(colors.red, FocusManager.crownstoneState.powerUsage / 4000).hex}
          />
          <View style={{flex:1}} />
          <StatusIndicator
            label={'Dimmer'}
            icon={'ios-sunny'}
            iconSize={32}
            disabled={this.state.mode === 'unverified'}
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