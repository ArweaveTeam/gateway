import { Logger } from 'winston'

// @ts-ignore
declare global {
  // @ts-ignore
  declare module 'express-serve-static-core' {
    export interface Request {
      id: string;
      log: Logger;
    }
  }
}
