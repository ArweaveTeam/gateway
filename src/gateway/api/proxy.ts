import { fetchRequest } from "../../lib/arweave";
import { APIRequest, APIResponse, APIError } from "../../lib/api-handler";

export const handler = async (request: APIRequest, response: APIResponse) => {
  const { status, headers, body } = await fetchRequest(
    request.path,
    ({ status }) => [200, 202, 410].includes(status)
  );

  if (status && body && headers) {
    response.status(status);

    const contentType = headers.get("content-type");

    if (contentType) {
      response.type(contentType);
    }

    return response.sendFile(body);
  }

  throw new APIError(502, "no_response");
};
