import fs from 'fs';
import {Request, Response} from 'express';
import path from 'path';
import {sha256} from 'js-sha256';
import cryptoRandomString = require('crypto-random-string')

const logFileLocation = path.join(__dirname, '/tmp/daily.log');
const rawLogFileLocation = path.join(__dirname, '/tmp/access.log');

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

function getLogSalt() {
  return sha256(cryptoRandomString({length: 10}));
}

export const logsHelper = function(req: Request, res: Response) {
  // console.log('logs file path is ', logFileLocation)
  fs.readFile(logFileLocation, 'utf8', (err: any, data: any) => {
    if (err) {
      console.error(err);
      res.status(500).send(err);
      return;
    }
    // console.log(data)
    res.status(200).send(data);
  });
};

export const logsInfo = async function(req: Request, res: Response) {
  try {
    const masterSalt = getLogSalt();
    const rawLogs = await readRawLogs(masterSalt) as RawLogs[];
    res.status(200).send(rawLogs);
  } catch (err) {
    res.status(500).send(err)
  }
};

export const logsTask = async function() {
  return new Promise(async (resolve, reject) => {
    try {
      const masterSalt = getLogSalt();
      const rawLogs = await readRawLogs(masterSalt) as RawLogs[];
      const sorted = await sortAndFilterLogs(rawLogs) as FormattedLogsArray;
      const result = await writeDailyLogs(sorted);

      // last, clear old logs
      await clearRawLogs();

      resolve(result);
    } catch (err) {
      console.error('error writing daily log file', err);
      reject(err);
    }
  });
};

/*
  @readRawLogs
    retrieves the raw logs and reads them into a json array
*/
async function readRawLogs(masterSalt: string) {
  return new Promise((resolve, reject) => {
    const prettyLogs = [] as RawLogs[];
    try { 
      const logs = fs.readFileSync(rawLogFileLocation).toString().split('\n');

      for (const log of logs) {
        try {
          if (log && !(log === ' ') && !(log === ' ')) {
            try {
              const logJSON = JSON.parse(log) as RawLogs;
              logJSON.uniqueId = sha256(logJSON.url);
              logJSON.address = sha256.hmac(masterSalt, logJSON.address);
              prettyLogs.push(logJSON);
            } catch (err) {
              console.error('error reading json', err);
              reject(err);
            }
          } else {
            console.error('tried to parse log, but skipping because log is ', log);
          }
        } catch (err) {
          console.error('err', err);
          reject(err);
        }
      }
    } catch (err) {
      console.log('error fetching log file', err)
    }
    resolve(prettyLogs);
  });
}

/*
  @readRawLogs
    retrieves the raw logs and reads them into a json array
*/
async function writeDailyLogs(logs:FormattedLogsArray) {
  return new Promise((resolve, reject) => {
    const data = {
      lastUpdate: new Date(),
      summary: new Array (),
    };
    for (const key in logs) {
      if (logs[key]) {
        const log = logs[key];
        if (log && log.addresses) {
          data.summary.push(log);
        }
      }
    }
    fs.writeFile(logFileLocation, JSON.stringify(data), {}, function(err) {
      if (err) {
        console.log('ERROR SAVING ACCESS LOG', err);
        resolve({success: false, logs: data, error: err});
      } else {
        resolve({success: true, logs: data});
      }
    });
  });
}

/*
  @sortAndFilterLogs
    logs - access.log output (raw data in array)
    resolves to an array of data payloads
*/
async function sortAndFilterLogs(logs: RawLogs[]) {
  return new Promise((resolve, reject) => {
    const formatted_logs = [] as FormattedLogsArray;

    try {
      for (const log of logs) {
        if (log.url && log.uniqueId) {
          if (formatted_logs[log.uniqueId] && !formatted_logs[log.uniqueId].addresses.includes(log.address)) {
            formatted_logs[log.uniqueId].addresses.push(log.address);
          } else {
            formatted_logs[log.uniqueId] = {
              addresses: [log.address],
              url: log.url,
            };
          }
        }
      }
      resolve(formatted_logs);
    } catch (err) {
      reject(err);
    }
  });
}

/*
  @clearRawLogs
    removes the old access logs file
*/
async function clearRawLogs() {
  return new Promise((resolve, reject) => {
    fs.truncate(rawLogFileLocation, 0, function() {
      resolve(true);
    });
  });
}