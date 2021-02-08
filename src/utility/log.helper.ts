import fs from 'fs';
import { Request, Response } from 'express';
import path from 'path';

const logFileLocation = path.join(__dirname, '../../access.log')

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