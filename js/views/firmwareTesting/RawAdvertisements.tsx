import { LiveComponent } from "../LiveComponent";
import * as React from "react";
import { ScrollView, View, Text, ActivityIndicator, Alert, TouchableOpacity } from "react-native";
import { core } from "../../core";
import { colors, styles } from "../styles";
import { TopBarUtil } from "../../util/TopBarUtil";
import { AnimatedBackground } from "../components/animated/AnimatedBackground";
import { NativeBus } from "../../native/libInterface/NativeBus";
import { xUtil } from "../../util/StandAloneUtil";
import { FocusManager } from "../../backgroundProcesses/FocusManager";



export class RawAdvertisements extends LiveComponent<{
  item: crownstoneAdvertisement,
  handle: string,
  name: string,
  mode:string,
  componentId: string
}, any> {
  static options(props) {
    return TopBarUtil.getOptions({title: props.name})
  }


  rssiAverage = null;
  scanning = false;
  unsubscribe = [];

  constructor(props) {
    super(props);

    this.state = { advertisement: "",stateOfExternalCrownstone: false }

    this.startScanning();
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
    }
  }

  stopScanning() {
    this.scanning = false;
    this.unsubscribe.forEach((unsub) => { unsub(); });
    this.unsubscribe = [];
  }

  update(data: crownstoneAdvertisement, type) {
    let updateRssi = false;
    if (this.rssiAverage === null) {
      if (data.rssi < 0) {
        this.rssiAverage = data.rssi;
        updateRssi = true;
      }
    }

    let rssi = this.rssiAverage;

    if (data.rssi < 0) {
      this.rssiAverage = Math.round(0.3 * data.rssi + 0.7 * this.rssiAverage);
    }


    if (rssi !== this.rssiAverage) {
      updateRssi = true;
    }

    if (updateRssi) {
      TopBarUtil.updateOptions(this.props.componentId, { title: this.props.name + " " + this.rssiAverage })
    }

    if (type === 'verified' && data.serviceData.setupMode === true) {
      return;
    }

    if (type !== this.state.mode) {
      this.setState({mode: type})
    }

    let strData = xUtil.stringify(data);
    if (this.state.advertisement !== strData) {
      this.setState({advertisement: strData, stateOfExternalCrownstone: data.serviceData.stateOfExternalCrownstone})
    }

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
      case "dfu":
        backgroundImage = require('../../images/backgrounds/upgradeBackground.png');
        break;
    }

    return (
      <AnimatedBackground image={backgroundImage} >
        <ScrollView>
          <Text style={{fontSize: 13, backgroundColor: this.state.stateOfExternalCrownstone ? colors.green.rgba(0.6) : colors.white.rgba(0.6)}}>{this.state.advertisement}</Text>
        </ScrollView>
      </AnimatedBackground>
    )
  }
}