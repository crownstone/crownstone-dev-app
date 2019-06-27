
import { Languages } from "../../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("TextEditInput", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';
import {
  Keyboard,
  TextInput,
} from 'react-native';
import { core } from "../../../core";


export class TextEditInput extends Component<any, any> {
  isInFocus : boolean;
  initialized : boolean;
  refName : string;
  blurListener : any;
  unsubscribe : any;
  blurValue : string;
  focusEmitted : boolean = false;

  constructor(props) {
    super(props);
    this.initialized = false;
    this.blurValue = undefined;
    this.isInFocus = false;
    this.refName = (Math.random() * 1e9).toString(36);

    // make sure we submit the data if the keyboard is hidden.
    this.blurListener = Keyboard.addListener('keyboardDidHide', () => { this._blur(); });
    this.unsubscribe  = core.eventBus.on("inputComplete",            () => { this._blur(); });
  }

  componentWillUnmount() {
    if (this.isInFocus === true) {
      this._blur();
    }
    this.unsubscribe();
    this.blurListener.remove();
  }

  componentDidMount() {
    if (this.props.focusOnMount) {
      this.focus();
    }
  }

  focus() {
    (this.refs[this.refName] as any).focus()

  }

  blur() {
    (this.refs[this.refName] as any).blur()
  }

  _focus() {
    this.isInFocus   = true;
    this.initialized = true;
    this.blurValue   = undefined;
    if (!this.props.autoFocus) {
      (this.refs[this.refName] as any).measure((fx, fy, width, height, px, py) => {
        core.eventBus.emit("focus", py+height);
        this.focusEmitted = true;
      })
    }
  }

  _blur() {
    if (this.initialized) {
      if (this.blurValue !== this.props.value || this.focusEmitted === true) {
        this.blurValue = this.props.value;
        this.isInFocus = false;
        if (this.props.__validate) {
          this.props.__validate(this.props.value);
        }
        if (this.props.endCallback) {
          this.props.endCallback(this.props.value);
        }
        core.eventBus.emit('blur');
        this.focusEmitted = false;
      }
    }
  }

  _checkForEnter(newValue) {
    if (this.props.submitOnEnter === true) {
      if (newValue) {
        if (newValue.indexOf('\n') !== -1) {
          setTimeout(() => { (this.refs[this.refName] as any)._blur(); },0);
          return newValue.replace('\n','');
        }
      }
    }
    return newValue;
  }

  render() {
    return (
      <TextInput
        ref={this.refName}
        autoFocus={this.props.autoFocus || false}
        autoCapitalize={this.props.secureTextEntry ? undefined : this.props.autoCapitalize || 'words'}
        autoCorrect={  false }
        keyboardType={ this.props.visiblePassword ? 'visible-password' : (this.props.keyboardType || 'default')}
        blurOnSubmit={ this.props.blurOnSubmit || (this.props.multiline !== false)}
        maxLength={    this.props.maxLength }
        multiline={    this.props.multiline }
        onEndEditing={   () => { this._blur(); }}
        onBlur={         () => { this._blur(); }}
        onSubmitEditing={() => { this._blur(); }}
        onChangeText={   (newValue) => {
          if (this.props.maxLength && newValue) {
            if (newValue.length > this.props.maxLength) {
              newValue = newValue.substr(0, this.props.maxLength)
            }
          }

          let updatedValue = this._checkForEnter(newValue);
          this.props.callback(updatedValue);
        }}
        onFocus={() => {this._focus();}}
        placeholder={this.props.placeholder || this.props.label}
        placeholderTextColor={this.props.placeholderTextColor}
        returnKeyType={this.props.returnKeyType}
        style={[{flex:1, fontSize:16}, this.props.style]}
        secureTextEntry={this.props.secureTextEntry}
        defaultValue={this.props.value}
        // value={this.props.value}
      />
    );
  }
}
