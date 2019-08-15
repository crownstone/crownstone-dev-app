//
//  Portal.swift
//  Crownstone
//
//  Created by Alex de Mulder on 21/11/2017.
//  Copyright © 2017 Crownstone. All rights reserved.
//
import Foundation
import PromiseKit
import SwiftyJSON

import BluenetLib
import BluenetShared
import BluenetBasicLocalization


let GLOBAL_BLUENET = Portal()

typealias voidCallback = () -> Void

class Portal : NSObject {
  open var bluenet : Bluenet!
  open var bluenetLocalization : BluenetLocalization!
  open var bluenetMotion : BluenetMotion!
  open var trainingHelper : TrainingHelper!
  open var classifier : CrownstoneBasicClassifier!
  
  open var devEnvironment = false
 
  var subscriptions = [voidCallback]()
  var nearestSubscriptions = [voidCallback]()
  var unverifiedSubscriptions = [voidCallback]()
    
  open func initController(viewController: UIViewController) {
    BluenetLib.setBluenetGlobals(viewController: viewController, appName: "Crownstone")
    BluenetLib.LOG.setTimestampPrinting(newState: true)
    self.classifier = CrownstoneBasicClassifier()
    
    self.bluenet = Bluenet(backgroundEnabled: true)
    
    // use the accelerometer.
    // self.bluenetMotion = BluenetMotion()
    
    self.bluenetLocalization = BluenetLocalization(backgroundEnabled: true)
    
    // insert the classifier that will be used for room-level localization.
    self.bluenetLocalization.insertClassifier(classifier: self.classifier)
    
    self.trainingHelper = TrainingHelper(bluenetLocalization: self.bluenetLocalization)
    
    // store the environment so the app can request it. This is used to determine which notification key we should use in our installation model in the cloud.
    self.devEnvironment = isDevelopmentEnvironment()
  }
  
  func subscribedToNearest() -> Bool {
    return self.nearestSubscriptions.count > 0
  }
  func subscribedToUnverified() -> Bool {
    return self.unverifiedSubscriptions.count > 0
  }
  func bluenetOnNearest(_ topic: String, _ callback: @escaping eventCallback) {
    self.nearestSubscriptions.append(self.bluenet.on(topic, callback))
  }
  
  func bluenetClearNearest() {
    for unsubscribeCallback in self.nearestSubscriptions {
      unsubscribeCallback()
    }
    self.nearestSubscriptions = []
  }
  
  func bluenetClearUnverified() {
    for unsubscribeCallback in self.nearestSubscriptions {
      unsubscribeCallback()
    }
    self.unverifiedSubscriptions = []
  }
  
  func bluenetOnUnverified(_ topic: String, _ callback: @escaping eventCallback) {
    self.unverifiedSubscriptions.append(self.bluenet.on(topic, callback))
  }
  
  func bluenetOn(_ topic: String, _ callback: @escaping eventCallback) {
    self.subscriptions.append(self.bluenet.on(topic, callback))
  }
  
  func bluenetLocalizationOn(_ topic: String, _ callback: @escaping eventCallback) {
    self.subscriptions.append(self.bluenetLocalization.on(topic, callback))
  }
  
  open func applicationDidEnterBackground() {
    // check if we have to use this to stop the scanning in the background
    self.bluenet.applicationDidEnterBackground()
    //self.bluenetLocalization.applicationDidEnterBackground()
  }
  
  open func applicationWillEnterForeground() {
    // check if we have to use this to stop the scanning in the background
     self.bluenet.applicationWillEnterForeground()
    // self.bluenetLocalization.applicationWillEnterForeground()
  }
  
  open func parseUserActivity(userActivity: NSUserActivity) {
    if (userActivity.activityType == NSUserActivityTypeBrowsingWeb) {
      if let url = userActivity.webpageURL {
        AppEventBus.emit("callbackUrlInvoked", url.absoluteString)
      }
    }
  }
  
  deinit {
    print("BluenetBridge: CLEANING UP!")
    
    // cleanup
    for unsubscribeCallback in self.subscriptions {
      unsubscribeCallback()
    }
    
    for unsubscribeCallback in self.nearestSubscriptions {
      unsubscribeCallback()
    }
    
    for unsubscribeCallback in self.unverifiedSubscriptions {
      unsubscribeCallback()
    }
  }
}


func isDevelopmentEnvironment() -> Bool {
  guard let filePath = Bundle.main.path(forResource: "embedded", ofType:"mobileprovision") else {
    return false
  }
  do {
    let url = URL(fileURLWithPath: filePath)
    let data = try Data(contentsOf: url)
    guard let string = String(data: data, encoding: .ascii) else {
      return false
    }
    if string.contains("<key>aps-environment</key>\n\t\t<string>development</string>") {
      return true
    }
  } catch {}
  return false
}

