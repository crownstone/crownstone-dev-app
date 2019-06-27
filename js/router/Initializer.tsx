
import * as React from 'react'; import { Component } from 'react';
import {
  Platform,
} from 'react-native';
import { StoreManager }    from './store/storeManager'
import { BackgroundProcessHandler } from '../backgroundProcesses/BackgroundProcessHandler'
import SplashScreen        from 'react-native-splash-screen'
import { Splash }          from "../views/startupViews/Splash";
import { core } from "../core";
import { NavigationUtil } from "../util/NavigationUtil";
import { Stacks } from "./Stacks";


export class Initializer extends Component<any, any> {
  unsubscribe = [];

  constructor(props) {
    super(props);

    let startUp = () => {
      if (Platform.OS === "android") {
        SplashScreen.hide();
      }
      NavigationUtil.setRoot(Stacks.searchingForCrownstones());
    };

    if (BackgroundProcessHandler.storePrepared === true) {
      startUp();
    }
    else {
      this.unsubscribe.push(
        core.eventBus.on('storePrepared', () => {
          startUp();
        })
      );
    }
  }


  componentWillUnmount() { // cleanup
    this.cleanUp();
  }



  cleanUp() {
    this.unsubscribe.forEach((callback) => {callback()});
    this.unsubscribe = [];
  }

  render() {
    return <Splash />;
  }
}

