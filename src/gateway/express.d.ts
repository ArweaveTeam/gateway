// @ts-ignore
declare global {
  // @ts-ignore
  declare module "express-serve-static-core" {
    export interface Request {
      id: string;
      log: import("winston").Logger;
      sentry: { captureEvent: typeof import("@sentry/node").captureException };
    }

    export interface Response {
      sentry?: string;
    }
  }
}
