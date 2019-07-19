
import { Languages } from "../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("BleStateOverlay", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text, TouchableOpacity, TouchableWithoutFeedback,
  View
} from "react-native";

import { OverlayBox } from '../components/overlays/OverlayBox'
import { colors, screenHeight, screenWidth, styles } from "../styles";
import { InterviewTextInput } from "../components/InterviewComponents";
import { NavigationUtil } from "../../util/NavigationUtil";


export class NumericOverlay extends Component<any, any> {
  unsubscribe : any;

  constructor(props) {
    super(props);
    this.state = {
      visible: false,
      value: props.data.value || null
    };
    this.unsubscribe = [];
  }

  componentDidMount() {
    this.setState({ visible: true });
  }


  _getTitle() {
    return this.props.data.title;
  }

  _getText() {
    return this.props.data.text;
  }

  render() {
    return (
      <TouchableOpacity activeOpacity={1.0} onPress={() => { Keyboard.dismiss() }} style={styles.centered}>
        <OverlayBox
          visible={this.state.visible}
          overrideBackButton={false}
          canClose={true}
          closeCallback={() => {
            this.setState({ visible: false, value: null });
            NavigationUtil.closeOverlay(this.props.componentId);
          }}
        >
          <TouchableOpacity activeOpacity={1.0} onPress={() => { Keyboard.dismiss() }} style={{flex:1, alignItems:'center', justifyContent:'center'}}>
          <View style={{flex:0.5}} />
          <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.blue.hex, padding:15}}>{this._getTitle()}</Text>
          <View style={{flex:0.5}} />
          <InterviewTextInput
            autofocus={true}
            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
            placeholder={ "set value" }
            value={this.state && this.state.value || this.props.data.value}
            callback={(newValue) => {
              this.setState({value: newValue});
            }}
            onBlur={() => { console.log("BLUR")}}
          />
          <View style={{flex:0.5}} />
          <Text style={{fontSize: 12, fontWeight: '400',  color: colors.blue.hex, padding:15, textAlign:'center'}}>
            {this._getText()}
          </Text>
          <View style={{flex:1}} />
          <TouchableOpacity
            onPress={() => {
              if (this.state.value !== null) {
                this.props.data.callback(this.state.value)
              }
              else {
                this.setState({ visible: false, value: null })
                NavigationUtil.closeOverlay(this.props.componentId);
              }
            }}
            style={[styles.centered, {
              width: 0.4 * screenWidth,
              height: 36,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: colors.blue.rgba(0.5),
            }]}>
            <Text style={{fontSize: 12, fontWeight: 'bold', color: colors.blue.hex}}>{"Set!"}</Text>
          </TouchableOpacity>
          <View style={{height:30}} />
          </TouchableOpacity>
        </OverlayBox>
      </TouchableOpacity>
    );
  }
}