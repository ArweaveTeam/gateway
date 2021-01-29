import { createClient, RedisClient } from 'redis'
import { promisify } from 'util'
import log from './log'

const host = process.env.REDIS_HOST || 'localhost'
const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379
const enableOfflineQueue = !!process.env.REDIS_OFFLINE_QUEUE

log.info(`[redis] Redis client connecting...`, {
  host,
  port,
  enableOfflineQueue,
})

export const client: RedisClient = createClient(port, host, {
  string_numbers: true,
  enable_offline_queue: enableOfflineQueue,
})

const reportEvent = (event: string, level: string = 'info') => {
  return (error?: any) => {
    log.log(level, `[redis] Redis client event`, { event, error })
  }
};

['connect', 'ready', 'reconnecting', 'end'].forEach((event) => {
  client.on(event, reportEvent(event))
});

['error', 'warning'].forEach((event) => {
  client.on(event, reportEvent(event, 'error'))
})

client
    .on('error', reportEvent('error', 'error'))
    .on('warning', reportEvent('warning', 'warning'))

const redistSet = promisify(client.set).bind(client)
const redisExpire = promisify(client.expire).bind(client)
const redisPing = promisify(client.dbsize).bind(client)

export const purge = async () => {
  log.info(`[redis] purging cache`)
  client.flushall('ASYNC')
}

interface SetOptions {
  ttl?: number;
}

interface GetOptions<T> extends SetOptions {
  fetch: () => Promise<T>;
}

export const get = async <T = undefined>(
  key: string,
  { fetch, ttl }: GetOptions<T>,
): Promise<T> => {
  return await fetch()
}

export const set = async (
    key: string,
    value: any,
    { ttl = 0 }: SetOptions = {},
) => {
  log.info(`[redis] setting key`, { key, ttl })
  await redistSet(key, JSON.stringify(value))
  if (ttl) {
    await redisExpire(key, ttl)
  }
}

export const ping = async () => {
  return redisPing()
}
