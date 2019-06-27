
import { Languages } from "../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("Splash", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';
import { Background } from './../components/Background'

export class Splash extends Component<any, any> {
  render() {

    return (
      <Background fullScreen={true} image={require('../../images/backgrounds/devAppBackground.png')} shadedStatusBar={true} hideOrangeBar={true}>
      </Background>
    )
  }
}