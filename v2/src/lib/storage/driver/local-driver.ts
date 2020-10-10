import { createReadStream, createWriteStream } from "fs";
import { dirname, resolve } from "path";
import { access, ensureDir, readJson, writeJson } from "fs-extra";
import { PutObjectStream, GetObjectStream, StorageDriver } from "..";

export class LocalStorageDriver implements StorageDriver {
  protected basePath: string;

  constructor({ basePath }: { basePath: string }) {
    this.basePath = basePath;
  }

  getObjectStream: GetObjectStream = async (key: string) => {
    const path = resolve(key);

    const stream = await createReadStream(path);

    const meta = await this.readMeta(path);

    return { stream, contentType: meta.contentType };
  };

  putObjectStream: PutObjectStream = async (key, { contentType } = {}) => {
    const path = resolve(key);

    await ensureDir(dirname(path));

    const stream = createWriteStream(path, { flags: "w" });

    console.log(`Writing: ${key} to storage`);

    stream.on("finish", () => {
      console.log(`Writing: ${key}.meta.json to storage`);
      writeJson(`${path}.meta.json`, {
        contentType,
      });
    });

    return { stream };
  };

  protected readMeta = async (path: string) => {
    try {
      const metaPath = `${path}.meta.json`;

      await access(metaPath);

      return await readJson(metaPath);
    } catch (error) {
      return {};
    }
  };
}
