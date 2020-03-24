import { firstResponse } from "./arweave";
import express from "express";
import { Response } from "node-fetch";

export default async function requestHandler(
  request: express.Request,
  response: express.Response,
  endpoint: string,
  origins: string[]
): Promise<void> {
  try {
    const { origin, originResponse, originTime } = await firstResponse(
      endpoint,
      origins,
      (origin: string, url: string, response: Response) => {
        return response.status == 200 || response.status == 202;
      }
    );

    const status = originResponse.status;
    const contentType = originResponse.headers.get("Content-Type");

    console.info(
      `origin.response: ${status}, origin.origin: ${origin},  origin.originTime: ${originTime}ms, origin.contentType: ${contentType}, origin.headers ${JSON.stringify(
        originResponse.headers.raw()
      )}`
    );

    response.status(status);

    if (contentType) {
      response.type(contentType);
    }

    originResponse.body.pipe(response);

    await new Promise(resolve => originResponse.body.on("finish", resolve));
  } catch (error) {
    console.error(`proxy.error: ${error.message}`);
    response.status(500).send();
  }
}
