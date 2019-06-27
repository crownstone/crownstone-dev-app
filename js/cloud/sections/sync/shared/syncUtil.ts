import { ALLOW_UPLOAD } from "../../../../ExternalConfig";

export const getTimeDifference = function(localVersion, cloudVersion) {
  if (typeof localVersion === 'object' && typeof cloudVersion === 'object') {
    return new Date(localVersion.updatedAt).valueOf() - new Date(cloudVersion.updatedAt).valueOf();
  }
  else {
    return new Date(localVersion).valueOf() - new Date(cloudVersion).valueOf();
  }

};

export const shouldUpdateInCloud = function(localVersion, cloudVersion) {
  if (ALLOW_UPLOAD === true) {
    // local version is newer than the cloud version --> update cloud
    return getTimeDifference(localVersion, cloudVersion) > 0;
  }
  return false;
};

export const shouldUpdateLocally = function(localVersion, cloudVersion) {
  // cloud version is newer than the local version --> update local
  return getTimeDifference(localVersion, cloudVersion) < 0;
};