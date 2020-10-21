import { dirname, resolve } from "path";
import {
  StorageDriver,
  PutObjectStream,
  GetObjectStream,
  GetObjectStreamResponse,
} from "..";
import createHttpError from "http-errors";
import { S3 } from "aws-sdk";

import { PassThrough, Readable } from "stream";

const s3 = new S3({
  maxRetries: 3,
  httpOptions: { timeout: 10000, connectTimeout: 5000 },
});

export class S3Driver implements StorageDriver {
  config = {
    log: false,
    bucket: process.env.S3_BUCKET!,
  };

  getObjectStream: GetObjectStream = async (key: string) => {
    return new Promise(async (resolve, reject) => {
      this.log(`[s3] getting object ${key}`);
      const download = s3.getObject({
        Bucket: this.config.bucket,
        Key: key,
      });

      const onError = (error: any) => {
        this.error(`[s3] key: ${key}, error: ${error}`);
        reject(error);
      };

      let done = false;

      const onResponse = (status: number, headers: any) => {
        if (done) {
          return;
        } else {
          done = true;
        }
        if (status == 200) {
          const contentType = headers["content-type"];

          const contentLength = headers["content-length"]
            ? parseInt(headers["content-length"])
            : 0;

          this.log(
            `[s3] getting object success ${key}, status: ${status}, contentType: ${contentType}, contentLength: ${contentLength}`
          );

          return resolve({
            stream: download.createReadStream(),
            contentType,
            contentLength,
          });
        }
        this.error(`[s3] key: ${key}, status: ${status}, headers: ${headers}`);
        reject(createHttpError(status));
      };

      download.on("httpHeaders", onResponse);

      download.on("error", onError);

      download.send();
    });
  };

  putObjectStream: PutObjectStream = async (
    key,
    { contentType, contentLength } = {}
  ) => {
    this.log(
      `[s3] uploading object ${key}, contentType: ${contentType}, contentLength: ${contentLength}`
    );
    const stream = new PassThrough({
      objectMode: false,
      autoDestroy: true,
    });

    const upload = await s3.upload(
      {
        Key: key,
        Bucket: this.config.bucket,
        Body: stream,
        ContentType: contentType,
        ContentLength: contentLength,
      },
      {
        // partSize: 5 * 1024 * 1024
        // queueSize: 2,
      },
      // We need to leave this empty noop callback here as the AWS
      // method expects a callback. Removing this will break it.
      () => {}
    );

    const streamHandler = (resolve: Function, reject: Function) => {
      stream.on("error", (error) => {
        this.error(`[s3] error uploading object ${key}, error: ${error}`);
        upload.abort();
        reject(error);
      });
      stream.on("end", () => {
        this.log(
          `[s3] uploading object ${key} input stream ended, starting upload`
        );
        upload.send((err, data) => {
          if (err) {
            this.error(`[s3] error uploading object ${key}, error: ${err}`);
            reject(err);
          }
          this.log(`[s3] uploading object complete ${key}`);
          resolve();
        });
      });
    };

    const onUploadComplete = new Promise<void>(streamHandler)
      .then(() => {})
      .catch(() => {});

    return {
      stream: stream,
      onUploadComplete,
    };
  };

  log(line: string) {
    if (this.config.log) {
      console.log(line);
    }
  }

  error(line: string) {
    console.error(line);
  }
}

/**
 * We want to normalize some errors like not found to a generic 404,
 * s3, localstorage etc will have different errors but we don't care
 * about that outside of this module and need to be able to catch them.
 *
 * So just throw a generic 404 in these cases.
 * @param error
 */
const normalizeError = (error: any) => {
  return error.code == "ENOENT" ? createHttpError(404) : error;
};
