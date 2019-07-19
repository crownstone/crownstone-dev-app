
//  bluenetIntegration.swift
//  Crownstone
//
//  Created by Alex de Mulder on 09/06/16.
//  Copyright © 2016 Facebook. All rights reserved.
//

import Foundation
import PromiseKit
import SwiftyJSON

import BluenetLib
import BluenetShared
import BluenetBasicLocalization

import WatchConnectivity

@objc(BluenetJS)
open class BluenetJS: RCTEventEmitter {

  override init() {
    super.init()
    EventEmitter.sharedInstance.registerEventEmitter(eventEmitter: self)
  }
  
  /// Base overide for RCTEventEmitter.
  ///
  /// - Returns: all supported events
  @objc open override func supportedEvents() -> [String] {
    return EventEmitter.sharedInstance.allEvents
  }
  
  @objc func rerouteEvents() {
    LOGGER.info("BluenetBridge: Called rerouteEvents")
      
    _ = AppEventBus.on("callbackUrlInvoked", { (data) -> Void in
      if let urlStr = data as? String {
        self.sendEvent(withName: "callbackUrlInvoked", body: urlStr)
      }
    })
    
    print("BluenetBridge: ----- BLUENET BRIDGE: Rerouting events")
    
    _ = GLOBAL_BLUENET.classifier.subscribe("__classifierProbabilities", callback:{ (data) -> Void in
      //print("__classifierProbabilities",data)
      if let dict = data as? NSDictionary {
        self.sendEvent(withName: "classifierProbabilities", body: dict)
      }
    })
    
    _ = GLOBAL_BLUENET.classifier.subscribe("__classifierResult", callback: { (data) -> Void in
      //print("__classifierResult",data)
      if let dict = data as? NSDictionary {
        self.sendEvent(withName: "classifierResult", body: dict)
      }
    })
    
    
    // forward the event streams to react native
    GLOBAL_BLUENET.bluenetOn("verifiedAdvertisementData", {data -> Void in
      if let castData = data as? Advertisement {
        if (castData.operationMode == .setup) {
          self.sendEvent(withName: "verifiedSetupAdvertisementData", body: castData.getDictionary())
        }
        else if (castData.operationMode == .dfu) {
          self.sendEvent(withName: "verifiedDFUAdvertisementData", body: castData.getDictionary())
        }
        else {
          self.sendEvent(withName: "verifiedAdvertisementData", body: castData.getDictionary())
        }
      }
    })
    
    GLOBAL_BLUENET.bluenetOn("bleStatus", {data -> Void in
      if let castData = data as? String {
        self.sendEvent(withName: "bleStatus", body: castData)
        
        //self.bridge.eventDispatcher().sendAppEvent(withName: "bleStatus", body: castData)
      }
    })
    
  
    GLOBAL_BLUENET.bluenetLocalizationOn("locationStatus", {data -> Void in
      if let castData = data as? String {
        self.sendEvent(withName: "locationStatus", body: castData)
      }
    })
    
    


    GLOBAL_BLUENET.bluenetOn("dfuProgress", {data -> Void in
      if let castData = data as? [String: NSNumber] {
        // data["percentage"]  = NSNumber(value: percentage)
        // data["part"]        = NSNumber(value: part)
        // data["totalParts"]  = NSNumber(value: totalParts)
        // data["progress"]    = NSNumber(value: progress)
        // data["currentSpeedBytesPerSecond"] = NSNumber(value: currentSpeedBytesPerSecond)
        // data["avgSpeedBytesPerSecond"]     = NSNumber(value: avgSpeedBytesPerSecond)
        self.sendEvent(withName: "dfuProgress", body: castData)
      }
    })
    
    GLOBAL_BLUENET.bluenetOn("setupProgress", {data -> Void in
      if let castData = data as? NSNumber {
        self.sendEvent(withName: "setupProgress", body: castData)
      }
    })

    

    
    // forward the navigation event stream to react native
    GLOBAL_BLUENET.bluenetLocalizationOn("iBeaconAdvertisement", {ibeaconData -> Void in
      var returnArray = [NSDictionary]()
      if let data = ibeaconData as? [iBeaconPacket] {
        for packet in data {
          returnArray.append(packet.getDictionary())
        }
      }
      self.sendEvent(withName: "iBeaconAdvertisement", body: returnArray)
      //self.bridge.eventDispatcher().sendAppEvent(withName: "iBeaconAdvertisement", body: returnArray)
    })
    
//      globalBluenet.bluenetLocalizationOn("lowLevelEnterRegion", {data -> Void in
//        print("BluenetBridge: lowLevelEnterRegion")
//      })
//      globalBluenet.bluenetLocalizationOn("lowLevelExitRegion", {data -> Void in
//        print("BluenetBridge: lowLevelExitRegion")
//      })
    
    GLOBAL_BLUENET.bluenetLocalizationOn("enterRegion", {data -> Void in
      print("BluenetBridge: enterRegion")
      if let castData = data as? String {
        self.sendEvent(withName: "enterSphere", body: castData)
        //self.bridge.eventDispatcher().sendAppEvent(withName: "enterSphere", body: castData)
      }
    })
    GLOBAL_BLUENET.bluenetLocalizationOn("exitRegion", {data -> Void in
      print("BluenetBridge: exitRegion")
      if let castData = data as? String {
        self.sendEvent(withName: "exitSphere", body: castData)
        //self.bridge.eventDispatcher().sendAppEvent(withName: "exitSphere", body: castData)
      }
    })
    GLOBAL_BLUENET.bluenetLocalizationOn("enterLocation", {data -> Void in
      print("BluenetBridge: enterLocation")
      if let castData = data as? NSDictionary {
        self.sendEvent(withName: "enterLocation", body: castData)
        //self.bridge.eventDispatcher().sendAppEvent(withName: "enterLocation", body: castData)
      }
    })
    GLOBAL_BLUENET.bluenetLocalizationOn("exitLocation", {data -> Void in
      print("BluenetBridge: exitLocation")
      if let castData = data as? NSDictionary {
        self.sendEvent(withName: "exitLocation", body: castData)
        //self.bridge.eventDispatcher().sendAppEvent(withName: "exitLocation", body: castData)
      }
    })
    GLOBAL_BLUENET.bluenetLocalizationOn("currentLocation", {data -> Void in
      //print("BluenetBridge: currentLocation")
      if let castData = data as? NSDictionary {
        //print("BluenetBridge: currentLocation \(castData)")
        self.sendEvent(withName: "currentLocation", body: castData)
        //self.bridge.eventDispatcher().sendAppEvent(withName: "currentLocation", body: castData)
      }
    })
  }
  
  
  
  @objc func clearKeySets() {
    GLOBAL_BLUENET.bluenet.loadKeysets(encryptionEnabled: true, keySets: [])
  }
  
  @objc func setKeySets(_ keySets: [NSDictionary], callback: RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called setKeySets")
    var sets : [KeySet] = []
    var watchSets = [String: [String: String?]]()
    
    if let castSets = keySets as? [NSDictionary] {
      for keyData in castSets {
        let adminKey     = keyData["adminKey"]  as? String
        let memberKey    = keyData["memberKey"] as? String
        let basicKey     = keyData["basicKey"]  as? String
        let localizationKey = keyData["localizationKey"] as? String
        let serviceDataKey = keyData["serviceDataKey"]  as? String
        let referenceId  = keyData["referenceId"]  as? String
        if (adminKey == nil && memberKey == nil && basicKey == nil || referenceId == nil) {
          callback([["error" : true, "data": "Missing the Keys required for Bluenet Settings. At least one of the following should be provided: adminKey, memberKey, basicKey and referenceId."]])
          return
        }
        sets.append(KeySet(adminKey: adminKey, memberKey: memberKey, basicKey: basicKey, localizationKey: localizationKey, serviceDataKey: serviceDataKey, referenceId: referenceId!))
        
        watchSets[referenceId!] = ["adminKey": adminKey, "memberKey": memberKey, "basicKey": basicKey, "localizationKey": localizationKey, "serviceDataKey": serviceDataKey]
        
      }
    }
    else {
      callback([["error" : true, "data": "Invalid keyset types"]])
      return
    }
    
    GLOBAL_BLUENET.bluenet.loadKeysets(encryptionEnabled: true, keySets: sets)
    
    GLOBAL_BLUENET.watchStateManager.loadState("keysets", watchSets)
    
    callback([["error" : false]])
  }
  
  
  @objc func isReady(_ callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called isReady")
    GLOBAL_BLUENET.bluenet.isReady()
      .done{_ -> Void in
        LOGGER.info("BluenetBridge: returned isReady")
        callback([["error" : false]]
      )}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN isReady"]])
        }
      }
  }
  
  @objc func isPeripheralReady(_ callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called isPeripheralReady")
    GLOBAL_BLUENET.bluenet.isPeripheralReady()
      .done{_ -> Void in
        LOGGER.info("BluenetBridge: returned isPeripheralReady")
        callback([["error" : false]]
        )}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN isPeripheralReady"]])
        }
    }
  }


  @objc func connect(_ handle: String, referenceId: String, callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called connect")
    GLOBAL_BLUENET.bluenet.connect(handle, referenceId: referenceId)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN connect \(err)"]])
        }
      }
  }
  
  @objc func phoneDisconnect(_ callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called phoneDisconnect")
    GLOBAL_BLUENET.bluenet.disconnect()
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN phoneDisconnect \(err)"]])
        }
      }
  }
  
  @objc func disconnectCommand(_ callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called disconnectCommand")
    GLOBAL_BLUENET.bluenet.control.disconnect()
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN disconnect \(err)"]])
        }
      }
  }
  
  @objc func toggleSwitchState(_ stateForOn: NSNumber, callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called toggleSwitchState")
    GLOBAL_BLUENET.bluenet.control.toggleSwitchState(stateForOn: stateForOn.floatValue)
      .done{newState in callback([["error" : false, "data": newState]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN toggleSwitchState \(err)"]])
        }
      }
  }
  
  @objc func setSwitchState(_ state: NSNumber, callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called setSwitchState")
    GLOBAL_BLUENET.bluenet.control.setSwitchState(state.floatValue)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN setSwitchState \(err)"]])
        }
    }
  }
  
  
  @objc func getSwitchState(_ callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called getSwitchState")
    GLOBAL_BLUENET.bluenet.state.getSwitchState()
      .done{switchState in callback([["error" : false, "data":switchState]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN getSwitchState \(err)"]])
        }
    }
  }
  
  
  
  @objc func keepAliveState(_ changeState: NSNumber, state: NSNumber, timeout: NSNumber, callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called keepAliveState")
    var changeStateBool = false
    if (changeState.intValue > 0) {
      changeStateBool = true
    }
    
    GLOBAL_BLUENET.bluenet.control.keepAliveState(changeState: changeStateBool, state: state.floatValue, timeout: timeout.uint16Value)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN keepAliveState \(err)"]])
        }
    }
  }
  
  @objc func keepAlive(_ callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called keepAlive")
    GLOBAL_BLUENET.bluenet.control.keepAliveRepeat()
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN keepAliveState \(err)"]])
        }
    }
  }
  
  
  @objc func startAdvertising() {
    LOGGER.info("BluenetBridge: Called startAdvertising")
    GLOBAL_BLUENET.bluenet.startAdvertising()
  }
  @objc func stopAdvertising() {
    LOGGER.info("BluenetBridge: Called stopAdvertising")
    GLOBAL_BLUENET.bluenet.stopAdvertising()
  }
  
  
  @objc func startScanning() {
    LOGGER.info("BluenetBridge: Called startScanning")
    GLOBAL_BLUENET.bluenet.startScanning()
  }
  
  @objc func startScanningForCrownstones() {
    LOGGER.info("BluenetBridge: Called startScanningForCrownstones")
    GLOBAL_BLUENET.bluenet.startScanningForCrownstones()
  }
  
  @objc func startScanningForCrownstonesUniqueOnly() {
    LOGGER.info("BluenetBridge: Called startScanningForCrownstonesUniqueOnly")
    GLOBAL_BLUENET.bluenet.startScanningForCrownstonesUniqueOnly()
  }
  
  @objc func stopScanning() {
    LOGGER.info("BluenetBridge: Called stopScanning")
    GLOBAL_BLUENET.bluenet.stopScanning()
  }
  
  @objc func startIndoorLocalization() {
    LOGGER.info("BluenetBridge: Called startIndoorLocalization")
    GLOBAL_BLUENET.bluenetLocalization.startIndoorLocalization()
  }
  
  @objc func stopIndoorLocalization() {
    LOGGER.info("BluenetBridge: Called stopIndoorLocalization")
    GLOBAL_BLUENET.bluenetLocalization.stopIndoorLocalization()
  }
  
  @objc func quitApp() {
    LOGGER.info("BluenetBridge: Called quitApp")
    exit(0)
  }
  
  @objc func resetBle() {
    LOGGER.info("BluenetBridge: called resetBle, do nothing, this is only used in Android")
  }
  
  @objc func requestBleState() {
    GLOBAL_BLUENET.bluenet.emitBleState()
  }
  
  @objc func requestLocation(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called requestLocation")
    let coordinates = GLOBAL_BLUENET.bluenetLocalization.requestLocation()
    var returnType = [String: NSNumber]();
    returnType["latitude"] = NSNumber(value: coordinates.latitude)
    returnType["longitude"] = NSNumber(value: coordinates.longitude)
    
    callback([["error" : false, "data": returnType]])
  }
  
  @objc func requestLocationPermission() -> Void {
    LOGGER.info("BluenetBridge: Called requestLocationPermission")
    GLOBAL_BLUENET.bluenetLocalization.requestLocationPermission()
  }
  
  @objc func trackIBeacon(_ ibeaconUUID: String, sphereId: String) -> Void {
    LOGGER.info("BluenetBridge: Called trackIBeacon \(ibeaconUUID) for sphere: \(sphereId)")
    GLOBAL_BLUENET.bluenetLocalization.trackIBeacon(uuid: ibeaconUUID, referenceId: sphereId)
  }
  
  @objc func stopTrackingIBeacon(_ ibeaconUUID: String) -> Void {
    LOGGER.info("BluenetBridge: Called stopTrackingIBeacon")
    GLOBAL_BLUENET.bluenetLocalization.stopTrackingIBeacon(ibeaconUUID)
    
  }
  
  @objc func pauseTracking() -> Void {
    LOGGER.info("BluenetBridge: Called pauseTracking")
    GLOBAL_BLUENET.bluenetLocalization.pauseTracking()
  }
  
  @objc func resumeTracking() -> Void {
    LOGGER.info("BluenetBridge: Called resumeTracking")
    GLOBAL_BLUENET.bluenetLocalization.resumeTracking()
  }
  
  @objc func startCollectingFingerprint() -> Void {
    LOGGER.info("BluenetBridge: Called startCollectingFingerprint")
    // abort collecting fingerprint if it is currently happening.
    GLOBAL_BLUENET.trainingHelper.abortCollectingTrainingData()
    
    // start collection
    GLOBAL_BLUENET.trainingHelper.startCollectingTrainingData()
  }
  
  @objc func abortCollectingFingerprint() -> Void {
    LOGGER.info("BluenetBridge: Called abortCollectingFingerprint")
    GLOBAL_BLUENET.trainingHelper.abortCollectingTrainingData()
  }
  
  @objc func pauseCollectingFingerprint() -> Void {
    LOGGER.info("BluenetBridge: Called pauseCollectingFingerprint")
    GLOBAL_BLUENET.trainingHelper.pauseCollectingTrainingData()
  }
  
  @objc func resumeCollectingFingerprint() -> Void {
    LOGGER.info("BluenetBridge: Called resumeCollectingFingerprint")
    GLOBAL_BLUENET.trainingHelper.resumeCollectingTrainingData()
  }
  
  
  @objc func finalizeFingerprint(_ sphereId: String, locationId: String, callback: RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called finalizeFingerprint \(sphereId) \(locationId)")
    
    let stringifiedFingerprint = GLOBAL_BLUENET.trainingHelper.finishCollectingTrainingData()
    if (stringifiedFingerprint != nil) {
      GLOBAL_BLUENET.classifier.loadTrainingData(locationId, referenceId: sphereId, trainingData: stringifiedFingerprint!)
      callback([["error" : false, "data": stringifiedFingerprint!]])
    }
    else {
      callback([["error" : true, "data": "No samples collected"]])
    }
  }
  
  // this  has a callback so we can chain it in a promise. External calls are always async in RN, we need this to be done before loading new beacons.
  @objc func clearTrackedBeacons(_ callback: RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called clearTrackedBeacons")
    GLOBAL_BLUENET.bluenetLocalization.clearTrackedBeacons()
    
    callback([["error" : false]])
  }
  
  
  @objc func clearFingerprints() {
    LOGGER.info("BluenetBridge: Called clearFingerprints")
    GLOBAL_BLUENET.classifier.resetAllTrainingData()
  }
  
  @objc func clearFingerprintsPromise(_ callback: RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called clearFingerprintsPromise")
    GLOBAL_BLUENET.classifier.resetAllTrainingData()
    
    callback([["error" : false]])
  }
  
  @objc func loadFingerprint(_ sphereId: String, locationId: String, fingerprint: String) -> Void {
    LOGGER.info("BluenetBridge: Called loadFingerprint \(sphereId) \(locationId) \(fingerprint)")
    GLOBAL_BLUENET.classifier.loadTrainingData(locationId, referenceId: sphereId, trainingData: fingerprint)
  }
  
  
  @objc func commandFactoryReset(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called commandFactoryReset")
    GLOBAL_BLUENET.bluenet.control.commandFactoryReset()
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN recover"]])
        }
      }
  }
  
  @objc func getHardwareVersion(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called getHardwareVersion")
    GLOBAL_BLUENET.bluenet.device.getHardwareRevision()
      .done{(harwareVersion : String) -> Void in
        callback([["error" : false, "data": harwareVersion]]
      )}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN getHardwareVersion"]])
        }
    }
  }
  
  @objc func getFirmwareVersion(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called getFirmwareVersion")
    GLOBAL_BLUENET.bluenet.device.getFirmwareRevision()
      .done{(firmwareVersion : String) -> Void in callback([["error" : false, "data": firmwareVersion]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN getFirmwareVersion"]])
        }
    }
  }
  
  @objc func getBootloaderVersion(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called getBootloaderVersion")
    GLOBAL_BLUENET.bluenet.device.getBootloaderRevision()
      .done{(bootloaderVersion : String) -> Void in callback([["error" : false, "data": bootloaderVersion]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN getBootloaderRevision"]])
        }
    }
  }

  
  @objc func getMACAddress(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called getMACAddress")
    GLOBAL_BLUENET.bluenet.setup.getMACAddress()
      .done{(macAddress : String) -> Void in callback([["error" : false, "data": macAddress]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN getMACAddress"]])
        }
      }
  }
  
  
  @objc func getErrors(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called getErrors")
    GLOBAL_BLUENET.bluenet.state.getErrors()
      .done{(errors : CrownstoneErrors) -> Void in callback([["error" : false, "data": errors.getDictionary()]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN getErrors"]])
        }
    }
  }
  
  @objc func clearErrors(_ errors: NSDictionary, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called clearErrors")
    GLOBAL_BLUENET.bluenet.control.clearError(errorDict: errors)
      .done{_ -> Void in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN clearErrors"]])
        }
    }
  }
  
  @objc func restartCrownstone(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called restartCrownstone")
    GLOBAL_BLUENET.bluenet.control.reset()
      .done{_ -> Void in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN restartCrownstone"]])
        }
    }
  }
  
  
  @objc func recover(_ crownstoneHandle: String, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called recover")
    GLOBAL_BLUENET.bluenet.control.recoverByFactoryReset(crownstoneHandle)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN recover"]])
        }
      }
  }
  
  @objc func enableExtendedLogging(_ enableLogging: NSNumber) -> Void {
    LOGGER.info("BluenetBridge: Called enableExtendedLogging")
    if (enableLogging.boolValue == true) {
      BluenetLib.LOG.setFileLevel(.VERBOSE)
      BluenetLib.LOG.setPrintLevel(.INFO)
      
      LOGGER.setFileLevel(.VERBOSE)
      LOGGER.setPrintLevel(.VERBOSE)
    }
    else {
      BluenetLib.LOG.setFileLevel(.INFO)
      BluenetLib.LOG.setPrintLevel(.INFO)
      
      LOGGER.setFileLevel(.INFO)
      LOGGER.setPrintLevel(.VERBOSE)
    }
  }
  
  @objc func enableLoggingToFile(_ enableLogging: NSNumber) -> Void {
    LOGGER.info("BluenetBridge: Called enableLoggingToFile enableLogging: \(enableLogging)")
    if (enableLogging.boolValue == true) {
      BluenetLib.LOG.setFileLevel(.INFO)
      BluenetLib.LOG.setPrintLevel(.INFO)
      
      LOGGER.setFileLevel(.INFO)
      LOGGER.setPrintLevel(.INFO)
    }
    else {
      BluenetLib.LOG.clearLogs()
      BluenetLib.LOG.setFileLevel(.NONE)
      BluenetLib.LOG.setPrintLevel(.NONE)
      
      LOGGER.clearLogs()
      LOGGER.setFileLevel(.NONE)
      LOGGER.setPrintLevel(.NONE)
    }
  }
  
  @objc func clearLogs() -> Void {
    LOGGER.info("BluenetBridge: Called clearLogs")
    BluenetLib.LOG.clearLogs()
    LOGGER.clearLogs()
  }
  
  @objc func setupCrownstone(_ data: NSDictionary, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called setupCrownstone")
    let crownstoneId       = data["crownstoneId"] as? NSNumber
    let sphereId           = data["sphereId"] as? NSNumber
    let adminKey           = data["adminKey"] as? String
    let memberKey          = data["memberKey"] as? String
    let basicKey           = data["basicKey"] as? String
    let localizationKey    = data["localizationKey"] as? String
    let serviceDataKey     = data["serviceDataKey"] as? String
    let meshNetworkKey     = data["meshNetworkKey"] as? String
    let meshApplicationKey = data["meshApplicationKey"] as? String
    let meshDeviceKey      = data["meshDeviceKey"] as? String
    let meshAccessAddress  = data["meshAccessAddress"] as? String // legacy
    let ibeaconUUID        = data["ibeaconUUID"] as? String
    let ibeaconMajor       = data["ibeaconMajor"] as? NSNumber
    let ibeaconMinor       = data["ibeaconMinor"] as? NSNumber
    
    
    if (
      crownstoneId != nil &&
        sphereId != nil &&
        adminKey != nil &&
        memberKey != nil &&
        basicKey != nil &&
        localizationKey != nil &&
        serviceDataKey != nil &&
        meshNetworkKey != nil &&
        meshApplicationKey != nil &&
        meshDeviceKey != nil &&
        meshAccessAddress != nil &&
        ibeaconUUID != nil &&
        ibeaconMajor != nil &&
        ibeaconMinor != nil) {
      GLOBAL_BLUENET.bluenet.setup.setup(
        crownstoneId: (crownstoneId!).uint16Value,
        sphereId: (sphereId!).uint8Value,
        adminKey: adminKey!,
        memberKey: memberKey!,
        basicKey: basicKey!,
        localizationKey: localizationKey!,
        serviceDataKey: serviceDataKey!,
        meshNetworkKey: meshNetworkKey!,
        meshApplicationKey: meshApplicationKey!,
        meshDeviceKey: meshDeviceKey!,
        meshAccessAddress: meshAccessAddress!,
        ibeaconUUID: ibeaconUUID!,
        ibeaconMajor: (ibeaconMajor!).uint16Value,
        ibeaconMinor: (ibeaconMinor!).uint16Value)
        .done{_ in callback([["error" : false]])}
        .catch{err in
          if let bleErr = err as? BluenetError {
            callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
          }
          else {
            callback([["error" : true, "data": "UNKNOWN ERROR IN setupCrownstone \(err) "]])
          }
      }
    }
    else {
      callback([["error" : true, "data": "Missing one of the datafields required for setup. 1\(crownstoneId != nil) 2\(sphereId != nil) 3\(adminKey != nil) 4\(memberKey != nil) 5\(basicKey != nil) 6\(localizationKey != nil) 7\(serviceDataKey != nil) 8\(meshApplicationKey != nil) 9\(meshNetworkKey != nil) 10\(meshDeviceKey != nil) 11\(meshAccessAddress != nil) 12\(ibeaconUUID != nil) 13\(ibeaconMajor != nil) 14\(ibeaconMinor != nil)"]])
    }
  }
  
  @objc func meshKeepAlive(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called meshKeepAlive")
    GLOBAL_BLUENET.bluenet.mesh.keepAliveRepeat()
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN meshKeepAlive \(err)"]])
        }
    }
  }
  
  @objc func meshKeepAliveState(_ timeout: NSNumber, stoneKeepAlivePackets: [NSDictionary], callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called meshKeepAliveState")
//    print("-- Firing meshKeepAliveState timeout: \(timeout), packets: \(stoneKeepAlivePackets)")
    GLOBAL_BLUENET.bluenet.mesh.keepAliveState(timeout: timeout.uint16Value, stones: stoneKeepAlivePackets as! [[String : NSNumber]])
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN meshKeepAliveState \(err)"]])
        }
    }
  }  
  
  @objc func multiSwitch(_ arrayOfStoneSwitchPackets: [NSDictionary], callback: @escaping RCTResponseSenderBlock) -> Void {
      GLOBAL_BLUENET.bluenet.mesh.multiSwitch(stones: arrayOfStoneSwitchPackets as! [[String : NSNumber]])
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN multiSwitch \(err)"]])
        }
    }
  }
  
  @objc func broadcastSwitch(_ referenceId: String, stoneId: NSNumber, switchState: NSNumber, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called broadcastSwitch")
    //    print("-- Firing multiSwitch arrayOfStoneSwitchPackets: \(arrayOfStoneSwitchPackets)")
    GLOBAL_BLUENET.bluenet.broadcast.multiSwitch(referenceId: referenceId, stoneId: stoneId.uint8Value, switchState: switchState.floatValue)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN broadcastSwitch \(err)"]])
        }
    }
  }
  
  
  // DFU
  
  @objc func setupPutInDFU(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called setupPutInDFU")
    GLOBAL_BLUENET.bluenet.setup.putInDFU()
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN putInDFU \(err)"]])
        }
    }
  }
  
  
  @objc func putInDFU(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called putInDFU")
    GLOBAL_BLUENET.bluenet.control.putInDFU()
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN putInDFU \(err)"]])
        }
    }
  }
  
  @objc func performDFU(_ handle: String, uri: String, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called performDFU")
    let firmwareURL = URL(fileURLWithPath: uri)
    GLOBAL_BLUENET.bluenet.dfu.startDFU(handle: handle, firmwareURL: firmwareURL)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN putInDFU \(err)"]])
        }
    }
  }
  
  @objc func setupFactoryReset(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called setupFactoryReset")
    GLOBAL_BLUENET.bluenet.setup.factoryReset()
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN putInDFU \(err)"]])
        }
    }
  }
  
  @objc func bootloaderToNormalMode(_ uuid: String, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called bootloaderToNormalMode")
    GLOBAL_BLUENET.bluenet.dfu.bootloaderToNormalMode(uuid: uuid)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN bootloaderToNormalMode \(err)"]])
        }
    }
  }

  
  @objc func setTime(_ time: NSNumber, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called setTime")
    GLOBAL_BLUENET.bluenet.control.setTime(time)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN setTime"]])
        }
    }
  }
  
  @objc func getTime(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called getTime")
    GLOBAL_BLUENET.bluenet.state.getTime()
      .done{time in callback([["error" : false, "data": time]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN setTime"]])
        }
    }
  }


  @objc func batterySaving(_ state: NSNumber) -> Void {
    let batterySavingState : Bool = state.boolValue
    LOGGER.info("BluenetBridge: batterySaving set to \(batterySavingState)")

    if (batterySavingState) {
      GLOBAL_BLUENET.bluenet.enableBatterySaving()
    }
    else {
      GLOBAL_BLUENET.bluenet.disableBatterySaving()
    }
  }

  
  @objc func setBackgroundScanning(_ state: NSNumber) -> Void {
    let backgroundScanning : Bool = state.boolValue
    print("BluenetBridge: backgroundScanning set to \(backgroundScanning)")
    LOGGER.info("BluenetBridge: backgroundScanning set to \(backgroundScanning)")
    
    GLOBAL_BLUENET.bluenet.setBackgroundOperations(newBackgroundState: backgroundScanning)
    GLOBAL_BLUENET.bluenetLocalization.setBackgroundScanning(newBackgroundState: backgroundScanning)
  }

  @objc func addSchedule(_ data: NSDictionary, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called addSchedule")
    let nextTime               = data["nextTime"]           as? NSNumber
    let switchState            = data["switchState"]        as? NSNumber
    let fadeDuration           = data["fadeDuration"]       as? NSNumber
    let intervalInMinutes      = data["intervalInMinutes"]  as? NSNumber
    let ignoreLocationTriggers = data["ignoreLocationTriggers"] as? NSNumber
    let active                 = data["active"]             as? NSNumber
    let repeatMode             = data["repeatMode"]         as? String
    let activeMonday           = data["activeMonday"]       as? NSNumber
    let activeTuesday          = data["activeTuesday"]      as? NSNumber
    let activeWednesday        = data["activeWednesday"]    as? NSNumber
    let activeThursday         = data["activeThursday"]     as? NSNumber
    let activeFriday           = data["activeFriday"]       as? NSNumber
    let activeSaturday         = data["activeSaturday"]     as? NSNumber
    let activeSunday           = data["activeSunday"]       as? NSNumber
    
    
    if (
        nextTime               == nil ||
        switchState            == nil ||
        fadeDuration           == nil ||
        intervalInMinutes      == nil ||
        ignoreLocationTriggers == nil ||
        active                 == nil ||
        repeatMode             == nil ||
        activeMonday           == nil ||
        activeTuesday          == nil ||
        activeWednesday        == nil ||
        activeThursday         == nil ||
        activeFriday           == nil ||
        activeSaturday         == nil ||
        activeSunday           == nil
      ) {
      var failureString = "Not all required fields have been defined. Require additional fields: { "
      failureString += nextTime == nil ?               "nextTime: number (timestamp since epoch in seconds), " : ""
      failureString += switchState == nil ?            "switchState: number (switch, float, [ 0 .. 1 ] ), " : ""
      failureString += fadeDuration == nil ?           "fadeDuration: number (UInt16)" : ""
      failureString += intervalInMinutes == nil ?      "intervalInMinutes: number (UInt16)" : ""
      failureString += ignoreLocationTriggers == nil ? "ignoreLocationTriggers: Boolean" : ""
      failureString += active == nil ?                 "active: Boolean, " : ""
      failureString += repeatMode == nil ?             "repeatMode: string ('24h' / 'minute' / 'none'), " : ""
      failureString += activeMonday == nil ?           "activeMonday: Boolean, " : ""
      failureString += activeTuesday == nil ?          "activeTuesday: Boolean, " : ""
      failureString += activeWednesday == nil ?        "activeWednesday: Boolean, " : ""
      failureString += activeThursday == nil ?         "activeThursday: Boolean, " : ""
      failureString += activeFriday == nil ?           "activeFriday: Boolean, " : ""
      failureString += activeSaturday == nil ?         "activeSaturday: Boolean, " : ""
      failureString += activeSunday == nil ?           "activeSunday: Boolean" : ""
      failureString += " }"
      callback([["error" : true, "data": failureString]])
      return
    }
    
    if (active!.boolValue == false) {
      callback([["error" : true, "data": "If you want to deactivate the schedule, use the clearSchedule command"]])
      return
    }
    GLOBAL_BLUENET.bluenet.state.getAvailableScheduleEntryIndex()
      .done{scheduleEntryIndex -> Void in
        let config = ScheduleConfigurator(
          scheduleEntryIndex: scheduleEntryIndex,
          startTime: nextTime!.doubleValue,
          switchState: switchState!.floatValue
        )
        config.fadeDuration = fadeDuration!.uint16Value
        config.intervalInMinutes = intervalInMinutes!.uint16Value
        config.override.location = ignoreLocationTriggers!.boolValue
        config.repeatDay.Monday = activeMonday!.boolValue
        config.repeatDay.Tuesday = activeTuesday!.boolValue
        config.repeatDay.Wednesday = activeWednesday!.boolValue
        config.repeatDay.Thursday = activeThursday!.boolValue
        config.repeatDay.Friday = activeFriday!.boolValue
        config.repeatDay.Saturday = activeSaturday!.boolValue
        config.repeatDay.Sunday = activeSunday!.boolValue
        
        GLOBAL_BLUENET.bluenet.control.setSchedule(scheduleConfig: config)
          .done{time in callback([["error" : false, "data": scheduleEntryIndex]])}
          .catch{err in
            if let bleErr = err as? BluenetError {
              callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
            }
            else {
              callback([["error" : true, "data": "UNKNOWN ERROR IN setSchedule"]])
            }
        }
      }
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN setSchedule"]])
        }
    }
  }
  
  @objc func setSchedule(_ data: NSDictionary, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called setSchedule")
    let scheduleEntryIndex     = data["scheduleEntryIndex"] as? NSNumber
    let nextTime               = data["nextTime"]           as? NSNumber
    let switchState            = data["switchState"]        as? NSNumber
    let fadeDuration           = data["fadeDuration"]       as? NSNumber
    let intervalInMinutes      = data["intervalInMinutes"]  as? NSNumber
    let ignoreLocationTriggers = data["ignoreLocationTriggers"] as? NSNumber
    let active                 = data["active"]             as? NSNumber
    let repeatMode             = data["repeatMode"]         as? String
    let activeMonday           = data["activeMonday"]       as? NSNumber
    let activeTuesday          = data["activeTuesday"]      as? NSNumber
    let activeWednesday        = data["activeWednesday"]    as? NSNumber
    let activeThursday         = data["activeThursday"]     as? NSNumber
    let activeFriday           = data["activeFriday"]       as? NSNumber
    let activeSaturday         = data["activeSaturday"]     as? NSNumber
    let activeSunday           = data["activeSunday"]       as? NSNumber
    
    
    if (
        scheduleEntryIndex     == nil ||
        nextTime               == nil ||
        switchState            == nil ||
        fadeDuration           == nil ||
        intervalInMinutes      == nil ||
        ignoreLocationTriggers == nil ||
        active                 == nil ||
        repeatMode             == nil ||
        activeMonday           == nil ||
        activeTuesday          == nil ||
        activeWednesday        == nil ||
        activeThursday         == nil ||
        activeFriday           == nil ||
        activeSaturday         == nil ||
        activeSunday           == nil
      ) {
      var failureString = "Not all required fields have been defined. Require additional fields: { "
      failureString += scheduleEntryIndex == nil ?     "scheduleEntryIndex: number (index of timer, [0 .. 9]), " : ""
      failureString += nextTime == nil ?               "nextTime: number (timestamp since epoch in seconds), " : ""
      failureString += switchState == nil ?            "switchState: number (switch, float, [ 0 .. 1 ] ), " : ""
      failureString += fadeDuration == nil ?           "fadeDuration: number (UInt16)" : ""
      failureString += intervalInMinutes == nil ?      "intervalInMinutes: number (UInt16)" : ""
      failureString += ignoreLocationTriggers == nil ? "ignoreLocationTriggers: Boolean" : ""
      failureString += active == nil ?                 "active: Boolean, " : ""
      failureString += repeatMode == nil ?             "repeatMode: string ('24h' / 'minute' / 'none'), " : ""
      failureString += activeMonday == nil ?           "activeMonday: Boolean, " : ""
      failureString += activeTuesday == nil ?          "activeTuesday: Boolean, " : ""
      failureString += activeWednesday == nil ?        "activeWednesday: Boolean, " : ""
      failureString += activeThursday == nil ?         "activeThursday: Boolean, " : ""
      failureString += activeFriday == nil ?           "activeFriday: Boolean, " : ""
      failureString += activeSaturday == nil ?         "activeSaturday: Boolean, " : ""
      failureString += activeSunday == nil ?           "activeSunday: Boolean" : ""
      failureString += " }"
      callback([["error" : true, "data": failureString]])
      return
    }
    
    if (active!.boolValue == false) {
      callback([["error" : true, "data": "If you want to deactivate the schedule, use the clearSchedule command"]])
      return
    }
    

    let config = ScheduleConfigurator(
      scheduleEntryIndex: scheduleEntryIndex!.uint8Value,
      startTime: nextTime!.doubleValue,
      switchState: switchState!.floatValue
    )
    
    config.fadeDuration = fadeDuration!.uint16Value
    config.intervalInMinutes = intervalInMinutes!.uint16Value
    config.override.location = ignoreLocationTriggers!.boolValue
    config.repeatDay.Monday = activeMonday!.boolValue
    config.repeatDay.Tuesday = activeTuesday!.boolValue
    config.repeatDay.Wednesday = activeWednesday!.boolValue
    config.repeatDay.Thursday = activeThursday!.boolValue
    config.repeatDay.Friday = activeFriday!.boolValue
    config.repeatDay.Saturday = activeSaturday!.boolValue
    config.repeatDay.Sunday = activeSunday!.boolValue

    
    GLOBAL_BLUENET.bluenet.control.setSchedule(scheduleConfig: config)
      .done{time in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN setSchedule"]])
        }
    }
  }
  
  @objc func clearSchedule(_ scheduleEntryIndex: NSNumber, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called clearSchedule")
    GLOBAL_BLUENET.bluenet.control.clearSchedule(scheduleEntryIndex: scheduleEntryIndex.uint8Value)
      .done{time in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN clearSchedule"]])
        }
    }
  }
  
  
  @objc func getAvailableScheduleEntryIndex(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called getAvailableScheduleEntryIndex")
    GLOBAL_BLUENET.bluenet.state.getAvailableScheduleEntryIndex()
      .done{index in callback([["error" : false, "data": index]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN getAvailableSchedulerIndex"]])
        }
    }
  }
  
  @objc func getSchedules(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called getSchedules")
    GLOBAL_BLUENET.bluenet.state.getAllSchedules()
      .done{data -> Void in
        var returnData = [NSDictionary]()
        for schedule in data {
          if (schedule.isActive()) {
            returnData.append(schedule.getScheduleDataFormat())
          }
        }
        callback([["error" : false, "data": returnData]])
      }
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN getAvailableSchedulerIndex"]])
        }
    }
    
  }

  @objc func allowDimming(_ allow: NSNumber, callback: @escaping RCTResponseSenderBlock) -> Void {
    let allowBool = allow.boolValue
    LOGGER.info("BluenetBridge: Called allowDimming")
    GLOBAL_BLUENET.bluenet.control.allowDimming(allow: allowBool)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN allowDimming"]])
        }
    }
  }
  
  @objc func lockSwitch(_ lock: NSNumber, callback: @escaping RCTResponseSenderBlock) -> Void {
    let lockBool = lock.boolValue
    LOGGER.info("BluenetBridge: Called lockSwitch")
    GLOBAL_BLUENET.bluenet.control.lockSwitch(lock: lockBool)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN lockSwitch"]])
        }
    }
  }
  
  @objc func setSwitchCraft(_ state: NSNumber, callback: @escaping RCTResponseSenderBlock) -> Void {
    let stateBool = state.boolValue
    LOGGER.info("BluenetBridge: Called setSwitchCraft")
    GLOBAL_BLUENET.bluenet.control.setSwitchCraft(enabled: stateBool)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN setSwitchCraft"]])
        }
    }
  }
  
  @objc func meshSetTime(_ time: NSNumber, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called meshSetTime")
    GLOBAL_BLUENET.bluenet.mesh.batchCommand(crownstoneIds: [], commandPacket: ControlPacketsGenerator.getSetTimePacket(time.uint32Value))
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN meshSetTime"]])
        }
    }
  }
  
  
  @objc func sendNoOp(_  callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called sendNoOp")
    GLOBAL_BLUENET.bluenet.control.sendNoOp()
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN sendNoOp"]])
        }
    }
  }
  
  @objc func sendMeshNoOp(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called sendMeshNoOp")
    GLOBAL_BLUENET.bluenet.mesh.batchCommand(crownstoneIds: [], commandPacket: ControlPacketsGenerator.getNoOpPacket())
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN sendMeshNoOp"]])
        }
    }
  }
  
  
  @objc func setMeshChannel(_ channel: NSNumber, callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called setMeshChannel")
    GLOBAL_BLUENET.bluenet.config.setMeshChannel(channel) // set channel
      .then{_ in return GLOBAL_BLUENET.bluenet.waitToWrite()} // wait to store
      .then{_ in return GLOBAL_BLUENET.bluenet.control.reset()} // reset
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN sendMeshNoOp"]])
        }
    }
  }
  
  @objc func getTrackingState(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called getTrackingState")
    callback([["error" : false, "data": GLOBAL_BLUENET.bluenetLocalization.getTrackingState() ]])
  }
  
  
  @objc func isDevelopmentEnvironment(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    LOGGER.info("BluenetBridge: Called isDevelopmentEnvironment")
    callback([["error" : false, "data": GLOBAL_BLUENET.devEnvironment ]])
  }
  
  
  @objc func viewsInitialized() {
    LOGGER.info("BluenetBridge: Called viewsInitialized")
  }
  
  @objc func setLocationState(_ sphereUID: NSNumber, locationId: NSNumber, profileIndex: NSNumber, deviceToken: NSNumber, referenceId: String) {
    print("BluenetBridge: Called setLocationState \(sphereUID) \(locationId) \(profileIndex) referenceId:\(referenceId)" )
    GLOBAL_BLUENET.bluenet.setLocationState(sphereUID: sphereUID.uint8Value, locationId: locationId.uint8Value, profileIndex: profileIndex.uint8Value, deviceToken: deviceToken.uint8Value, referenceId: referenceId)
  }
  
  @objc func setDevicePreferences(_ rssiOffset: NSNumber, tapToToggle: NSNumber) {
    print("BluenetBridge: Called setDevicePreferences \(rssiOffset) \(tapToToggle)")
    GLOBAL_BLUENET.bluenet.setDevicePreferences(
      rssiOffset: rssiOffset.int8Value,
      tapToToggle: tapToToggle.boolValue,
      useBackgroundBroadcasts: false,
      useBaseBroadcasts: false
    );
  }
  
  @objc func setCrownstoneNames(_ names: NSDictionary) {
    print("BluenetBridge: Called SETTING setCrownstoneNames")
    GLOBAL_BLUENET.watchStateManager.loadState("crownstoneNames", names)
  }


  @objc func setupPulse(_ callback: @escaping RCTResponseSenderBlock) -> Void {
    print("BluenetBridge: Called SETTING setupPulse")
    GLOBAL_BLUENET.bluenet.setup.pulse()
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN setupPulse"]])
        }
    }
  }

  @objc func subscribeToNearest() {
     if GLOBAL_BLUENET.subscribedToNearest() { return }
    
    GLOBAL_BLUENET.bluenetOnNearest("nearestSetupCrownstone", {data -> Void in
      if let castData = data as? NearestItem {
        self.sendEvent(withName: "nearestSetupCrownstone", body: castData.getDictionary())
      }
    })

    GLOBAL_BLUENET.bluenetOnNearest("nearestCrownstone", {data -> Void in
      if let castData = data as? NearestItem {
        self.sendEvent(withName: "nearestCrownstone", body: castData.getDictionary())
      }
    })
  }
  
  @objc func unsubscribeNearest() {
    GLOBAL_BLUENET.bluenetClearNearest()
  }
  
  @objc func subscribeToUnverified() {
    if GLOBAL_BLUENET.subscribedToUnverified() { return }
    
    GLOBAL_BLUENET.bluenetOnUnverified("unverifiedAdvertisementData", {data -> Void in
      if let castData = data as? Advertisement {
        self.sendEvent(withName: "unverifiedAdvertisementData", body: castData.getDictionary())
      }
    })

    GLOBAL_BLUENET.bluenetOnUnverified("advertisementData", {data -> Void in
      if let castData = data as? Advertisement {
        self.sendEvent(withName: "crownstoneAdvertisementReceived", body: castData.handle)
      }
    })
  }
  
  @objc func unsubscribeUnverified() {
    GLOBAL_BLUENET.bluenetClearUnverified()
  }
  
  
  @objc func switchRelay(_ state: NSNumber, callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called setSwitchState")
    GLOBAL_BLUENET.bluenet.control.switchRelay(state.uint8Value)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN switchRelay \(err)"]])
        }
    }
  }
  
  @objc func switchDimmer(_ state: NSNumber, callback: @escaping RCTResponseSenderBlock) {
    LOGGER.info("BluenetBridge: Called setSwitchState")
    GLOBAL_BLUENET.bluenet.control.switchPWM(state.floatValue)
      .done{_ in callback([["error" : false]])}
      .catch{err in
        if let bleErr = err as? BluenetError {
          callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
        }
        else {
          callback([["error" : true, "data": "UNKNOWN ERROR IN switchDimmer \(err)"]])
        }
    }
  }
    
    @objc func getResetCounter(_ callback: @escaping RCTResponseSenderBlock) {
        LOGGER.info("BluenetBridge: Called getResetCounter")
        GLOBAL_BLUENET.bluenet.state.getResetCounter()
            .done{ resetCounter in callback([["error" : false, "data": resetCounter]]) }
            .catch{err in
                if let bleErr = err as? BluenetError {
                    callback([["error" : true, "data": getBluenetErrorString(bleErr)]])
                }
                else {
                    callback([["error" : true, "data": "UNKNOWN ERROR IN getResetCounter \(err)"]])
                }
        }
    }

}
