/**
 * Sync schedules in this stone.
 * @param actions
 * @param transferPromises
 * @param state
 * @param cloudSpheresData
 * @param sphere
 * @param stone_from_cloud
 * @param cloudScheduleIds
 * @param sphereInState
 */

import {transferSchedules} from "../../../transferData/transferSchedules";
import {shouldUpdateInCloud, shouldUpdateLocally} from "../shared/syncUtil";
import {SyncingSphereItemBase} from "./SyncingBase";
import { xUtil } from "../../../../util/StandAloneUtil";


export class ScheduleSyncer extends SyncingSphereItemBase {
  localStoneId: string;
  cloudStoneId: string;

  constructor(
    actions: any[],
    transferPromises : any[],
    localSphereId : string,
    cloudSphereId : string,
    localStoneId : string,
    cloudStoneId : string,
    globalCloudIdMap? : globalIdMap,
    globalSphereMap? : globalIdMap
  ) {
    super(actions, transferPromises, localSphereId, cloudSphereId, globalCloudIdMap, globalSphereMap);

    this.localStoneId = localStoneId;
    this.cloudStoneId = cloudStoneId;
  }

  _getLocalData(store) {
    let state = store.getState();
    if (
      state &&
      state.spheres[this.localSphereId] &&
      state.spheres[this.localSphereId].stones &&
      state.spheres[this.localSphereId].stones[this.localStoneId]) {
      return state.spheres[this.localSphereId].stones[this.localStoneId].schedules;
    }
    return {};
  }


  sync(store, schedulesInCloud) {
    let schedulesInState = this._getLocalData(store);

    let localScheduleIdsSynced = this.syncDown(schedulesInState, schedulesInCloud);
    // this.syncUp(schedulesInState, localScheduleIdsSynced);

    return Promise.all(this.transferPromises);
  }

  syncDown(schedulesInState, schedulesInCloud) : object {
    let cloudIdMap = this._getCloudIdMap(schedulesInState);
    let localScheduleIdsSynced = {};


    // find the schedule in our local database that matches the one in the cloud
    schedulesInCloud.forEach((schedule_from_cloud) => {
      let localId = cloudIdMap[schedule_from_cloud.id];

      // if we do not have a schedule with exactly this cloudId, verify that we do not have the same schedule on our device already.
      if (localId === undefined) {
        localId = this._searchForLocalMatch(schedulesInState, schedule_from_cloud);
      }

      if (localId) {
        localScheduleIdsSynced[localId] = true;
        this.syncLocalScheduleDown(localId, schedulesInState[localId], schedule_from_cloud);
      }
      else {
        // the schedule does not exist locally but it does exist in the cloud.
        // we create it locally.
        localId = xUtil.getUUID();
        localScheduleIdsSynced[localId] = true;
        // add schedule
        transferSchedules.createLocal(this.actions, {
          localId: localId,
          localSphereId: this.localSphereId,
          localStoneId: this.localStoneId,
          cloudData: schedule_from_cloud
        })
      }

    });

    return localScheduleIdsSynced;
  }

  syncUp(schedulesInState, localScheduleIdsSynced) {
    let scheduleIds = Object.keys(schedulesInState);
    scheduleIds.forEach((scheduleId) => {
      let schedule = schedulesInState[scheduleId];
      this.syncLocalScheduleUp(
        scheduleId,
        schedule,
        localScheduleIdsSynced[scheduleId] === true
      );
    });
  }


  syncLocalScheduleUp(localId, scheduleInState, hasSyncedDown = false) {
    // if the scheduleId does not exist in the cloud but we have it locally.
    if (!hasSyncedDown) {
      if (scheduleInState.cloudId) {
        this.actions.push({ type: 'REMOVE_STONE_SCHEDULE', sphereId: this.localSphereId, stoneId: this.localStoneId, scheduleId: localId });
      }
      else {
        this.transferPromises.push(transferSchedules.createOnCloud( this.actions, {
          localId: localId,
          localData: scheduleInState,
          localSphereId: this.localSphereId,
          localStoneId: this.localStoneId,
          cloudStoneId: this.cloudStoneId
        }));
      }
    }
  }

  syncLocalScheduleDown(localId, scheduleInState, schedule_from_cloud) {
    if (shouldUpdateInCloud(scheduleInState, schedule_from_cloud)) {
      // update cloud since local data is newer!
      this.transferPromises.push(
        transferSchedules.updateOnCloud({
          cloudStoneId: this.cloudStoneId,
          localId: localId,
          cloudId: schedule_from_cloud.id,
          localData: scheduleInState,
        }).catch(() => {})
      );
    }
    else if (shouldUpdateLocally(scheduleInState, schedule_from_cloud)) {
      // update local
      transferSchedules.updateLocal(this.actions, {
        localSphereId: this.localSphereId,
        localStoneId: this.localStoneId,
        localId: localId,
        cloudData: schedule_from_cloud
      });
    }

    if (!scheduleInState.cloudId) {
      this.actions.push({type:'UPDATE_SCHEDULE_CLOUD_ID', sphereId: this.localSphereId, stoneId: this.localStoneId, scheduleId: localId, data:{cloudId: schedule_from_cloud.id}})
    }
  }



  _getCloudIdMap(localSchedules) {
    let cloudIdMap = {};
    let scheduleIds = Object.keys(localSchedules);
    scheduleIds.forEach((scheduleId) => {
      let schedule = localSchedules[scheduleId];
      if (schedule.cloudId) {
        cloudIdMap[schedule.cloudId] = scheduleId;
      }
    });
    return cloudIdMap;
  }

  _searchForLocalMatch(schedulesInState, schedule_in_cloud) {
    let scheduleIds = Object.keys(schedulesInState);
    for (let i = 0; i < scheduleIds.length; i++) {
      let schedule = schedulesInState[scheduleIds[i]];
      // is the time the same? comparing xx:xx (ie. 15:45)
      if (schedule.scheduleEntryIndex === schedule_in_cloud.scheduleEntryIndex) {
        return scheduleIds[i];
      }
    }
    return null;
  }
}
