import { createClient } from "redis";
import { promisify } from "util";
import log from "./log";

const host = process.env.REDIS_HOST || "localhost";
const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;

log.info(`[redis] Redis client connecting...`, { host, port });

const client = createClient(port, host, {
  string_numbers: true,
  enable_offline_queue: false,
});

const reportEvent = (event: string, level: string = "info") => {
  return (error?: any) => {
    log.log(level, `[redis] Redis client event`, { event, error });
  };
};

["connect", "ready", "reconnecting", "end"].forEach((event) => {
  client.on(event, reportEvent(event));
});

["error", "warning"].forEach((event) => {
  client.on(event, reportEvent(event, "error"));
});

client
  .on("error", reportEvent("error", "error"))
  .on("warning", reportEvent("warning", "warning"));

const redisGet = promisify(client.get).bind(client);
const redistSet = promisify(client.set).bind(client);
const redisExpire = promisify(client.expire).bind(client);
const redisFlushDb = promisify(client.flushdb).bind(client);
const redisPing = promisify(client.dbsize).bind(client);

export const purge = async () => {
  log.info(`[redis] purging cache`);
  await redisFlushDb();
};

interface GetOptions<T> extends SetOptions {
  fetch: () => Promise<T>;
}

export const get = async <T = undefined>(
  key: string,
  { fetch, ttl }: GetOptions<T>
): Promise<T> => {
  log.info(`[redis] getting key`, { key });
  try {
    const value = (await redisGet(key)) || undefined;

    if (value !== undefined) {
      return JSON.parse(value);
    }

    if (fetch) {
      const fetchedValue = await fetch();
      await set(key, fetchedValue, { ttl });
      return fetchedValue;
    }
  } catch (error) {
    log.error(`[redis] client error fetching key`, { key, error: error });
  }
  return fetch();
};

interface SetOptions {
  ttl?: number;
}

export const set = async (
  key: string,
  value: any,
  { ttl = 0 }: SetOptions = {}
) => {
  log.info(`[redis] setting key`, { key, ttl });
  await redistSet(key, JSON.stringify(value));
  if (ttl) {
    await redisExpire(key, ttl);
  }
};

export const ping = async () => {
  return redisPing();
};
