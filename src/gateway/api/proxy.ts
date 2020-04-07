import { firstResponse, OriginResponse } from "../../lib/proxy";
import { APIRequest, APIResponse } from "../../lib/api-handler";

const origins = JSON.parse(
  process.env.ARWEAVE_GATEWAY_ORIGINS || "null"
) as string[];

if (!Array.isArray(origins)) {
  throw new Error(
    `error.config: Invalid env var, process.env.ARWEAVE_GATEWAY_ORIGINS: ${process.env.ARWEAVE_GATEWAY_ORIGINS}`
  );
}

console.log(`app.config.origins: ${origins.join(", ")}`);

export const handler = async (request: APIRequest, response: APIResponse) => {
  const { origin, originResponse, originTime } = await firstResponse(
    request.path,
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
};
