
import { Languages } from "../../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("ButtonBar", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';
import {
  Text,
  View,
  TouchableOpacity
} from "react-native";

import { styles, colors, screenWidth, LARGE_ROW_SIZE, NORMAL_ROW_SIZE, MID_ROW_SIZE } from "../../styles";
import { Icon } from "../Icon";
import { core } from "../../../core";


export class NumericGetSet extends Component<any, any> {
  render() {
    let barHeight = this.props.barHeight;
    if (this.props.largeIcon)
      barHeight = LARGE_ROW_SIZE;
    else if (this.props.mediumIcon)
      barHeight = MID_ROW_SIZE;
    else if (this.props.icon)
      barHeight = NORMAL_ROW_SIZE;

    return (
      <View style={[styles.listView, {height: barHeight, backgroundColor: this.props.buttonBackground || '#ffffff', width: screenWidth}]}>
        <Text style={[styles.listTextLarge, this.props.labelStyle, this.props.style]}>{this.props.label}</Text>
        <TouchableOpacity onPress={() => { this.props.getCallback() }}>
          <Text style={[{fontSize: 16}, this.props.labelStyle, this.props.style]}>{ (this.props.value || ".....") }</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{alignItems: 'center', justifyContent:'flex-start', width: 0.15 * screenWidth}} onPress={() => { this.props.getCallback() }}>
          <Icon size={32} name={"md-arrow-down"} color={colors.menuTextSelected.hex} />
        </TouchableOpacity>
        <TouchableOpacity style={{alignItems: 'center', justifyContent:'flex-end', width: 0.15 * screenWidth}} onPress={() => {
          core.eventBus.emit("showNumericOverlay",{
            value: this.props.value,
            title: "SET " + this.props.label,
            text: "Input a number and press set, or close this window.",
            callback: this.props.setCallback
          })
        }}>
          <Icon size={32} name={"md-arrow-up"} color={colors.green.hex} />
        </TouchableOpacity>
      </View>
    );
  }
}
