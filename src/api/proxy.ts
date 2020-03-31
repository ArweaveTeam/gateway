import { createApiHandler } from "../lib/api-handler";
import { firstResponse, OriginResponse } from "../lib/proxy";

const origins = JSON.parse(
  process.env.ARWEAVE_GATEWAY_ORIGINS || "null"
) as string[];

if (!Array.isArray(origins)) {
  throw new Error(
    `error.config: Invalid env var, process.env.ARWEAVE_GATEWAY_ORIGINS: ${process.env.ARWEAVE_GATEWAY_ORIGINS}`
  );
}

console.log(`app.config.origins: ${origins.join(", ")}`);

export const handler = createApiHandler(async (request, response) => {
  try {
    const endpoint =
      request.path.startsWith("/") && request.path.length > 1
        ? request.path.slice(1)
        : request.path;

    const { origin, originResponse, originTime } = await firstResponse(
      endpoint,
      origins,
      (origin: string, url: string, response: OriginResponse) => {
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

    if (contentType) {
      response.type(contentType);
    }
    response.sendFile(await originResponse.buffer());
  } catch (error) {
    console.error(`proxy.error: ${error.message}`);
    return response.sendStatus(500);
  }
});
