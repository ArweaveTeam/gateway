import { fetchRequest } from "../../../lib/arweave";
import { RequestHandler } from "express";
import createError from "http-errors";

export const handler: RequestHandler = async (request, response) => {
  console.log("Proxy", request.path);
  const { status, headers, body } = await fetchRequest(
    request.path,
    ({ status }) => [200, 202, 410].includes(status)
  );

  if (status && body && headers) {
    const contentType = headers.get("content-type") || "text/plain";

    if (contentType) {
      response.type(contentType);
    }

    return response.status(status).send(body);
  }

  throw new createError.NotFound();
};
