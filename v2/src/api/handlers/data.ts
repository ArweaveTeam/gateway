import { getTransactionData } from "../../arweave/api";
import {
  resolveManifestPathId,
  PathManifest,
} from "../../arweave/path-manifest";
import { putObjectStream } from "../../lib/storage/index";
import { RequestHandler } from "express";
import { pipelineAsync, streamToJson } from "../../lib/streams";

const DEFAULT_TYPE = "text/html";

export const matchAnyDataPathRegex = /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i;

export const handler: RequestHandler = async (req, res) => {
  const txid = getTxIdFromPath(req.path);

  if (txid) {
    const { data, contentType } = await resolveContent(txid, req.path);

    const { stream: cacheStream } = await putObjectStream(`tx/${txid}`, {
      contentType,
    });

    res.header("content-type", contentType || DEFAULT_TYPE);

    return await Promise.all([
      pipelineAsync(data, cacheStream),
      pipelineAsync(data, res),
    ]);
  }
};

const resolveContent = async (id: string, path: string) => {
  const { data, tags, contentType, contentLength } = await getTransactionData(
    id
  );

  if (contentType == "application/x.arweave-manifest+json") {
    console.log("[get-data] manifest content-type detected", { id });

    const manifest = await streamToJson<PathManifest>(data);

    return getTransactionData(
      resolveManifestPathId(manifest, getManifestSubpath(path))
    );
  }

  return { data, tags, contentType, contentLength };
};

function getTxIdFromPath(path: string): string | undefined {
  const matches = path.match(/^\/?([a-z0-9-_]{43})/i) || [];
  return matches[1];
}

function getManifestSubpath(requestPath: string): string | undefined {
  const subpath = requestPath.match(/^\/?[a-zA-Z0-9-_]{43}\/(.*)$/i);
  return (subpath && subpath[1]) || undefined;
}
