
import { Languages } from "../../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("AnimatedLogo", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';
import {
  Animated,
  } from 'react-native';

export class AnimatedLogo extends Component<any, any> {
  baseSize : number;
  animationTimeout : any;

  constructor(props) {
    super(props);

    this.baseSize = props.size || 100;
    this.state = { size: new Animated.Value(this.baseSize) };

    this.animationTimeout = undefined;
  }

  componentDidMount() {
    this.animate();
  }

  componentWillUnmount() {
    if (this.animationTimeout !== undefined) {
      clearTimeout(this.animationTimeout);
    }
  }

  animate() {
    // we want a noticeable difference from the old size
    let newSize = this._getNewSize();

    Animated.spring(this.state.size, {toValue: newSize, friction:3}).start();

    this.animationTimeout = setTimeout(() => {this.animate();}, 1250);
  }

  _getNewSize() {
    let range = 0.5 * this.baseSize;
    return 0.6 * this.baseSize + range * Math.random();
  }

  render() {
    return (
      <Animated.Image
        source={require("../../../images/crownstoneLogo.png")}
        style={[this.props.style, {width:this.state.size, height:this.state.size}]}
      />
    );
  }
}
