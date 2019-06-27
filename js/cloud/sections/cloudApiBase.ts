import {request, download, downloadFile} from '../cloudCore'
import { DEBUG, NETWORK_REQUEST_TIMEOUT, SILENCE_CLOUD } from "../../ExternalConfig";
import { preparePictureURI } from '../../util/Util'
import {LOG, LOGe, LOGi} from '../../logging/Log'

const RNFS = require('react-native-fs');

export const defaultHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

export const uploadHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'multipart/form-data',
};



interface requestOptions {
  data?: any,
  background?: boolean,
  noAccessToken?: boolean,

}

type requestType = 'query' | 'body';


class TokenStoreClass {
  accessToken;
  applianceId;
  deviceId;
  eventId;
  installationId;
  locationId;
  messageId;
  sphereId;
  stoneId;
  toonId;
  userId;
}

export const TokenStore = new TokenStoreClass();


/**
 * The cloud API is designed to maintain the REST endpoints and to handle responses and errors on the network level.
 * When the responses come back successfully, the convenience wrappers allow callbacks for relevant scenarios.
 */
export const cloudApiBase = {
  _networkErrorHandler: (err) => {},

  _post: function(options) {
    return request(options, 'POST',   defaultHeaders, _getId(options.endPoint, TokenStore), TokenStore.accessToken);
  },
  _get: function(options) {
    return request(options, 'GET',    defaultHeaders, _getId(options.endPoint, TokenStore), TokenStore.accessToken);
  },
  _delete: function(options) {
    return request(options, 'DELETE', defaultHeaders, _getId(options.endPoint, TokenStore), TokenStore.accessToken);
  },
  _put: function(options) {
    return request(options, 'PUT',    defaultHeaders, _getId(options.endPoint, TokenStore), TokenStore.accessToken);
  },
  _head: function(options) {
    return request(options, 'HEAD',   defaultHeaders, _getId(options.endPoint, TokenStore), TokenStore.accessToken);
  },
  _uploadImage: function(options) {
    let formData = new FormData();
    let path = preparePictureURI(options.path, false);
    let filename = path.split('/');
    filename = filename[filename.length-1];
    // cast to any because the typescript typings are incorrect for FormData
    (formData as any).append('picture', {uri: path, name: filename, type: 'image/jpg'});
    options.data = formData;

    return RNFS.exists(preparePictureURI(options.path, false))
      .then((fileExists) => {
        if (fileExists === false) {
          throw "File does not exist."
        }
        else {
          LOGi.cloud("CloudAPIBase: file exists, continue upload");
          let promise = request(options, 'POST', uploadHeaders, _getId(options.endPoint, TokenStore), TokenStore.accessToken, true);
          return this._finalizeRequest(promise, options);
        }
      })
      .catch((err) => { LOGe.cloud("_uploadImage: failed to check if file exists:", err); })
  },
  _download: function(options, toPath, beginCallback?, progressCallback?) {
    return download(options, _getId(options.endPoint, TokenStore), TokenStore.accessToken, toPath, beginCallback, progressCallback)
  },
  downloadFile: function(url, targetPath, callbacks) {
    return downloadFile(url, targetPath, callbacks);
  },
  _handleNetworkError: function (error, options, endpoint, promiseBody, reject, startTime) {
    // this will eliminate all cloud requests.
    if (SILENCE_CLOUD === true)
      return;

    if (options.background !== true) {
      // make sure we do not show this popup when too much time has passed.
      // this can happen when the app starts to sleep and wakes up much later, resulting in the user encountering an error message on app open.
      if (new Date().valueOf()  - startTime < 1.5*NETWORK_REQUEST_TIMEOUT) {
        this._networkErrorHandler(error);
      }

      reject(error);
    }
    else {
      // still reject the promise even if it is a background operation.
      reject(error);
    }


    if (DEBUG === true) {
      LOG.cloud(options.background ? 'BACKGROUND REQUEST:' : '','Network Error:', error, endpoint, promiseBody);
    }
  },

  /**
   * This method will check the return type error code for 200 or 204 and unpack the data from the response.
   * @param {string} reqType
   * @param {string} endpoint
   * @param {requestOptions} options
   * @param {requestType} type
   * @returns {Promise<any>}
   * @private
   */
  _setupRequest: function(reqType : string, endpoint : string, options : requestOptions = {}, type : requestType = 'query') {
    let promiseBody = {endPoint: endpoint, data: options.data, type:type, options: options};
    let promise;
    switch (reqType) {
      case 'POST':
        promise = cloudApiBase._post(promiseBody);
        break;
      case 'GET':
        promise = cloudApiBase._get(promiseBody);
        break;
      case 'PUT':
        promise = cloudApiBase._put(promiseBody);
        break;
      case 'DELETE':
        promise = cloudApiBase._delete(promiseBody);
        break;
      case 'HEAD':
        promise = cloudApiBase._head(promiseBody);
        break;
      default:
        LOGe.cloud("UNKNOWN TYPE:", reqType);
        return;
    }
    return cloudApiBase._finalizeRequest(promise, options, endpoint, promiseBody);
  },

  _finalizeRequest: function(promise, options, endpoint?, promiseBody?) {
    return new Promise((resolve, reject) => {
      let startTime = new Date().valueOf();
      promise
        .then((reply) => {
          if (reply.status === 200 || reply.status === 204)
            resolve(reply.data);
          else
            this.__debugReject(reply, reject, [promise, options, endpoint, promiseBody]);
        })
        .catch((error) => {
          //console.trace(error, this);
          this._handleNetworkError(error, options, endpoint, promiseBody, reject, startTime);
        })
    });
  },


  // END USER API
  // These methods have all the endpoints embedded in them.

  setNetworkErrorHandler: function(handler)     : any  { this._networkErrorHandler = handler },

  __debugReject: function(reply, reject, debugOptions) {
    if (DEBUG) {
      LOGe.cloud("ERROR: HTML ERROR IN API:", reply, debugOptions);
    }
    reject(reply);
  }
};



function _getId(url, obj) : string {
  let usersLocation = url.indexOf('users');
  if (usersLocation !== -1 && usersLocation < 3)
    return obj.userId;

  let devicesLocation = url.indexOf('Devices');
  if (devicesLocation !== -1 && devicesLocation < 3)
    return obj.deviceId;

  let appliancesLocation = url.indexOf('Appliances');
  if (appliancesLocation !== -1 && appliancesLocation < 3)
    return obj.applianceId;

  let eventsLocation = url.indexOf('Events');
  if (eventsLocation !== -1 && eventsLocation < 3)
    return obj.eventId;

  let spheresLocation = url.indexOf('Spheres');
  if (spheresLocation !== -1 && spheresLocation < 3)
    return obj.sphereId;

  let locationsLocation = url.indexOf('Locations');
  if (locationsLocation !== -1 && locationsLocation < 3)
    return obj.locationId;

  let stoneLocation = url.indexOf('Stones');
  if (stoneLocation !== -1 && stoneLocation < 3)
    return obj.stoneId;

  let installationLocation = url.indexOf('AppInstallation');
  if (installationLocation !== -1 && installationLocation < 3)
    return obj.installationId;

  let messagesLocation = url.indexOf('Messages');
  if (messagesLocation !== -1 && messagesLocation < 3)
    return obj.messageId;

  let toonsLocation = url.indexOf('Toons');
  if (toonsLocation !== -1 && toonsLocation < 3)
    return obj.toonId;
}

