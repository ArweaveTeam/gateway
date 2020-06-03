import { S3 } from "aws-sdk";
import log from "../lib/log";

const buckets: { [key in BucketType]: string } = {
  "tx-data": process.env.ARWEAVE_S3_TX_DATA_BUCKET!,
};

type BucketType = "tx-data";

export type BucketObject = S3.GetObjectOutput;

const s3 = new S3({ httpOptions: { timeout: 5000, connectTimeout: 5000 } });

export const put = async (
  bucketType: BucketType,
  key: string,
  body: Buffer,
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
