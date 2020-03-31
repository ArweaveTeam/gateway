import fetch, { Response } from "node-fetch";

export async function broadcast(urls: string[], body: any) {
  await Promise.all(
    urls.map(async url => {
      await retry(
        {
          retryCount: 5,
          retryDelay: 500,
          timeout: 30000
        },
        async attempt => {
          const { ok, status } = await fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
            timeout: 30
          });
          console.log(`attempt: ${attempt}, url: ${url}, status: ${status}`);
          return ok;
        },
        (error, attempt) => {
          `attempt: ${attempt}, url: ${url}, error: ${error}`;
        }
      ).catch(error => {
        console.error(`Failed to send to: ${url}`, error);
      });
    })
  );
}

const wait = async (timeout: number) =>
  new Promise(resolve => setTimeout(resolve, timeout));

const retry = async <T>(
  {
    retryCount,
    retryDelay,
    timeout
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
