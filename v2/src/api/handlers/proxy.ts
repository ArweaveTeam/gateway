import { RequestHandler } from "express";
import { pipelineAsync } from "../../lib/streams";
import { apiRequest } from "../../arweave/api";
import { RequestMethod } from "../../lib/http";

export const handler: RequestHandler = async (req, res) => {
  const { method, path } = req;

  console.info(`[proxy] request`, { method, path });

  const { status, contentType, data } = await apiRequest({
    method: method as RequestMethod,
    endpoint: path.replace(/^\//, ""), // Remove slash prefix for node.net/info rather than node.net//info
  });

  if (status) {
    res.status(status);
  }

  if (contentType) {
    res.type(contentType);
  }

  return await pipelineAsync(data, res);
};
