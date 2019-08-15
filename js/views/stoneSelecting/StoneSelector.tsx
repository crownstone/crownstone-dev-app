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
import { FocusManager } from "../../backgroundProcesses/FocusManager";
import { BroadcastStateManager } from "../../backgroundProcesses/BroadcastStateManager";
import { Component } from "react";

let smallText : TextStyle = { fontSize:12, paddingLeft:10, paddingRight:10};

const filterState = {
  plug: true,
  builtin: true,
  guidestone: true,
  builtinOne: true,
  crownstoneUSB: true,
  verified: true,
  unverified: true,
  setup: true,
  dfu: true,
}


function updateFilterState(state) {
  let keys = Object.keys(filterState);
  for (let i = 0; i < keys.length; i++) {
    filterState[keys[i]] = state[keys[i]];
  }
}


export class StoneSelector extends LiveComponent<any, any> {
  static options(props) {
    return TopBarUtil.getOptions({title:"Select Crownstone", nav: {id: 'stop', text:'Pause'}, leftNav: {id:'sort', text:'Sorted'}})
  }

  unsubscribe = [];
  refreshTimeout = null;
  doUpdate = false;
  data : any = {
    verified: {},
    unverified: {},
    setup: {},
    dfu: {},
  };
  scanning = false;
  HFTimeout;

  constructor(props) {
    super(props);

    this.state = {
      rssiFilter: -100,
      plug:          filterState.plug,
      builtin:       filterState.builtin,
      guidestone:    filterState.guidestone,
      builtinOne:    filterState.builtinOne,
      crownstoneUSB: filterState.crownstoneUSB,
      verified:      filterState.verified,
      unverified:    filterState.unverified,
      setup:         filterState.setup,
      dfu:           filterState.dfu,
      filterSelectorOnScreen: false,
      tracking: null,
      sorting: true,
      handleFilter: "",
      showHandleFilter: false,
      HFscanning: false
    };
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
    this.refresh();
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
        // console.log("SETUP PACKET", data.handle, data.name, data.rssi)
        this.update(data, 'setup');
      }))
      this.unsubscribe.push(NativeBus.on(NativeBus.topics.dfuAdvertisement, (data : crownstoneAdvertisement) => {
        this.startHFScanning();
        console.log("Got DFU packet")
        this.update(data, 'dfu');
      }))
    }
  }




  startHFScanning(timeoutMs = 0) {
    if (this.state.HFscanning === false) {
      this.setState({HFscanning: true});
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
    if (this.state.HFscanning === true) {
      clearTimeout(this.HFTimeout);
      this.setState({HFscanning: false});
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
    let state = core.store.getState();

    clearTimeout(this.refreshTimeout);
    this.refreshTimeout = setTimeout(() => {
      if (this.doUpdate) {
        this.doUpdate = false;
        this.forceUpdate(() => { this.doUpdate = false; this.setRefreshTimeout() });
        return;
      }
      this.setRefreshTimeout()
    }, state.user.fastPhone ? 300 : 1000);
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
        this.data[type][data.handle].rssi = Math.round(0.5*newRssi + 0.5*previousRssi);
      }
    }


    Object.keys(this.data).forEach((otherType) => {
      if (otherType === type) { return; }

      if (this.data[otherType][data.handle]) {
        delete this.data[otherType][data.handle];
      }
    })

    if (newStone) {
      if (this.state.filterSelectorOnScreen === false) {
        this.forceUpdate();
      }
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

    if (this.state.filterSelectorOnScreen === true) {
      return;
    }

    let tracker = null;

    let showAll = this.state.plug && this.state.builtin && this.state.builtinOne && this.state.guidestone && this.state.crownstoneUSB;

    let collect = (mode) => {
      if (this.state[mode]) {
        Object.keys(this.data[mode]).forEach((handle) => {

          if (!showAll) {
            let type = this.data[mode] && this.data[mode][handle] && this.data[mode][handle].serviceData && this.data[mode][handle].serviceData.deviceType || null;

            if (!this.state[type]) {
              return
            }
          }

          if (this.state.showHandleFilter && this.state.handleFilter.length > 0) {
            if (handle.toUpperCase().indexOf(this.state.handleFilter) !== 0) {
              return;
            }
          }

          let data = this.data[mode][handle];
          let rssi = data.rssi;

          if (this.state.tracking === handle) {
            tracker = { handle: handle, rssi: rssi, type: mode, data: data, sphereId: data.referenceId || null }
            return;
          }
          if (rssi < 0 && rssi >= this.state.rssiFilter || this.state.showHandleFilter) {
            stack.push({ handle: handle, rssi: rssi, type: mode, data: data, sphereId: data.referenceId || null });
          }
        })
      }
    }

    console.log(this.data)
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
          callback={() => {
            FocusManager.setHandleToFocusOn(item.handle, item.type, item.data.name);
            if (item.sphereId) {
              BroadcastStateManager._updateLocationState(item.sphereId);
              BroadcastStateManager._reloadDevicePreferences();
            }
            NavigationUtil.setRoot( Stacks.firmwareTesting({ handle: item.handle, item: item.data, mode: item.type, name: item.data.name }));
          }}
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
    updateFilterState(this.state);
    let noneModeSelected = !(this.state.setup && this.state.verified && this.state.unverified && this.state.dfu);
    let noneTypeSelected = !(this.state.plug && this.state.builtin && this.state.builtinOne && this.state.guidestone && this.state.crownstoneUSB);

    return (
      <Background image={core.background.light}>
        <SlideInView
          hidden={true}
          visible={this.state.filterSelectorOnScreen}
          height={availableScreenHeight}
          style={{width:screenWidth, height: availableScreenHeight,...styles.centered}}>
          <View style={{flex:1, maxHeight:30}}/>
          <Text style={{fontSize:20, fontWeight: 'bold'}}>Select Filters:</Text>
          <View style={{flex:1}}/>
          <View style={{flexDirection: 'row', width: screenWidth*0.9}}>
            <View style={{flex:1,width:0.45*screenWidth, alignItems:'center'}}>
              <Text style={{fontSize:16, fontWeight: 'bold'}}>Mode:</Text>
              <BigFilterButton label={"Setup"}       selected={this.state.setup}      callback={() => { this.setState({setup: !this.state.setup})}}/>
              <BigFilterButton label={"Verified"}    selected={this.state.verified}   callback={() => { this.setState({verified: !this.state.verified})}}/>
              <BigFilterButton label={"Unverified"}  selected={this.state.unverified} callback={() => { this.setState({unverified: !this.state.unverified}) }}/>
              <BigFilterButton label={"DFU"}         selected={this.state.dfu}        callback={() => { this.setState({dfu: !this.state.dfu})}}/>
            </View>
            <View style={{flex:1,width:0.5*screenWidth, alignItems:'center'}}>
              <Text style={{fontSize:16, fontWeight: 'bold'}}>Type:</Text>
              <BigFilterButton label={"Plug"}          selected={this.state.plug}          callback={() => { this.setState({plug: !this.state.plug})}}/>
              <BigFilterButton label={"Built-in Zero"} selected={this.state.builtin}       callback={() => { this.setState({builtin: !this.state.builtin})}}/>
              <BigFilterButton label={"Built-in One"}  selected={this.state.builtinOne}    callback={() => { this.setState({builtinOne: !this.state.builtinOne}) }}/>
              <BigFilterButton label={"Guidestone"}    selected={this.state.guidestone}    callback={() => { this.setState({guidestone: !this.state.guidestone})}}/>
              <BigFilterButton label={"USB"}           selected={this.state.crownstoneUSB} callback={() => { this.setState({crownstoneUSB: !this.state.crownstoneUSB})}}/>
            </View>
          </View>

          <View style={{flexDirection: 'row', width: screenWidth*0.9}}>
            <View style={{flex:1,width:0.45*screenWidth, alignItems:'center'}}>
              <BigFilterButton
                label={noneModeSelected ? "All" : "None"}
                selected={false}
                callback={() => {
                  if (noneModeSelected) {
                    this.setState({ dfu: true, setup: true, verified: true, unverified: true })
                  }
                  else {
                    this.setState({ dfu: false, setup: false, verified: false, unverified: false })
                  }
                }}
              />
            </View>
            <View style={{flex:1,width:0.5*screenWidth, alignItems:'center'}}>
              <BigFilterButton
                label={noneTypeSelected ? "All" : "None"}
                selected={false}
                callback={() => {
                  if (noneTypeSelected) {
                    this.setState(({plug: true, builtin: true, builtinOne: true, guidestone: true, crownstoneUSB: true}))
                  }
                  else {
                    this.setState(({plug: false, builtin: false, builtinOne: false, guidestone: false, crownstoneUSB: false}))
                  }
                }}
              />
            </View>
          </View>
          <View style={{flex:1}}/>
          <TouchableOpacity
            onPress={() => { this.setState({filterSelectorOnScreen: false}); this.startScanning() }}
            style={{padding:15, width: 0.75*screenWidth, ...styles.centered, borderRadius: 30, backgroundColor: colors.green.hex}}
          >
            <Text style={{fontSize:20, fontWeight: 'bold'}}>Let's go!</Text>
          </TouchableOpacity>
          <View style={{flex:1, maxHeight:30}}/>
        </SlideInView>
        <View style={{flexDirection:'row', width:screenWidth, height:60, backgroundColor: colors.white.rgba(0.7), ...styles.centered, borderBottomColor: colors.black.rgba(0.2), borderBottomWidth:1}}>
          <View style={{flex:1, maxWidth:15}}/>
          <FilterButton label={"Filters"}      selected={false}      callback={() => { this.setState({filterSelectorOnScreen: true})}}/>
          <View style={{flex:1}}/>
          <FilterButton label={"HF Scanning"} selected={this.state.HFscanning} callback={() => {
            if (this.state.HFscanning === false) {
              this.startHFScanning(2000);
            }
            else {
              this.stopHFScanning()
            }
          }}/>
          <View style={{flex:1}}/>
          <FilterButton label={"MAC"} selected={this.state.showHandleFilter} callback={() => {
            this.setState({showHandleFilter: !this.state.showHandleFilter})
          }}/>
          <View style={{flex:1, maxWidth:15}}/>
        </View>
        <View style={{width: screenWidth, height:50, backgroundColor: colors.white.rgba(0.7), overflow:"hidden"}}>
          { this.getHandleFilter() }
          <SlideInView
            hidden={true}
            visible={!this.state.showHandleFilter}
            height={50}
            style={{flexDirection:'row', width:screenWidth, height: 50,...styles.centered, borderBottomColor: colors.black.rgba(0.2), borderBottomWidth:1}}>
            <Text style={{...smallText, width: 50}}>Rssi:</Text>
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


function BigFilterButton(props) {
  let unselectedFilter : ViewStyle = { backgroundColor: colors.white.hex, borderColor: colors.csBlue.hex, borderWidth:1, borderRadius: 20, height: 40, marginVertical:5, width: 0.45*screenWidth-20, ...styles.centered }
  let selectedFilter : ViewStyle = { ...unselectedFilter,  backgroundColor: colors.menuTextSelected.rgba(0.75),  }

  return (
    <TouchableOpacity onPress={() => { props.callback() }} style={ props.selected ? selectedFilter : unselectedFilter}>
      <Text style={{fontSize:14, fontWeight:'bold', color: props.selected ? colors.white.hex : colors.black.rgba(0.5) }}>{props.label}</Text>
    </TouchableOpacity>
  )
}

class CrownstoneEntry extends Component<any, any> {

  cachedCid=null;

  render() {
    let backgroundColor = colors.white.hex;
    let opacity = 0.65;
    let height = 55;
    if (this.props.tracking) {
      opacity = 1;
      height = 75;
    }
    let sphere = null

    switch (this.props.item.type) {
      case 'setup':
        backgroundColor = colors.menuTextSelected.rgba(opacity);
        break;
      case 'verified':
        backgroundColor = colors.green.rgba(opacity);
        let state = core.store.getState();
        sphere = state.spheres[this.props.item.data.referenceId] || null;
        break;
      case 'unverified':
        backgroundColor = colors.white.hex;
        break;
      case 'dfu':
        backgroundColor = colors.purple.rgba(opacity);
        break;
    }

    let hasType = this.props.item.data && this.props.item.data.serviceData && this.props.item.data.serviceData.deviceType !== 'undefined' || false;
    let hasCid = this.props.item.data && this.props.item.data.serviceData && this.props.item.data.serviceData.crownstoneId || false;

    let str = "";
    if (sphere !== null) {
      str = " (in " + sphere.config.name;
    } else {
      this.cachedCid = null;
    }
    if (hasCid !== false && this.props.item.data && this.props.item.data.serviceData.stateOfExternalCrownstone === false) {
      this.cachedCid = hasCid;
    }
    if (this.cachedCid !== null) {
      str += ":" + this.cachedCid;
    }

    if (sphere !== null) {
      str = str + ")";
    }


    return (
      <View style={{
        backgroundColor: backgroundColor,
        width: screenWidth,
        height: height,
        padding: 10,
        borderBottomColor: this.props.tracking ? colors.black.rgba(1) : colors.black.rgba(0.2),
        borderBottomWidth: this.props.tracking ? 2 : 1,
        justifyContent: 'center',
      }}>
        <View style={{ flex: 1 }}/>
        <View style={{ flexDirection: 'row', alignItems: 'center', }}>
          <TouchableOpacity style={{ height: height }} onPress={() => {
            this.props.callback();
          }}>
            <View style={{ flex: 1 }}/>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ width: 60 }}>{this.props.item.data.name}</Text>
              {!hasType || <Text>{" - "}</Text>}
              {!hasType || <Text>{this.props.item.data.serviceData.deviceType}</Text>}
              {sphere !== null ? <Text style={{ fontSize: 13, fontWeight: 'bold' }}>{str}</Text> : undefined}
              <View style={{ flex: 1 }}/>
            </View>
            <View style={{ flex: 1 }}/>
            <Text style={{ color: colors.black.rgba(0.5), fontSize: 10 }}>{this.props.item.handle}</Text>
            <View style={{ flex: 1 }}/>
          </TouchableOpacity>
          <TouchableOpacity style={{ height: height, flex: 1, justifyContent: 'center' }} onPress={() => {
            this.props.track()
          }}>
            <Text style={{ fontWeight: 'bold', textAlign: 'right' }}>{this.props.item.rssi}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}/>
      </View>
    );
  }
}