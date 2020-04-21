import fetch, { Response as FetchResponse } from "node-fetch";
import AbortController from "abort-controller";

export type OriginResponse = FetchResponse;

const origins = JSON.parse(
  process.env.ARWEAVE_GATEWAY_ORIGINS || "null"
) as string[];

if (!Array.isArray(origins)) {
  throw new Error(
    `error.config: Invalid env var, process.env.ARWEAVE_GATEWAY_ORIGINS: ${process.env.ARWEAVE_GATEWAY_ORIGINS}`
  );
}

console.log(`app.config.origins: ${origins.join(", ")}`);

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
 * @param path
 * @param filter
 */
export async function firstResponse(
  endpoint: string,
  filter?: (origin: string, url: string, response: OriginResponse) => boolean
): Promise<{
  origin: string;
  originResponse: OriginResponse;
  originTime: number;
}> {
  const controllers: [string, AbortController][] = [];

  return new Promise(async (resolve, reject) => {
    await Promise.all(
      origins.map(async (origin) => {
        const controller = new AbortController();
        const signal = controller.signal;

        controllers.push([origin, controller]);

        const startMs = Date.now();
        const url = `${origin}/${endpoint}`;

        console.log(url);
        try {
          const originResponse = await fetch(url, {
            signal,
          });

          const endMs = Date.now();

          if (filter && filter(origin, url, originResponse)) {
            controllers.forEach(
              ([host, controller]) => host != origin && controller.abort()
            );
            resolve({ origin, originResponse, originTime: endMs - startMs });
          }

          if (
            !filter &&
            originResponse.status >= 200 &&
            originResponse.status <= 300
          ) {
            controllers.forEach(
              ([host, controller]) => host != origin && controller.abort()
            );

            resolve({ origin, originResponse, originTime: endMs - startMs });
          }
        } catch (error) {
          if (error.name != "AbortError") {
            console.error(`origin.error: ${error}`);
            console.error(error);
          }
        }
      })
    );
    reject(new Error("no_response"));
  });
}
