import * as React from 'react'; import { Component } from 'react';
import { Animated } from 'react-native';
import { screenHeight, screenWidth } from "../../styles";

export class SlideInFromBottomView extends Component<any, any> {
  visible : boolean;

  constructor(props) {
    super(props);

    this.state = {viewTopOffset: new Animated.Value(props.visible ? screenHeight - props.height : screenHeight)};
    this.visible = props.visible || false;
  }

  componentWillUpdate(nextProps) {
    if (this.visible !== nextProps.visible) {
      if (nextProps.visible === true) {
        Animated.timing(this.state.viewTopOffset, {toValue: screenHeight - nextProps.height, duration:150}).start();
      }
      else {
        Animated.timing(this.state.viewTopOffset,  {toValue: screenHeight, duration:150}).start();
      }
      this.visible = nextProps.visible;
    }
  }

  render() {
    return (
      <Animated.View style={[this.props.style, {position:'absolute', top: this.state.viewTopOffset, left:0, width: screenWidth, overflow:'hidden', height: this.props.height}]}>
        {this.props.children}
      </Animated.View>
    );
  }
}
