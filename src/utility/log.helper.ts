import fs from 'fs';
import { Request, Response } from 'express';
import path, { resolve } from 'path';
import { reject } from 'lodash';

const logFileLocation = path.join(__dirname, '../../daily.log')
const rawLogFileLocation = path.join(__dirname, '../../access.log')

interface RawLogs {
  address: string,
  user: string,
  date: string,
  method: string,
  uniqueId: number,
  url: string,
  ref: string,
}

interface FormattedLogs {
  addresses: string[],
  url: string
}
  
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
    await clearRawLogs();
    console.log('successfully cleared old logs');
  
    // then get the raw logs
    var rawLogs = await readRawLogs() as RawLogs[];
    console.log('successfully fetched raw logs', rawLogs);
  
    var sorted = await sortAndFilterLogs(rawLogs) as FormattedLogs[];
  
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
        console.log('converting', log)
        var logJSON = JSON.parse(log) as RawLogs;
        logJSON.uniqueId = parseInt(logJSON.url, 36)
        prettyLogs.push(logJSON)
        console.log('converted', prettyLogs[prettyLogs.length - 1])
      } catch (err) {
        console.log('err', err)
        reject(err)
      }
    }
    resolve(prettyLogs)
  })
}

/*
  @readRawLogs
    retrieves the raw logs and reads them into a json array
*/
async function writeDailyLogs(logs:FormattedLogs[]) {
  return new Promise((resolve, reject) => {
    var data = '';
    for (var log of logs) {
      data += JSON.stringify(log)
    }
    fs.writeFile(logFileLocation, data, {}, function (err) {
      if (err) reject(err)
      resolve({succes: true})
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
    var formatted_logs = new Array ();

    try {
      for (var log of logs) {
        if (log.url) {
          console.log(
            'found entry for ' + log.url, 
            'entry exists: ' + formatted_logs[log.uniqueId].includes(log.address)
          )
          if (!formatted_logs[log.uniqueId].includes(log.address)) {
            formatted_logs[log.uniqueId] += "," + log.address
          }
        }
      }
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