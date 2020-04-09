import { firstResponse, OriginResponse } from "../../lib/proxy";
import { APIRequest, APIResponse } from "../../lib/api-handler";

export const handler = async (request: APIRequest, response: APIResponse) => {
  const { origin, originResponse, originTime } = await firstResponse(
    request.path,
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
