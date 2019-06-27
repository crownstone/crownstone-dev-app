
import { Languages } from "../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("LockOverlay", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';

import { OverlayBox }           from '../components/overlays/OverlayBox'
import { colors, screenWidth, screenHeight } from "../styles";
import { core } from "../../core";
import { NavigationUtil } from "../../util/NavigationUtil";

export class SimpleOverlay extends Component<any, any> {
  unsubscribe : any;
  customContent : Component;
  callback : any;
  selection : string[];
  getItems : () => any[];

  constructor(props) {
    super(props);
    this.state = {
      visible: false,
      backgroundColor: props.data.backgroundColor || null,
    };
    this.unsubscribe = [];

    this.customContent = props.data.content || null;
  }

  componentDidMount() {
    this.setState({ visible: true });
    this.unsubscribe.push(core.eventBus.on("hideCustomOverlay", () => {
      this.close();
    }));
  }

  componentWillUnmount() {
    this.unsubscribe.forEach((callback) => {callback()});
    this.unsubscribe = [];
  }


  close() {
    this.customContent = null;
    this.setState({
      visible:false,
      backgroundColor:null
    }, () => {  NavigationUtil.closeOverlay(this.props.componentId); });
  }

  render() {
    let idealAspectRatio = 1.75;
    let width = 0.88*screenWidth;
    let height = Math.max( Math.min(0.9*screenHeight, 520), Math.min(width*idealAspectRatio, 0.9 * screenHeight));

    return (
      <OverlayBox
        visible={this.state.visible}
        height={height} width={width}
        overrideBackButton={false}
        canClose={true}
        scrollable={true}
        closeCallback={() => { this.close(); }}
        backgroundColor={this.state.backgroundColor || colors.white.rgba(0.2)}
        title={this.state.title}
      >
        { this.customContent }
      </OverlayBox>
    );
  }
}



