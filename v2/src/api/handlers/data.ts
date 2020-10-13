import { Tag } from "../../arweave/interfaces";
import { getTransactionData } from "../../arweave/api";
import {
  resolveManifestPathId,
  PathManifest,
} from "../../lib/arweave-path-manifest";
import { putObjectStream } from "../../lib/storage/index";
import { RequestHandler, Request, Response } from "express";
import { pipelineAsync, streamToJson } from "../../lib/streams";

const DEFAULT_TYPE = "text/html";

interface Bundle {
  items: { id: string; data: string; tags: Tag[] }[];
}

function getTxIdFromPath(path: string): string | undefined {
  const matches = path.match(/^\/?([a-z0-9-_]{43})/i) || [];
  return matches[1];
}

function getTransactionSubpath(requestPath: string): string | undefined {
  const subpath = requestPath.match(/^\/?[a-zA-Z0-9-_]{43}\/(.*)$/i);
  return (subpath && subpath[1]) || undefined;
}

export const handler: RequestHandler = async (req, res) => {
  const txid = getTxIdFromPath(req.path);

  if (txid) {
    const { data, contentType, contentLength, tags } = await getTransactionData(
      txid
    );

    if (contentType == "application/x.arweave-manifest+json") {
      console.log("[get-data] manifest content-type detected", { txid });
      const manifest = await streamToJson<PathManifest>(data);

      const subPath = getTransactionSubpath(req.path);

      const subPathTxId = resolveManifestPathId(manifest, subPath);

      const {
        data: subTxData,
        contentType: subTxContentType,
        contentLength: subTxcontentLength,
      } = await getTransactionData(subPathTxId);

      const { stream: cacheStream } = await putObjectStream(
        `tx/${subPathTxId}`,
        {
          contentType,
        }
      );

      res.header("content-type", subTxContentType);
      // res.header("content-length", subTxcontentLength.toString());

      return await Promise.all([
        pipelineAsync(subTxData, cacheStream),
        pipelineAsync(subTxData, res),
      ]);
    }

    const { stream: cacheStream } = await putObjectStream(`tx/${txid}`, {
      contentType,
    });

    res.header("content-type", contentType || DEFAULT_TYPE);
    // res.header("content-length", contentLength.toString());

    return await Promise.all([
      pipelineAsync(data, cacheStream),
      pipelineAsync(data, res),
    ]);
  }
};
