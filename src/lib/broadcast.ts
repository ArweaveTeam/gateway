import fetch from "node-fetch";
import log from "../lib/log";
import { Chunk, Transaction } from "./arweave";

export async function broadcastTx(tx: Transaction, hosts: string[]) {
  log.info(`[broadcast-tx] broadcasting new tx`, { id: tx.id });

  let tmpHosts: string[] = JSON.parse(JSON.stringify(hosts));
  let submitted = false;
  while(!submitted) {
    const index = Math.floor(Math.random()*tmpHosts.length);
    const host = tmpHosts[index];

    log.info(`[broadcast-tx] sending`, { host, id: tx.id });
    try {
      const { status: existingStatus, ok: isReceived } = await fetch(
        `${host}/tx/${tx.id}/id`
      );

      if (isReceived) {
        log.info(`[broadcast-tx] already received`, {
          host,
          id: tx.id,
          existingStatus,
        });
        submitted = true;
        break;
      }

      const { status: postStatus, ok: postOk } = await fetch(`${host}/tx`, {
        method: "POST",
        body: JSON.stringify(tx),
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });

      log.info(`[broadcast-tx] sent`, {
        host,
        id: tx.id,
        postStatus,
      });

      // Don't even retry on these codes
      if ([400, 410].includes(postStatus)) {
        log.error(`[broadcast-tx] failed`, {
          id: tx.id,
          host,
          error: postStatus,
        });
        tmpHosts.splice(index, 1);
        if(!tmpHosts.length) {
          tmpHosts = JSON.parse(JSON.stringify(hosts));
        }
      }

      submitted = true;
    } catch (e) {
      log.error(`[broadcast-tx] failed`, {
        id: tx.id,
        host,
        error: e.message,
      });
      tmpHosts.splice(index, 1);
      if(!tmpHosts.length) {
        tmpHosts = JSON.parse(JSON.stringify(hosts));
      }
    }
  }
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
            retryCount: 2,
            retryDelay: 1000,
            timeout: 10000,
          },
          async (attempt, { reject }) => {
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

            if (!response.ok) {
              log.warn(`[broadcast-chunk] response`, {
                attempt,
                host,
                chunk: chunk.data_root,
                status: response.status,
                body: await response.text(),
              });
            }

            // Don't even retry on these codes
            if ([400, 410].includes(response.status)) {
              reject(response.status);
              return false;
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
        log.warn(`[broadcast-chunk] failed to broadcast: ${host}`, {
          error: error.message,
          chunk: chunk.data_root,
        });
      }
    })
  );

  if (success < 3) {
    throw new Error(`Failed to successfully broadcast to >=3 nodes`);
  }

  log.log(`[broadcast-chunk] complete`, {
    success,
  });
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
