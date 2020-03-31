import { S3 } from "aws-sdk";
import { toB64url, Base64UrlEncodedString } from "./encoding";

const buckets: { [key in BucketType]: string } = {
  "tx-data": process.env.ARWEAVE_S3_TX_DATA_BUCKET!
};

type BucketType = "tx-data";

export type BucketObject = S3.GetObjectOutput;

const s3 = new S3();

export const put = async (
  bucketType: BucketType,
  key: string,
  body: Buffer,
  { contentType }: { contentType?: string }
) => {
  const bucket = buckets[bucketType];
  console.log(
    `Uploading to bucket:${bucket}, key: ${key}, contentType: ${contentType}`
  );
  await s3
    .upload({
      Key: key,
      Bucket: bucket,
      Body: body,
      ContentType: contentType
    })
    .promise();
};

export const getEncoded = async (
  bucketType: BucketType,
  key: string
): Promise<Base64UrlEncodedString> => {
  return get(bucketType, key).then(bucketObject =>
    toB64url(bucketObject.Body as Buffer)
  );
};

export const get = async (
  bucketType: BucketType,
  key: string
): Promise<BucketObject> => {
  const bucket = buckets[bucketType];
  console.log(`Getting from bucket:${bucket}, key: ${key}`);
  return s3
    .getObject({
      Key: key,
      Bucket: bucket
    })
    .promise();
};
