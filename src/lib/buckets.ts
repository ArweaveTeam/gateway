import { S3 } from "aws-sdk";
import log from "../lib/log";
import { Readable, PassThrough } from "stream";
import { ManagedUpload } from "aws-sdk/clients/s3";

const buckets: { [key in BucketType]: string } = {
  "tx-data": process.env.ARWEAVE_S3_TX_DATA_BUCKET!,
};

type BucketType = "tx-data";

export type BucketObject = S3.GetObjectOutput;

const s3 = new S3({
  httpOptions: { timeout: 5000, connectTimeout: 5000 },
  logger: console,
});

export const put = async (
  bucketType: BucketType,
  key: string,
  body: Buffer | Readable,
  { contentType }: { contentType?: string }
) => {
  const bucket = buckets[bucketType];

  log.info(`[s3] uploading to bucket`, { bucket, key, type: contentType });

  await s3
    .upload({
      Key: key,
      Bucket: bucket,
      Body: body,
      ContentType: contentType,
    })
    .promise();
};

export const putStream = async (
  bucketType: BucketType,
  key: string,
  stream: PassThrough,
  {
    contentType,
    contentLength,
  }: { contentType?: string; contentLength?: number }
): Promise<{ upload: ManagedUpload; stream: PassThrough }> => {
  const bucket = buckets[bucketType];

  log.info(`[s3] uploading to bucket`, { bucket, key, type: contentType });

  const upload = s3.upload({
    Key: key,
    Bucket: bucket,
    Body: stream,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  return { stream, upload };
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
  contentType: string | undefined;
  contentLength: number;
  stream: Readable;
}> => {
  const bucket = buckets[bucketType];
  log.info(`[s3] getting stream from bucket`, { bucket, key });

  const { ContentType, ContentLength } = await s3
    .headObject({
      Key: key,
      Bucket: bucket,
    })
    .promise();

  return {
    contentLength: ContentLength || 0,
    contentType: ContentType,
    stream: s3
      .getObject({
        Key: key,
        Bucket: bucket,
      })
      .createReadStream(),
  };
};
