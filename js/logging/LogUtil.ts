import { FileUtil } from "../util/FileUtil";

const RNFS = require('react-native-fs');

function getFilename(timestamp) {
  let monthNumber = new Date(timestamp).getMonth()+1;
  let dayNumber = new Date(timestamp).getDate();

  let month = monthNumber < 10 ? '0' + monthNumber : '' + monthNumber;
  let day = dayNumber < 10 ? '0' + dayNumber : '' + dayNumber;

  let dateStamp = new Date(timestamp).getFullYear() + "-" + month + "-" +day;
  return 'ConsumerAppLog' + dateStamp + '.log';
}

export function cleanLogs() {
  // create a path you want to write to
  let logPath = FileUtil.getPath();

  _cleanLogs(logPath);
}

function _cleanLogs(logPath, amountOfDaysStored = 3) {
  let allowedLogFiles = {};
  for (let i = 0; i < amountOfDaysStored; i++) {
    let timestamp = new Date().valueOf() - i*86400000;
    allowedLogFiles[getFilename(timestamp)] = true;
  }

  let flagForRemoval = [];
  RNFS.readdir(logPath)
    .then((files) => {
      for (let i = 0; i < files.length; i++) {
        if (files[i].substr(0,14) === "ConsumerAppLog" && allowedLogFiles[files[i]] !== true) {
          flagForRemoval.push(files[i]);
        }
      }
      for (let i = 0; i < flagForRemoval.length; i++) {
        FileUtil.safeDeleteFile(logPath + "/" + flagForRemoval[i]).catch(()=>{});
      }
    })
    .catch((err) => {
    });
}

export function clearLogs() {
  // create a path you want to write to
  let logPath = FileUtil.getPath();

  _cleanLogs(logPath,0);
}



export function logToFile() {
  // create a path you want to write to
  let logPath = FileUtil.getPath();

  // generate filename based on current date.
  let filename = getFilename(new Date().valueOf());
  let filePath = logPath + '/' + filename;

  // create string
  let str = '' + new Date().valueOf() + ' - ' + new Date() + " -";
  for (let i = 0; i < arguments.length; i++) {
    if (typeof arguments[i] === 'object' || Array.isArray(arguments[i])) {
      str += " " + JSON.stringify(arguments[i])
    }
    else {
      str += " " + arguments[i]
    }
  }
  str += " \n";

  // write the file
  RNFS.appendFile(filePath, str, 'utf8')
    .then((success) => {})
    .catch((err) => {})
}
