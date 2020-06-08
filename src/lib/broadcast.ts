import fetch from "node-fetch";
import log from "../lib/log";

export async function broadcastTx(tx: any, hosts: string[]) {
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

          const { status: txStatus } = await fetch(`${host}/tx/${tx.id}/id`);

          if ([200, 202, 208].includes(txStatus)) {
            log.info(`[broadcast-tx] already received`, {
              attempt,
              host,
              id: tx.id,
              txStatus,
            });
            return true;
          }

          const { ok, status } = await fetch(`${host}/tx`, {
            method: "POST",
            body: JSON.stringify(tx),
            headers: { "Content-Type": "application/json" },
            timeout: 10000,
          });

          log.info(`[broadcast-tx] sent`, {
            attempt,
            host,
            id: tx.id,
            status,
          });

          await wait(200);

          const { status: confirmationStatus } = await fetch(
            `${host}/tx/${tx.id}/id`
          );

          if ([200, 202, 208].includes(confirmationStatus)) {
            log.info(`[broadcast-tx] delivered`, {
              attempt,
              host,
              id: tx.id,
              txStatus,
            });
            return true;
          } else {
            log.warn(`[broadcast-tx] not delivered`, {
              attempt,
              host,
              id: tx.id,
              txStatus,
            });
          }

          return ok;
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
