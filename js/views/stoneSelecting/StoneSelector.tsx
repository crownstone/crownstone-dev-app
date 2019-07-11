import { LiveComponent } from "../LiveComponent";
import { availableScreenHeight, colors, screenWidth, styles } from "../styles";
import * as React from "react";
import {
  Text,
  TextStyle,
  ViewStyle,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  View, TextInput, Platform
} from "react-native";
import { TopBarUtil } from "../../util/TopBarUtil";
import { NativeBus } from "../../native/libInterface/NativeBus";
import { Background } from "../components/Background";
import Slider from '@react-native-community/slider';
import { SlideInView } from "../components/animated/SlideInView";
import { core } from "../../core";
import { NavigationUtil } from "../../util/NavigationUtil";
import { Stacks } from "../../router/Stacks";
import { Bluenet } from "../../native/libInterface/Bluenet";

let smallText : TextStyle = { fontSize:12, paddingLeft:10, paddingRight:10};


export class StoneSelector extends LiveComponent<any, any> {
  static options(props) {
    return TopBarUtil.getOptions({title:"Select Crownstone", nav: {id: 'stop', text:'Pause'}, leftNav: {id:'sort', text:'Sorted'}})
  }

  unsubscribe = [];
  refreshTimeout = null;
  doUpdate = false;
  data : any;
  scanning = false;
  HFscanning = false;
  HFTimeout;

  constructor(props) {
    super(props);

    this.state = {
      rssiFilter: -100,
      verified: true,
      unverified: true,
      setup: true,
      dfu: true,
      tracking: null,
      sorting: true,
      handleFilter: "",
      showHandleFilter: false,
    };

    this.refresh();
  }

  navigationButtonPressed({ buttonId }) {
    switch (buttonId) {
      case 'stop':
        this.stopScanning();
        TopBarUtil.updateOptions(this.props.componentId,{nav: {id: 'scan', text:'Scan'}});
        break;
      case 'scan':
        this.refresh();
        this.startScanning();
        TopBarUtil.updateOptions(this.props.componentId,{nav: {id: 'stop', text:'Pause'}});
        break;
      case 'sort':
        this.refresh;
        this.startScanning();
        TopBarUtil.updateOptions(this.props.componentId,{leftNav: {id: 'sort', text: this.state.sorting ? 'Unsorted' : 'Sorted'}});
        this.setState({sorting: !this.state.sorting});
        break;


    }
  }

  componentDidMount() {
    this.startScanning();
  }

  startScanning() {
    if (this.scanning === false) {
      this.scanning = true;
      this.refresh();
      this.setRefreshTimeout();
      this.unsubscribe.push(NativeBus.on(NativeBus.topics.advertisement, (data: crownstoneAdvertisement) => {
        this.update(data, 'verified');
      }))
      this.unsubscribe.push(NativeBus.on(NativeBus.topics.unverifiedAdvertisementData, (data: crownstoneAdvertisement) => {
        this.update(data, 'unverified');
      }))
      this.unsubscribe.push(NativeBus.on(NativeBus.topics.setupAdvertisement, (data: crownstoneAdvertisement) => {
        console.log("SETUP PACKET", data.handle, data.name, data.rssi)
        this.update(data, 'setup');
      }))
      this.unsubscribe.push(NativeBus.on(NativeBus.topics.dfuAdvertisement, (data : crownstoneAdvertisement) => {
        this.startHFScanning();
        this.update(data, 'dfu');
      }))
    }
  }




  startHFScanning(timeoutMs = 0) {
    if (this.HFscanning === false) {
      this.HFscanning = true;
      Bluenet.startScanningForCrownstones();
      if (timeoutMs != 0) {
        this.HFTimeout = setTimeout(() => {
          this.stopHFScanning();
        }, timeoutMs)
      }
    }
    if (timeoutMs === 0) {
      clearTimeout(this.HFTimeout);
    }
  }

  stopHFScanning() {
    if (this.HFscanning === true) {
      clearTimeout(this.HFTimeout);
      this.HFscanning = false;
      Bluenet.startScanningForCrownstonesUniqueOnly();
    }
  }

  stopScanning() {
    this.stopHFScanning();
    this.scanning = false;
    this.unsubscribe.forEach((unsub) => { unsub(); });
    this.unsubscribe = [];
    clearTimeout(this.refreshTimeout);
  }

  setRefreshTimeout() {
    this.refreshTimeout = setTimeout(() => {
      if (this.doUpdate) {
        this.doUpdate = false;
        this.forceUpdate();
      }
      this.setRefreshTimeout()
    }, 300);
  }

  componentWillUnmount(): void {
    this.stopScanning();
  }

  update(data : crownstoneAdvertisement, type) {
    if (type === "verified" && data.serviceData.setupMode === true) { return; }

    let newStone = false;
    if (this.data[type][data.handle] === undefined) {
      newStone = true;
      this.data[type][data.handle] = data;
    }


    let previousRssi = this.data[type][data.handle].rssi;
    let newRssi = data.rssi;

    this.data[type][data.handle] = data;

    if (previousRssi >= 0) {
      if (newRssi >= 0) {
        this.data[type][data.handle].rssi = null;
      }
      else {
        this.data[type][data.handle].rssi = newRssi;
      }
    }
    else {
      if (newRssi >= 0) {
        this.data[type][data.handle].rssi = previousRssi;
      }
      else {
        this.data[type][data.handle].rssi = Math.round(0.5*newRssi + 0.5*previousRssi);;
      }
    }


    Object.keys(this.data).forEach((otherType) => {
      if (otherType === type) { return; }

      if (this.data[otherType][data.handle]) {
        delete this.data[otherType][data.handle];
      }
    })

    if (newStone) {
      this.forceUpdate();
    }
    else {
      this.doUpdate = true;
    }
  }


  refresh() {
    this.stopHFScanning();
    this.startHFScanning(500);
    this.data = {
      verified: {},
      unverified: {},
      setup: {},
      dfu: {},
    };
  }

  getCrownstones() {
    let result = [];
    let stack = [];

    let tracker = null;

    let collect = (type) => {
      if (this.state[type]) {
        Object.keys(this.data[type]).forEach((handle) => {
          if (this.state.showHandleFilter && this.state.handleFilter.length > 0) {
            if (handle.toUpperCase().indexOf(this.state.handleFilter) !== 0) {
              return;
            }
          }

          let data = this.data[type][handle];
          let rssi = data.rssi;

          if (this.state.tracking === handle) {
            tracker = { handle: handle, rssi: rssi, type: type, data: data }
            return;
          }
          if (rssi < 0 && rssi >= this.state.rssiFilter || this.state.showHandleFilter) {
            stack.push({ handle: handle, rssi: rssi, type: type, data: data });
          }
        })
      }
    }

    Object.keys(this.data).forEach((type) => {
      collect(type);
    })


    if (this.state.sorting) {
      stack.sort((a, b) => { return b.rssi - a.rssi; });
    }

    if (tracker)
    stack.unshift(tracker)

    stack.forEach((item) => {
      result.push(
        <CrownstoneEntry
          key={item.handle}
          item={item}
          tracking={item.handle === this.state.tracking}
          track={() => { this.setState({tracking: this.state.tracking === item.handle ? null : item.handle })}}
          callback={() => { NavigationUtil.setRoot( Stacks.firmwareTesting({ handle: item.handle, item: item.data, mode: item.type, name: item.data.name }))}}
        />
      );
    })
    return result;
  }

  getHandleFilter() {
    return (
      <SlideInView
        hidden={true}
        visible={this.state.showHandleFilter}
        height={50}
        style={{
          flexDirection:'row',
          width:screenWidth,
          height:50,
          ...styles.centered,
          borderBottomColor: colors.black.rgba(0.2),
          borderBottomWidth:1,
          paddingLeft:10,
          paddingRight:10
        }}>
        <Text style={{...smallText}}>Filter:</Text>
        <TextInput
          autoFocus={true}
          value={this.state.handleFilter}
          placeholder={"Handle (MAC) address filter"}
          style={{flex:1, fontSize:16}}
          onChangeText={(newText) => {
            let validString = "";
            let re = /[0-9A-Fa-f]/g;
            for (let i = 0; i < newText.length; i++) {
              if(re.test(newText[i])) {
                validString += newText[i]
              }
              re.lastIndex = 0; // be sure to reset the index after using .test()
            }
            if (Platform.OS === 'android') {
              if (validString.length > 2 && validString[2] !== ':') {
                validString = validString.substr(0, 2) + ":" + validString.substr(2)
              }
              if (validString.length > 5 && validString[4] !== ':') {
                validString = validString.substr(0, 5) + ":" + validString.substr(5)
              }
            }
            validString = validString.toUpperCase();

            this.setState({handleFilter: validString})
          }}
        />
      </SlideInView>
    );
  }

  render() {
    return (
      <Background image={core.background.light}>
        <View style={{flexDirection:'row', width:screenWidth, height:60, backgroundColor: colors.white.rgba(0.7), ...styles.centered, borderBottomColor: colors.black.rgba(0.2), borderBottomWidth:1}}>
          <View style={{flex:1}}/>
          <FilterButton label={"Setup"}      selected={this.state.setup}      callback={() => { this.setState({setup: !this.state.setup})}}/>
          <View style={{flex:1}}/>
          <FilterButton label={"Verified"}   selected={this.state.verified}   callback={() => { this.setState({verified: !this.state.verified})}}/>
          <View style={{flex:1}}/>
          <FilterButton label={"Unverified"} selected={this.state.unverified} callback={() => { this.setState({unverified: !this.state.unverified})}}/>
          <View style={{flex:1}}/>
          <FilterButton label={"DFU"} selected={this.state.dfu} callback={() => { this.setState({dfu: !this.state.dfu})}}/>
          <View style={{flex:1}}/>
          <FilterButton label={"MAC"} selected={this.state.showHandleFilter} callback={() => {
            this.setState({showHandleFilter: !this.state.showHandleFilter})
          }}/>
          <View style={{flex:1}}/>
        </View>
        <View style={{width: screenWidth, height:50, backgroundColor: colors.white.rgba(0.7), overflow:"hidden"}}>
        { this.getHandleFilter() }
        <SlideInView
          hidden={true}
          visible={!this.state.showHandleFilter}
          height={50}
          style={{flexDirection:'row', width:screenWidth, height:50,...styles.centered, borderBottomColor: colors.black.rgba(0.2), borderBottomWidth:1}}>
          <Text style={{...smallText, width:50}}>Rssi:</Text>
          <Slider
            style={{ width: screenWidth - 120, height: 40 }}
            minimumValue={-100}
            maximumValue={-30}
            step={1}
            value={this.state.rssiFilter}
            minimumTrackTintColor={colors.gray.hex}
            maximumTrackTintColor={colors.gray.hex}
            onValueChange={(value) => {
              this.setState({rssiFilter: value});
            }}
          />
          <Text style={{...smallText, width:70}}>{this.state.rssiFilter + " dB"}</Text>
        </SlideInView>
        </View>

        <ScrollView>
          <RefreshControl
            refreshing={false}
            onRefresh={() => { this.refresh() }}
            title={ "Refresh!" }
            titleColor={colors.darkGray.hex}
            colors={[colors.csBlue.hex]}
            tintColor={colors.csBlue.hex}
          />
          <View style={{minHeight: availableScreenHeight - 110}}>
            { this.getCrownstones() }
          </View>
        </ScrollView>
      </Background>
    );
  }
}


function FilterButton(props) {
  let unselectedFilter : ViewStyle = { backgroundColor: colors.white.hex, borderColor: colors.csBlue.hex, borderWidth:1, borderRadius: 18, height: 36, ...styles.centered }
  let selectedFilter : ViewStyle = { ...unselectedFilter,  backgroundColor: colors.menuTextSelected.rgba(0.75),  }

  return (
    <TouchableOpacity onPress={() => { props.callback() }} style={ props.selected ? selectedFilter : unselectedFilter}>
      <Text style={{fontSize:13, paddingLeft:10, paddingRight:10, fontWeight:'bold', color: props.selected ? colors.white.hex : colors.black.rgba(0.5) }}>{props.label}</Text>
    </TouchableOpacity>
  )
}

function CrownstoneEntry(props) {
  let backgroundColor = colors.white.rgba(0.5);
  let opacity = 0.65;
  let height = 55;
  if (props.tracking) {
    opacity = 1;
    height = 75;
  }
  let sphere = null

  switch (props.item.type) {
    case 'setup': backgroundColor = colors.menuTextSelected.rgba(opacity); break;
    case 'verified':
      backgroundColor = colors.green.rgba(opacity);
      let state = core.store.getState();
      sphere = state.spheres[props.item.data.referenceId] || null;
      break;
    case 'unverified': backgroundColor = colors.white.rgba(opacity); break;
    case 'dfu': backgroundColor = colors.purple.rgba(opacity); break;
  }

  let hasType = props.item.data && props.item.data.serviceData && props.item.data.serviceData.deviceType !== 'undefined' || false;

  return (
    <View style={{
      backgroundColor: backgroundColor,
      width: screenWidth,
      height: height,
      padding:10,
      borderBottomColor: props.tracking ? colors.black.rgba(1) :  colors.black.rgba(0.2),
      borderBottomWidth: props.tracking ? 2 : 1,
      justifyContent:'center',
    }}>
      <View style={{flex:1}} />
      <View style={{ flexDirection:'row', alignItems: 'center', }}>
        <TouchableOpacity style={{ height:height }} onPress={() => {
          if (props.item.type !== "dfu") {
            props.callback();
          }}}>
          <View style={{flex:1}} />
          <View style={{ flexDirection:'row' }}>
            <Text style={{width:60}}>{props.item.data.name}</Text>
            { !hasType || <Text>{" - "}</Text> }
            { !hasType || <Text>{props.item.data.serviceData.deviceType}</Text> }
            { sphere !== null ? <Text style={{fontSize:13, fontWeight:'bold'}}>{" (in " + sphere.config.name + ")"}</Text> : undefined}
            <View style={{flex:1}} />
          </View>
          <View style={{flex:1}} />
          <Text style={{color: colors.black.rgba(0.5), fontSize:10}}>{props.item.handle}</Text>
          <View style={{flex:1}} />
        </TouchableOpacity>
        <TouchableOpacity style={{ height:height, flex:1, justifyContent:'center'}} onPress={() => { props.track() }}>
          <Text style={{fontWeight: 'bold', textAlign:'right'}}>{props.item.rssi}</Text>
        </TouchableOpacity>
      </View>
      <View style={{flex:1}} />
    </View>
  );
}