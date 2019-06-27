
import { Languages } from "../../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("DeviceEntry", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';
import {
  TouchableOpacity,
  Text,
  View} from "react-native";

import { Icon } from '../Icon';
import { styles, colors}        from '../../styles'
import {AnimatedCircle} from "../animated/AnimatedCircle";
import { core } from "../../../core";


export class DeviceEntryBasic extends Component<any, any> {
  baseHeight : number;

  constructor(props) {
    super(props);

    this.baseHeight = props.height || 80;
  }

  _getIcon(stone) {
    let color = this.props.iconColor || colors.green.rgba(0.8);
    return (
      <AnimatedCircle size={60} color={color}>
        <Icon name={stone.config.icon} size={35} color={'#ffffff'} />
      </AnimatedCircle>
    );
  }


  render() {
    let state = core.store.getState();
    let stone = state.spheres[this.props.sphereId].stones[this.props.stoneId];
    return (
      <View style={[styles.listView,{flexDirection: 'column', height: this.baseHeight, overflow:'hidden', backgroundColor: this.props.backgroundColor || colors.white.rgba(0.9)}]}>
        <View style={{flexDirection: 'row', height: this.baseHeight, paddingRight: 0, paddingLeft: 0, flex: 1}}>
          <TouchableOpacity style={{paddingRight: 20, height: this.baseHeight, justifyContent: 'center'}} onPress={() => { this.props.callback(); }}>
            {this._getIcon(stone) }
          </TouchableOpacity>
          <TouchableOpacity style={{flex: 1, height: this.baseHeight, justifyContent: 'center'}} onPress={() => { this.props.callback(); }}>
            <View style={{flexDirection: 'column'}}>
              <Text style={{fontSize: 17, fontWeight: '100'}}>{stone.config.name}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}
