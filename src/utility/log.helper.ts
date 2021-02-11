import fs from 'fs';
import { Request, Response } from 'express';
import path, { resolve } from 'path';
import { reject } from 'lodash';

const logFileLocation = path.join(__dirname, '../../daily.log')
const rawLogFileLocation = path.join(__dirname, '../../access.log')
  
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

export const logsTask = async function ( ) {
  // first clear old logs
  await clearRawLogs()

  // then get the raw logs
  var rawLogs = await readRawLogs();

  // var sorted = await sortAndFilterLogs();

  // var result = await writeDailyLogs();

}

/*
  @readRawLogs
    retrieves the raw logs and reads them into a json array
*/
async function readRawLogs() {
  return new Promise((resolve, reject) => {
    var logs = fs.readFileSync(rawLogFileLocation).toString().split("\n");
    var prettyLogs = [];
    for (var log of logs) {
      try {
        console.log('converting', log)
        prettyLogs.push(JSON.parse(log))
        console.log('converted', prettyLogs[prettyLogs.length])
      } catch (err) {
        console.log('err', err)
        reject(err)
      }
    }
    resolve(prettyLogs)
  })
}

/* 
  @sortAndFilterLogs 
    logs - access.log output (raw data in array)
    resolves to an array of data payloads
*/
async function convertLogsFromString(string) {
  return new Promise((resolve, reject) => {
    var remaining = '';
    var result = []

    try {
      string.on('data', function (data) {
        remaining += data;
        var index = remaining.indexOf('\n');
        var last = 0;
        while (index > -1) {
          var line = remaining.substring(last, index);
          last = index + 1;
          
          index = remaining.indexOf('\n', last);
        }
    
        remaining = remaining.substring(last);
      });
    
      input.on('end', function () {
        resolve(result)
      });
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