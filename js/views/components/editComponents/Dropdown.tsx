
import { Languages } from "../../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("Dropdown", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';
import {
  Picker,
  Platform,
  TouchableHighlight,
  TouchableOpacity,
  Text,
  View
} from 'react-native';

import { SlideFadeInView }  from '../animated/SlideFadeInView'
import { styles, colors, screenWidth } from '../../styles'


export class Dropdown extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {open:false, value: props.value};
  }

  componentWillUpdate(nextProps, nextState) {
    if (nextProps.value !== this.props.value) {
      this.setState({value: nextProps.value});
    }
  }

  getLabelIfPossible() {
    if (this.props.valueLabel) {
      return this.props.valueLabel;
    }

    for (let i = 0; i < this.props.items.length; i++) {
      let item = this.props.items[i];
      if (item.value !== undefined && item.value === this.state.value) {
        if (item.label !== undefined) {
          return item.label;
        }
        else {
          return item.value;
        }
      }
    }
    for (let i = 0; i < this.props.items.length; i++) {
      let item = this.props.items[i];
       if (item.label !== undefined && item.label === this.state.value) {
        if (item.label !== undefined) {
          return item.label;
        }
        else {
          return item.value;
        }
      }
    }
  }

  getItems() {
    let items = [];
    let counter = 0;
    this.props.items.forEach((item) => {
      items.push(<Picker.Item
        label={item.label}
        value={item.value === undefined ? item.label : item.value}
        key={counter + "_dropdown_" + this.props.label}
      />);
      counter += 1;
    });
    return items;
  }

  _getButtonBar() {
    if (this.props.buttons === true) {
      return (
        <View style={{
          position:'absolute',
          flex:1,
          top:0,
          width: screenWidth,
          flexDirection:'row',
          height:50,
          backgroundColor:'#fff',
          justifyContent:'center',
          borderColor:colors.lightGray.hex,
          borderBottomWidth:1
        }}>
          <TouchableOpacity style={{flex:1, justifyContent:'center', alignItems:'flex-start', paddingLeft:15}} onPress={() => {
            this.setState({value: this.props.value, open: false});
          }}>
            <Text style={{fontSize:16, color:colors.blue.hex}}>{ lang("Cancel") }</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{flex:1, justifyContent:'center', alignItems:'flex-end', paddingRight:15}} onPress={() => {
            this.setState({open: false});
            this.props.callback(this.state.value);
          }}>
            <Text style={{fontSize:16, color:colors.blue.hex}}>{ lang("Done") }</Text>
          </TouchableOpacity>
        </View>
      )
    }
  }

  _getPicker() {
    if (Platform.OS === 'android') {
      return (
        <Picker
          selectedValue={this.props.value}
          onValueChange={(newValue) => { this.props.callback(newValue); }}
        >
        {this.getItems()}
      </Picker>
    );

    }
    else {  // iOS
      let callback = (value) => {
        if (this.props.buttons !== true) {
          this.setState({open: false, value: value});
          this.props.callback(value);
        }
        else {
          this.setState({value: value})
        }
      };
      return (
        <Picker key={this.props.key || this.props.label || undefined} selectedValue={this.state.value} onValueChange={callback} style={{position:'relative', top: this.props.buttons === true ? 50 : 0}}>
          {this.getItems()}
        </Picker>
      )
    }
  }

  render() {
    let dropHeight = this.props.dropdownHeight || 216;
    let totalHeight = dropHeight;
    if (this.props.buttons === true) {
      totalHeight += 50;
    }

    if (Platform.OS === 'android') {
      return (
        <View>
          <View style={[styles.listView, {height:this.props.barHeight}]}>
            <Text style={[styles.listText, this.props.labelStyle]}>{this.props.label}</Text>
            <View style={{flex:1}}>
              {this._getPicker()}
            </View>
          </View>
        </View>
      );
    }
    else {
      return (
        <View>
          <TouchableHighlight onPress={() => {
            if (this.state.open === true) {
              this.props.callback(this.state.value);
            }
            this.setState({open:!this.state.open});
          }}>
            <View style={[styles.listView, {height:this.props.barHeight}]}>
              {this.props.icon !== undefined ? <View style={[styles.centered, {width:0.12 * screenWidth, paddingRight:15}]}>{this.props.icon}</View> : undefined}
              {this.props.valueRight === true ?
                <Text style={[{fontSize:16}, this.props.labelStyle]}>{this.props.label}</Text>
                :
                <Text style={[styles.listText, this.props.labelStyle]}>{this.props.label}</Text>
              }
              <Text style={[{flex:1, fontSize:16 }, this.props.valueStyle]}>{this.getLabelIfPossible()}</Text>
            </View>
          </TouchableHighlight>
          <SlideFadeInView height={totalHeight} visible={this.state.open === true}  style={{backgroundColor:'#fff'}}>
            <View style={{position:'relative', top: -0.5*(dropHeight-this.props.barHeight), height: dropHeight}}>
              {this._getPicker()}
            </View>
            {this._getButtonBar()}
          </SlideFadeInView>
        </View>
      );
    }
  }
}
