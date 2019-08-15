
import { Languages } from "../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("Views", key)(a,b,c,d,e);
}
import * as React from 'react';
// import { withMappedNavigationProps } from 'react-navigation-props-mapper'

import { DfuIntroduction }   from "../views/dfu/DfuIntroduction";
import { DfuScanning }       from "../views/dfu/DfuScanning";
import { DfuBatch }          from "../views/dfu/DfuBatch";
import { DfuFinished }       from "../views/dfu/DfuFinished";
import { Initializer }       from "./Initializer";
import { Processing }        from "../views/overlays/Processing";
import { BleStateOverlay }   from "../views/overlays/BleStateOverlay";
import { LibMessages }       from "../views/overlays/LibMessages";
import { ListOverlay }       from "../views/overlays/ListOverlay";
import { SimpleOverlay }     from "../views/overlays/SimpleOverlay";
import { OptionPopup }       from "../views/overlays/OptionPopup";
import { FirmwareTest }      from "../views/firmwareTesting/FirmwareTest";
import { UserData }          from "../views/user/UserData";
import { StoneSelector }     from "../views/stoneSelecting/StoneSelector";
import { Logout }            from "../views/startupViews/Logout";
import { RawAdvertisements } from "../views/firmwareTesting/RawAdvertisements";
import { AdvancedConfig }    from "../views/firmwareTesting/AdvancedConfig";
import { NumericOverlay }    from "../views/overlays/NumericOverlay";
import { DFU }               from "../views/firmwareTesting/DFU";
import { LocationPermissionOverlay } from "../views/overlays/LocationPermissionOverlay";


export const Views = {
  Initializer:               Initializer,
  Logout:                    Logout,
  FirmwareTest:              FirmwareTest,
  AdvancedConfig:            AdvancedConfig,
  DFU:                       DFU,

  DfuIntroduction:           DfuIntroduction,
  DfuScanning:               DfuScanning,
  DfuBatch:                  DfuBatch,
  DfuFinished:               DfuFinished,


  StoneSelector:             StoneSelector,
  UserData:                  UserData,
  RawAdvertisements:         RawAdvertisements,

  // Overlays:

  NumericOverlay:            NumericOverlay,
  BleStateOverlay:           BleStateOverlay,
  LibMessages:               LibMessages,
  ListOverlay:               ListOverlay,
  LocationPermissionOverlay: LocationPermissionOverlay,
  OptionPopup:               OptionPopup,
  Processing:                Processing,
  SimpleOverlay:             SimpleOverlay,
};