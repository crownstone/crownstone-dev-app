import * as React from 'react'; import { Component } from 'react';


import { core } from "../../core";
import { availableScreenHeight, colors, screenHeight, screenWidth, styles, topBarHeight } from "../styles";
import { Background } from "../components/Background";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { IconCircle } from "../components/IconCircle";


export class UserDataSpheres extends Component<any, any> {
  constructor(props) {
    super(props);
  }


  getSpheres() {
    let result = [];

    let state = core.store.getState();
    let spheres = state.spheres;
    let sphereIds = Object.keys(spheres);

    let sortedSphereIds = [];

    sphereIds.forEach((sphereId) => {
      sortedSphereIds.push({name: spheres[sphereId].config.name, id: sphereId})
    })

    sortedSphereIds.sort((a,b) => { return a.name < b.name ? -1 : 1 })

    sortedSphereIds.forEach((sphereData) => {
      let sphereId = sphereData.id;
      result.push(
        <SphereEntry
          key={sphereId}
          sphere={spheres[sphereId]}
          sphereId={sphereId}
          callback={() => {
            core.sessionMemory.usingSphereForSetup = sphereId; this.forceUpdate();
          }}
        />
      );
    })


    return result;
  }

  render() {
    let state = core.store.getState();
    return (
      <Background image={core.background.light} keyboardAvoid={true}>
        <ScrollView keyboardShouldPersistTaps="never" style={{width: screenWidth, height:availableScreenHeight}}>
          <View style={{flexDirection:'column', alignItems:'center', justifyContent: 'center', minHeight: availableScreenHeight, width: screenWidth}}>
            <View style={{height:30, width:screenWidth}} />
            <Text style={{fontSize:30, fontWeight:"bold"}}>{"Logged in as:"}</Text>
            <View style={{height:20, width:screenWidth}} />
            <Text style={{fontSize:26}}>{core.sessionMemory.loginEmail || state.user.email}</Text>
            <View style={{height:40, width:screenWidth}} />
            <Text style={{fontSize:14, fontWeight:'bold'}}>{"Which Sphere should be used for setup?"}</Text>
            <View style={{height:10, width:screenWidth}} />
            <View style={{width:screenWidth, height:1, backgroundColor: colors.black.rgba(0.2)}} />
            { this.getSpheres() }
            <View style={{flex: 1, width:screenWidth, minHeight:30}} />
          </View>
        </ScrollView>
      </Background>
    );
  }
}



function SphereEntry(props) {
  let backgroundColor = colors.white.rgba(0.5);
  if (core.sessionMemory.usingSphereForSetup === props.sphereId) {
    backgroundColor = colors.menuTextSelected.rgba(0.7)
  }
  let height = 70;

  return (
    <TouchableOpacity style={{
      backgroundColor: backgroundColor,
      flexDirection: 'row',
      width: screenWidth,
      height: height,
      padding:10,
      borderBottomColor: colors.black.rgba(0.2),
      borderBottomWidth: 1,
      justifyContent:'center',
      alignItems:'center',
    }} onPress={() => { props.callback(); }}>
      <IconCircle icon={'c1-sphere'} backgroundColor={colors.csBlueDark.hex} color={colors.white.hex} iconSize={32} size={50}  />
      <View style={{width:50}} />
      <Text style={{fontSize:16}}>{props.sphere.config.name}</Text>
      <View style={{flex:5}} />
    </TouchableOpacity>
  );
}