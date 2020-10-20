import { createReadStream, createWriteStream, ReadStream } from "fs";
import { dirname, resolve } from "path";
import { access, ensureDir, readJson, writeJson, stat, unlink } from "fs-extra";
import { StorageDriver, PutObjectStream, GetObjectStream } from "..";
import createHttpError from "http-errors";

export class LocalStorageDriver implements StorageDriver {
  getObjectStream = getObjectStream;
  putObjectStream = putObjectStream;
}

const getObjectStream: GetObjectStream = async (key: string) => {
  const path = resolve(key);

  return new Promise(async (resolve, reject) => {
    const stream = createReadStream(path);

    stream.once("readable", async () => {
      try {
        const { contentType, contentLength } = await getMeta(path);

        resolve({ stream, contentType, contentLength });
      } catch (error) {
        stream.destroy();
        throw normalizeError(error);
      }
    });

    stream.once("error", (error: any) => {
      reject(normalizeError(error));
    });
  });
};

const putObjectStream: PutObjectStream = async (
  key,
  { contentType, contentLength } = {}
) => {
  const path = resolve(key);

  await ensureDir(dirname(path));

  const stream = createWriteStream(path, { flags: "w" });

  console.log(`Writing: ${key}`);

  const cancel = () => {
    console.log(
      `Removing incomplete file: ${key}, expected ${contentLength} bytes, received ${stream.bytesWritten} bytes`
    );
    return unlink(path);
  };

  stream.once("finish", () => {
    console.log(`Writing: ${key}.meta.json`);

    if (contentLength && contentLength != stream.bytesWritten) {
      cancel();
    }

    writeJson(`${path}.meta.json`, {
      "content-type": contentType,
    });
  });

  // If there's an error on the write stream we don't want to leave
  // the incomplete file on disk, so simply remove it.
  stream.once("error", (error) => {
    stream.destroy(error);
    cancel();
  });

  return { stream };
};

const getMeta = async (
  path: string
): Promise<{ contentType: string; contentLength: number }> => {
  const [contentType, contentLength] = await Promise.all([
    getContentType(path),
    getContentLength(path),
  ]);

  return {
    contentType,
    contentLength,
  };
};

const getContentType = async (path: string) => {
  try {
    const metaPath = `${path}.meta.json`;

    const meta = await readJson(metaPath, { throws: false });
    return meta["content-type"];
  } catch (error) {
    throw normalizeError(error);
  }
};

const getContentLength = async (path: string) => {
  try {
    return (await stat(path)).size;
  } catch (error) {
    throw normalizeError(error);
  }
};

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
