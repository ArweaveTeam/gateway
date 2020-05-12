import fetch, { Response } from "node-fetch";

export async function broadcastTx(tx: any, hosts: string[]) {
  await Promise.all(
    hosts.map(async (host) => {
      await retry(
        {
          retryCount: 5,
          retryDelay: 500,
          timeout: 30000,
        },
        async (attempt) => {
          const { status: txStatus } = await fetch(`${host}/tx/${tx.id}/id`);

          console.log(
            `status attempt: ${attempt}, host: ${host}, status: ${txStatus}`
          );
          if ([200, 202, 208].includes(txStatus)) {
            return true;
          }

          const { ok, status } = await fetch(`${host}/tx`, {
            method: "POST",
            body: JSON.stringify(tx),
            headers: { "Content-Type": "application/json" },
            timeout: 30,
          });
          console.log(`attempt: ${attempt}, host: ${host}, status: ${status}`);
          return ok;
        },
        (error, attempt) => {
          `attempt: ${attempt}, host: ${host}, error: ${error}`;
        }
      ).catch((error) => {
        console.error(`Failed to send to: ${host}`, error);
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
