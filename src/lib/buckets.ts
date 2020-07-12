import { S3 } from "aws-sdk";
import log from "../lib/log";
import { Readable, PassThrough } from "stream";
import { ManagedUpload, Metadata } from "aws-sdk/clients/s3";
import { Tag } from "./arweave";

const buckets: { [key in BucketType]: string } = {
  "tx-data": process.env.ARWEAVE_S3_TX_DATA_BUCKET!,
};

type BucketType = "tx-data";

export type BucketObject = S3.GetObjectOutput;

const s3 = new S3({
  httpOptions: { timeout: 30000, connectTimeout: 5000 },
  logger: console,
});

export const put = async (
  bucketType: BucketType,
  key: string,
  body: Buffer | Readable,
  { contentType, tags }: { contentType?: string; tags?: Tag[] }
) => {
  const bucket = buckets[bucketType];

  log.info(`[s3] uploading to bucket`, {
    bucket,
    key,
    type: contentType,
    tags,
  });

  await s3
    .upload({
      Key: key,
      Bucket: bucket,
      Body: body,
      ContentType: contentType,
      Metadata: {
        ...(tags ? { "x-arweave-tags": JSON.stringify(tags) } : {}),
      },
    })
    .promise();
};

export const putStream = async (
  bucketType: BucketType,
  key: string,
  {
    contentType,
    contentLength,
    tags,
  }: { contentType?: string; contentLength?: number; tags?: Tag[] }
): Promise<{ upload: ManagedUpload; stream: PassThrough }> => {
  const bucket = buckets[bucketType];

  log.info(`[s3] uploading to bucket`, {
    bucket,
    key,
    type: contentType,
    tags,
  });

  const cacheStream = new PassThrough({
    objectMode: false,
    autoDestroy: true,
  });

  const upload = s3.upload({
    Key: key,
    Bucket: bucket,
    Body: cacheStream,
    ContentType: contentType,
    ContentLength: contentLength,
    Metadata: {
      "x-arweave-tags": JSON.stringify(tags),
    },
  });

  return { stream: cacheStream, upload };
};

export const get = async (
  bucketType: BucketType,
  key: string
): Promise<BucketObject> => {
  const bucket = buckets[bucketType];
  log.info(`[s3] getting data from bucket`, { bucket, key });
  return s3
    .getObject({
      Key: key,
      Bucket: bucket,
    })
    .promise();
};

export const getStream = async (
  bucketType: BucketType,
  key: string
): Promise<{
  contentType?: string;
  contentLength: number;
  stream: Readable;
  tags?: Tag[];
}> => {
  const bucket = buckets[bucketType];
  log.info(`[s3] getting stream from bucket`, { bucket, key });

  const { ContentType, ContentLength, Metadata } = await s3
    .headObject({
      Key: key,
      Bucket: bucket,
    })
    .promise();

  return {
    contentLength: ContentLength || 0,
    contentType: ContentType,
    tags: parseMetadataTags(Metadata || {}),
    stream: s3
      .getObject({
        Key: key,
        Bucket: bucket,
      })
      .createReadStream(),
  };
};

export const objectHeader = async (
  bucketType: BucketType,
  key: string
): Promise<{
  contentType?: string;
  contentLength: number;
  tags?: Tag[];
}> => {
  const bucket = buckets[bucketType];

  const { ContentType, ContentLength, Metadata } = await s3
    .headObject({
      Key: key,
      Bucket: bucket,
    })
    .promise();

  return {
    contentLength: ContentLength || 0,
    contentType: ContentType,
    tags: parseMetadataTags(Metadata || {}),
  };
};

const parseMetadataTags = (metadata: Metadata): Tag[] => {
  const rawTags = metadata["x-arweave-tags"];

  if (rawTags) {
    try {
      return JSON.parse(rawTags) as Tag[];
    } catch (error) {
      log.info(`[s3] error parsing tags`, { metadata, rawTags });
    }
  }

  return [];
};
