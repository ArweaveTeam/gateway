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
        async (attempt, { reject }) => {
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

          // Don't even retry on these codes
          if ([400, 410].includes(postStatus)) {
            reject(postStatus);
          }

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

  let success = 0;

  await Promise.all(
    hosts.map(async (host) => {
      try {
        await retry(
          {
            retryCount: 3,
            retryDelay: 500,
            timeout: 5000,
          },
          async (attempt, { reject }) => {
            log.info(`[broadcast-chunk] sending`, {
              attempt,
              host,
              chunk: chunk.data_root,
            });

            const response = await fetch(`${host}/chunk`, {
              method: "POST",
              body: JSON.stringify({
                ...chunk,
                data_size: chunk.data_size.toString(),
                offset: chunk.offset.toString(),
              }),
              headers: { "Content-Type": "application/json" },
              timeout: 10000,
            });

            log.info(`[broadcast-chunk] sent`, {
              attempt,
              host,
              chunk: chunk.data_root,
              status: response.status,
              body: await response.text(),
            });

            // Don't even retry on these codes
            if ([400, 410].includes(response.status)) {
              reject(response.status);
            }

            return response.ok;
          },
          (error, attempt) => {
            log.warn(`[broadcast-chunk] warning`, {
              error: error.message,
              attempt,
              host,
              chunk: chunk.data_root,
            });
          }
        );

        success++;
      } catch (error) {
        log.warn(`[broadcast-chunk] failed to broadcast`, {
          error: error.message,
          host,
          chunk: chunk.data_root,
        });
      }
    })
  );

  log.warn(`[broadcast-chunk] complete`, {
    success,
  });

  if (success < 3) {
    throw new Error(`Failed to successfully broadcast to >=3 nodes`);
  }
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
  action: (
    attempt: number,
    options: { resolve: Function; reject: Function }
  ) => Promise<T>,
  onError?: (error: any, attempt: number) => any
): Promise<T | undefined> => {
  return new Promise(async (resolve, reject) => {
    setTimeout(() => {
      reject(`Timeout: operation took longer than ${timeout}ms`);
    }, timeout);
    let lastError: Error | undefined;
    for (let attempt = 1; attempt < retryCount + 1; attempt++) {
      lastError = undefined;
      try {
        const result = await action(attempt, { resolve, reject });
        if (result) {
          resolve(result);
          return;
        }
      } catch (error) {
        if (onError) {
          await onError(error, attempt);
        }
      }
      await wait(retryDelay * attempt);
    }
    if (lastError) {
      reject(lastError);
    }
    reject();
  });
};
