
import { Languages } from "../../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("FadeInView", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';
import {
  Animated,
  View
} from 'react-native';
import { useState } from "react";

export class FadeInView extends Component<any, any> {
  visible : boolean;
  maxOpacity : number;
  pendingTimeout : any;

  constructor(props) {
    super(props);

    this.state = {show: props.visible || false, viewOpacity: new Animated.Value(props.visible ? 1 : 0)};
    this.visible = props.visible || false;
    this.maxOpacity = props.maxOpacity || 1;
    this.pendingTimeout = null;
  }

  componentWillUpdate(nextProps) {
    let defaultDuration = 200;
    if ((nextProps.visible !== undefined && this.visible !== nextProps.visible) || (nextProps.maxOpacity !== undefined && this.maxOpacity !== nextProps.maxOpacity)) {
      this.state.viewOpacity.stopAnimation()
      if (nextProps.visible === true) {
        this.setState({show: true});
        this.pendingTimeout = setTimeout(() => {
          this.pendingTimeout = null;
          Animated.timing(this.state.viewOpacity, {
            toValue:  nextProps.maxOpacity || this.maxOpacity,
            delay:    this.props.delay     || 0,
            duration: this.props.duration  || defaultDuration
          }).start();
        }, 0);
      }
      else {
        Animated.timing(this.state.viewOpacity, {
          toValue:  0,
          delay:    this.props.hideDelay ? (this.props.delay || 0) : 0,
          duration: this.props.duration || defaultDuration
        }).start();
        this.pendingTimeout = setTimeout(() => {
          this.pendingTimeout = null;
          this.setState({show: false});
        }, this.props.duration || defaultDuration);
      }
    }

    // set new values as the current state.
    if (nextProps.maxOpacity !== undefined) { this.maxOpacity = nextProps.maxOpacity; }
    if (nextProps.visible    !== undefined) { this.visible = nextProps.visible;       }
  }

  componentWillUnmount() {
    if (this.pendingTimeout !== null) {
      clearTimeout(this.pendingTimeout);
    }
  }

  render() {
    if (this.props.hidden) {
      // this will be the processing view after initialization.
      if (this.state.show === true) {
        return (
          <Animated.View style={[this.props.style, {overflow:'hidden', opacity:this.state.viewOpacity}]}>
            {this.props.children}
          </Animated.View>
        );
      }
      return <View />;

    }
    else {
      return (
        <Animated.View style={[this.props.style, {overflow:'hidden', opacity:this.state.viewOpacity}]}>
          {this.props.children}
        </Animated.View>
      );
    }
  }
}


export function HiddenFadeInView(props) {
  return <FadeInView {...props} hidden={true} />
}

export function FadeIn(props) {
  let [visible, setVisible] = useState(false);
  if (visible === false) {
    setTimeout(() => { setVisible(true); }, 0);
  }

  return (
    <FadeInView visible={visible} delay={props.index * 65 || 0} {...props}>
      {props.children}
    </FadeInView>
  );
}

export function HiddenFadeIn(props) {
  let [visible, setVisible] = useState(false);
  if (visible === false) {
    setTimeout(() => { setVisible(true); }, 0);
  }

  return (
    <HiddenFadeInView visible={visible} delay={props.index * 65 || 0}>
      {props.children}
    </HiddenFadeInView>
  );
}
