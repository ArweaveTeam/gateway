// import { get, HttpResponse } from "./http";
import fetch, { Response } from "node-fetch";

/**
 * Query the same endpoint across multiple origins and returns
 * the first response that satisfies the filter function. E.g.
 * Origins:
 * http://fra1.arweave.net:1984
 * http://lon1.arweave.net:1984
 * http://sgp1.arweave.net:1984
 *
 * Endpoint: block/current
 *
 * Gets requests for:
 * http://fra1.arweave.net:1984/block/current
 * http://lon1.arweave.net:1984/block/current
 * http://sgp1.arweave.net:1984/block/current
 *
 * And returns the first response that satisfies the filter
 * function by returning true.
 *
 * @param origins
 * @param path
 * @param filter
 */
export async function firstResponse(
  endpoint: string,
  origins: string[],
  filter: (origin: string, url: string, response: Response) => boolean
): Promise<{
  origin: string;
  originResponse: Response;
  originTime: number;
}> {
  return new Promise(async (resolve, reject) => {
    await Promise.all(
      origins.map(async origin => {
        const startMs = Date.now();
        const url = `${origin}/${endpoint}`;
        try {
          const originResponse = await fetch(url, {
            // redirect: "manual",
            // follow: 0
          });
          const endMs = Date.now();
          if (filter(origin, url, originResponse)) {
            resolve({ origin, originResponse, originTime: endMs - startMs });
          }
        } catch (error) {
          console.error(`origin.error: ${error}`);
        }
      })
    ).catch(reject);
    reject(new Error(`No valid origin response received: ${endpoint}`));
  });
}
