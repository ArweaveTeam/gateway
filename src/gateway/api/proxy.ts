import { fetchRequest } from "../../lib/arweave";
import { APIError, APIHandler } from "../../lib/api-handler";

export const handler: APIHandler = async (request, response) => {
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

  throw new APIError(404, "no_response");
};
