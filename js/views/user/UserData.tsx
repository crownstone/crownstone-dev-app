import * as React from 'react'; import { Component } from 'react';

import { core } from "../../core";
import { TopBarUtil } from "../../util/TopBarUtil";
import { UserDataLogin } from "./UserDataLogin";
import { UserDataSpheres } from "./UserDataSpheres";
import { BackgroundProcessHandler } from "../../backgroundProcesses/BackgroundProcessHandler";
import { LiveComponent } from "../LiveComponent";
import { AppUtil } from "../../util/AppUtil";


export class UserData extends LiveComponent<any, any> {
  static options(props) {
    return TopBarUtil.getOptions({title:"Crownstone User"})
  }

  constructor(props) {
    super(props);
    this.state = {loggedIn: core.sessionMemory.loginEmail !== null || BackgroundProcessHandler.userLoggedIn};

    if (this.state.loggedIn) {
      this.showLogOut()
    }
  }

  navigationButtonPressed({buttonId}) {
    if (buttonId === 'logOut') {
      AppUtil.logOut(core.store, {title:'Log out?', body:"The app will reset and close."});
    }
  }

  showLogOut() {
    TopBarUtil.updateOptions(this.props.componentId, {title:"Crownstone User", nav: {id:'logOut', text:'Log out'}})
  }

  hidelogOut() {
    TopBarUtil.replaceOptions(this.props.componentId, {title:"Crownstone User"})
  }

  componentDidUpdate(prevProps: Readonly<any>, prevState: Readonly<any>, snapshot?: any): void {
    if (prevState.loggedIn === false && this.state.loggedIn === true) {
      this.showLogOut()
    }
  }

  render() {
    if (!this.state.loggedIn) {
      return <UserDataLogin loggedIn={() => { this.setState({loggedIn: true})}} />
    }
    else {
      return <UserDataSpheres />
    }
  }
}


