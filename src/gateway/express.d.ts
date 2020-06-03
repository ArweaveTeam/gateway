declare global {
  declare module "express-serve-static-core" {
    export interface Request {
      id: string;
      log: import("winston").Logger;
    }

    export interface Response {
      sentry?: string
    }
  }
}
