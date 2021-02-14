import fs from 'fs';
import { Request, Response } from 'express';
import path, { resolve } from 'path';
import { reject } from 'lodash';
import { sha256 } from 'js-sha256';
import { AnyRecord } from 'dns';

const logFileLocation = path.join(__dirname, '../../daily.log')
const rawLogFileLocation = path.join(__dirname, '../../access.log')

interface RawLogs {
  address: string,
  user: string,
  date: string,
  method: string,
  uniqueId: string,
  url: string,
  ref: string,
}

interface FormattedLogs {
  addresses: string[],
  url: string
}

interface FormattedLogsArray extends Array<FormattedLogs> {
  [key: string]: any
}

// export const getLogSalt = function () {

//   return sha256()
// }

export const logsHelper = function (req: Request, res: Response) {
    console.log('logs file path is ', logFileLocation)
    fs.readFile(logFileLocation, 'utf8', (err : any, data : any) => {
      if (err) {
        console.error(err)
        res.status(500).send(err);
        return
      }
      console.log(data)
      res.status(200).send(data);
    })
}

export const logsTask = async function () {
  
  try { 
    // first clear old logs
    // await clearRawLogs();
    console.log('successfully cleared old logs');
  
    // then get the raw logs
    var rawLogs = await readRawLogs() as RawLogs[];
    console.log('successfully fetched raw logs', rawLogs);
  
    var sorted = await sortAndFilterLogs(rawLogs) as FormattedLogsArray;
  
    var result = await writeDailyLogs(sorted);
  
    console.log('successfully wrote daily logs', result)

  } catch (err) {
    console.error('error writing daily log file', err)
  } 
}

/*
  @readRawLogs
    retrieves the raw logs and reads them into a json array
*/
async function readRawLogs() {
  return new Promise((resolve, reject) => {
    var logs = fs.readFileSync(rawLogFileLocation).toString().split("\n");
    var prettyLogs = new Array () as RawLogs[];
    for (var log of logs) {
      try {
        console.log('trimming |' + log + '|')
        log = log.trim()
        console.log('trimmed |' + log + '|')
        console.log( log, !(log === " "), !(log === "") )
        if (log && !(log === " ") && !(log === "")) {
          try {
        
            var logJSON          = JSON.parse(log) as RawLogs;
            // logJSON.uniqueId = parseInt(text2Binary(logJSON.url))
            logJSON.uniqueId = sha256(logJSON.url)
        
            prettyLogs.push(logJSON)
            console.log('converted', prettyLogs[prettyLogs.length - 1])
              
          } catch (err) {
            console.log('error reading json', err)
          }
        } else {
          console.log('tried to parse log, but skipping because log is ', log)
        }
      } catch (err) {
        console.log('err', err)
        reject(err)
      }
    }
    resolve(prettyLogs)
  })
}

/* quick / lazy fix for mapping arrays in typescript*/
function text2Binary(string:string) {
  return string.split('').map(function (char) {
      return char.charCodeAt(0).toString(2);
  }).join(' ');
}

/*
  @readRawLogs
    retrieves the raw logs and reads them into a json array
*/
async function writeDailyLogs(logs:FormattedLogsArray) {
  return new Promise((resolve, reject) => {
    var data = '[';
    for (var key in logs) {
      var log = logs[key]
      if (log && log.addresses) {
        console.log('adding log to logs!!!!!!!!!!!!!!!!!!!', log)
        data += "," + JSON.stringify(log)
      } 
    }
    data += "]"
    fs.writeFile(logFileLocation, data, {}, function (err) {
      if (err) reject(err)
      resolve({success: true, logs: data})
    });
  })
}

/* 
  @sortAndFilterLogs 
    logs - access.log output (raw data in array)
    resolves to an array of data payloads
*/
async function sortAndFilterLogs(logs: RawLogs[]) {
  return new Promise((resolve, reject) => {
    var formatted_logs: FormattedLogsArray;
        formatted_logs = [];
    
    try {
      for (var log of logs) {
        console.log('about to append log', log)
        if (log.url && log.uniqueId) {
          if (formatted_logs[log.uniqueId]) {
            console.log(
              'found entry for ' + log.url, 
              'entry exists: ' + formatted_logs[log.uniqueId].addresses.includes(log.address)
            )
            if (!formatted_logs[log.uniqueId].addresses.includes(log.address)) {
              formatted_logs[ log.uniqueId ].addresses.push(log.address)
            }
          } else {
            formatted_logs[log.uniqueId] = {
              addresses: [ log.address ],
              url : log.url
            }
          }
        }
      }
      console.log('about to return ' + formatted_logs.length + ' logs', formatted_logs)
      resolve(formatted_logs)

    } catch (err) {
      console.log('failed during access logs conversion', err)
      reject(err)
    }
  })

}

/*
  @clearRawLogs 
    removes the old access logs file
*/
async function clearRawLogs() {
  return new Promise((resolve, reject) => {
    fs.truncate(rawLogFileLocation, 0, function () {
      resolve(true)
    });
  });
}