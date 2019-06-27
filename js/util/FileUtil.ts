import { Platform } from 'react-native';
import { core } from "../core";
const RNFS = require('react-native-fs');

export const FileUtil = {

  getPath: function(filename? : string) {
    let targetPath = Platform.OS === 'android' ? RNFS.ExternalDirectoryPath : RNFS.DocumentDirectoryPath;

    if (filename) {
      if (targetPath[targetPath.length-1] !== '/') {
        targetPath += '/';
      }
      targetPath += filename;
    }
    return targetPath;
  },


  safeMoveFile: function(from,to) {
    // we update the session memory to make sure all pictures are reloaded.
    core.sessionMemory.cacheBusterUniqueElement = Math.random();
    console.log("MOVING FILE", from, to, to.substr(to.length - 20))
    return FileUtil.safeDeleteFile(to)
      .then(() => {
        console.log("DELETED FILE", to, to.substr(to.length - 20))
        return new Promise((resolve, reject) => {
          RNFS.moveFile(from, to)
            .then(() => {
              console.log("MOVEING FILE EXEC", from, to)
              resolve(to);
            })
            .catch((err) => {
              console.log("ERROR WHILE MOVING", err);
              reject(err)
            })
        })
      })
  },

  safeDeleteFile: function(uri) {
    return new Promise((resolve, reject) => {
      RNFS.exists(uri)
        .then((fileExists) => {
          if (fileExists) {
            return RNFS.unlink(uri)
          }
        })
        .then(() => {
          resolve()
        })
        .catch((err) => {
          reject(err);
        })
    })
  }

};
