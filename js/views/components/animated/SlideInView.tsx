
import { Languages } from "../../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("SlideInView", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';
import {
  Animated, View
} from "react-native";

export class SlideInView extends Component<any, any> {
  visible : boolean;

  constructor(props) {
    super(props);

    this.visible = props.visible || false;
    this.state = {show: this.visible, viewHeight: new Animated.Value(props.visible ? (props.height || (props.style && props.style.height)) : 0)};
  }

  componentWillUpdate(nextProps) {
    if (this.visible !== nextProps.visible) {
      if (nextProps.visible === true) {
        this.setState({show:true}, () => {
          Animated.timing(this.state.viewHeight, {
            toValue: (nextProps.height || (nextProps.style && nextProps.style.height)),
            delay: this.props.delay || 0,
            duration:this.props.duration || 200
          }).start();
        })
      }
      else {
        Animated.timing(this.state.viewHeight, {
          toValue: 0,
          delay: this.props.delay || 0,
          duration: this.props.duration || 200
        }).start(() => {
          this.setState({show: false})
        });
      }
      this.visible = nextProps.visible;
    }
  }

  render() {
    if (this.props.hidden) {
      // this will be the processing view after initialization.
      if (this.state.show === true) {
        return (
          <Animated.View style={[this.props.style, {overflow:'hidden', height: this.state.viewHeight}]}>
            {this.props.children}
          </Animated.View>
        );
      }
      return <View />;

    }
    else {
      return (
        <Animated.View style={[this.props.style, {overflow:'hidden', height: this.state.viewHeight}]}>
          {this.props.children}
        </Animated.View>
      );
    }
  }
}
