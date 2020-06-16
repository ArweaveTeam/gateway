import fetch from "node-fetch";
import log from "../lib/log";
import { Chunk, Transaction } from "./arweave";

export async function broadcastTx(tx: Transaction, hosts: string[]) {
  log.info(`[broadcast-tx] broadcasting new tx`, { id: tx.id });
  await Promise.all(
    hosts.map(async (host) => {
      await retry(
        {
          retryCount: 5,
          retryDelay: 1000,
          timeout: 10000,
        },
        async (attempt) => {
          log.info(`[broadcast-tx] sending`, { attempt, host, id: tx.id });

          const { status: existingStatus, ok: isReceived } = await fetch(
            `${host}/tx/${tx.id}/id`
          );

          if (isReceived) {
            log.info(`[broadcast-tx] already received`, {
              attempt,
              host,
              id: tx.id,
              existingStatus,
            });
            return true;
          }

          const { status: postStatus, ok: postOk } = await fetch(`${host}/tx`, {
            method: "POST",
            body: JSON.stringify(tx),
            headers: { "Content-Type": "application/json" },
            timeout: 10000,
          });

          log.info(`[broadcast-tx] sent`, {
            attempt,
            host,
            id: tx.id,
            postStatus,
          });

          return postOk;
        },
        (error, attempt) => {
          log.warn(`[broadcast-tx] warning`, {
            error: error.message,
            attempt,
            host,
            id: tx.id,
          });
        }
      ).catch((error) => {
        log.error(`[broadcast-tx] failed`, {
          id: tx.id,
          host,
          error: error.message,
        });
      });
    })
  );
}

export async function broadcastChunk(chunk: Chunk, hosts: string[]) {
  log.info(`[broadcast-chunk] broadcasting new chunk`, {
    chunk: chunk.data_root,
  });
  await Promise.all(
    hosts.map(async (host) => {
      await retry(
        {
          retryCount: 5,
          retryDelay: 1000,
          timeout: 10000,
        },
        async (attempt) => {
          log.info(`[broadcast-tx] sending`, {
            attempt,
            host,
            chunk: chunk.data_root,
          });

          const { ok: postOk, status: postStatus } = await fetch(
            `${host}/chunk`,
            {
              method: "POST",
              body: JSON.stringify(chunk),
              headers: { "Content-Type": "application/json" },
              timeout: 10000,
            }
          );

          log.info(`[broadcast-chunk] sent`, {
            attempt,
            host,
            chunk: chunk.data_root,
            postStatus,
          });

          return postOk;
        },
        (error, attempt) => {
          log.warn(`[broadcast-chunk] warning`, {
            error: error.message,
            attempt,
            host,
            chunk: chunk.data_root,
          });
        }
      ).catch((error) => {
        log.error(`[broadcast-chunk] failed`, {
          chunk: chunk.data_root,
          host,
          error: error.message,
        });
      });
    })
  );
}

const wait = async (timeout: number) =>
  new Promise((resolve) => setTimeout(resolve, timeout));

const retry = async <T>(
  {
    retryCount,
    retryDelay,
    timeout,
  }: {
    retryCount: number;
    retryDelay: number;
    timeout?: number;
  },
  action: (attempt: number) => Promise<T>,
  onError?: (error: any, attempt: number) => any
): Promise<T | undefined> => {
  return new Promise(async (resolve, reject) => {
    setTimeout(() => {
      reject(`Timeout: operation took longer than ${timeout}ms`);
    }, timeout);
    for (let attempt = 1; attempt < retryCount + 1; attempt++) {
      try {
        const result = await action(attempt);
        if (result) {
          resolve(result);
        }
        await wait(retryDelay * attempt);
      } catch (error) {
        if (onError) {
          await onError(error, attempt);
        }
      }
    }
  });
};
