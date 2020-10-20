import { getTransactionData } from "../../arweave/api";
import {
  resolveManifestPathId,
  PathManifest,
} from "../../arweave/path-manifest";
import { RequestHandler } from "express";
import { pipelineAsync, streamToJson } from "../../lib/streams";
import { Readable } from "stream";
import createHttpError from "http-errors";

const DEFAULT_TYPE = "text/html";

export const matchAnyDataPathRegex = /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i;

export const handler: RequestHandler = async (req, res) => {
  const txid = getTxIdFromPath(req.path);

  if (txid) {
    const {
      id: resolvedId,
      data,
      contentType,
      contentLength,
    } = await resolveContent(txid, req.path);

    res.header("content-type", contentType || DEFAULT_TYPE);

    res.header("content-length", contentLength.toFixed());

    res.header("etag", resolvedId);

    return await pipelineAsync(data, res);
  }
};

const resolveContent = async (
  id: string,
  path: string
): Promise<{
  id: string;
  data: Readable;
  contentType?: string;
  contentLength: number;
}> => {
  // console.log(`[get-data] resolving: ${id} => ${path}`);

  const { data, contentType, contentLength } = await getTransactionData(id);

  console.log(`${id} ${contentLength} bytes`);

  if (contentType == "application/x.arweave-manifest+json") {
    // console.log(`[get-data] manifest content-type detected: ${id}`);

    const manifest = await streamToJson<PathManifest>(data);

    const resolvedId = resolveManifestPathId(
      manifest,
      getManifestSubpath(path)
    );

    // console.log(`[get-data] resolved path: ${id} => ${path} => ${resolvedId}`);

    return resolveContent(resolvedId, path);
  }

  return { id, data, contentType, contentLength };
};

function getTxIdFromPath(path: string): string | undefined {
  const matches = path.match(/^\/?([a-z0-9-_]{43})/i) || [];
  return matches[1];
}

function getManifestSubpath(requestPath: string): string | undefined {
  const subpath = requestPath.match(/^\/?[a-zA-Z0-9-_]{43}\/(.*)$/i);
  return (subpath && subpath[1]) || undefined;
}
