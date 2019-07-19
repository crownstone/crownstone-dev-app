
import { Languages } from "../../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("SwitchBar", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';
import {
  Animated,
  Text,
  View
} from 'react-native';

import {styles, colors, screenWidth, LARGE_ROW_SIZE, NORMAL_ROW_SIZE} from '../../styles'
import Slider from "@react-native-community/slider";

export class SliderBar extends Component<any, any> {
  render() {
    let navBarHeight = this.props.barHeight || NORMAL_ROW_SIZE;
    if (this.props.largeIcon)
      navBarHeight = LARGE_ROW_SIZE;
    else if (this.props.icon)
      navBarHeight = NORMAL_ROW_SIZE;

    let style = [styles.listView, {height: navBarHeight}, this.props.wrapperStyle];

    return (
      <View style={style}>
        {this.props.icon !== undefined ? <View style={[styles.centered, {width:0.12 * screenWidth, paddingRight:15}]}>{this.props.icon}</View> : undefined}
        {this.props.iconIndent === true ? <View style={[styles.centered, {width:0.12 * screenWidth, paddingRight:15}]} /> : undefined }
        <Animated.Text style={[styles.listTextLarge, this.props.style]}>{this.props.label}</Animated.Text>
        <View style={{flex:1}} />
        <Slider
          disabled={this.props.disabled || false}
          style={{ width: screenWidth - 175, height: 40 }}
          minimumValue={this.props.min}
          maximumValue={this.props.max}
          step={this.props.step || 0.05}
          value={this.props.value}
          minimumTrackTintColor={colors.gray.hex}
          maximumTrackTintColor={colors.gray.hex}
          onValueChange={(value) => {
            if (this.props.realtimeUpdate) {
              this.props.callback(value)
            }
            this.props.setActiveElement();
          }}
          onSlidingComplete={(value) => {
              this.props.setActiveElement(); this.props.callback(value)
            }
          }
        />
        <Text style={[{fontSize:12, paddingLeft:5, width: 50, textAlign:'right'}, this.props.style]} >{this.props.value < 1 ? (Math.round(100*this.props.value) * 0.01).toFixed(2) : this.props.value}</Text>
      </View>
    )
  }
}
