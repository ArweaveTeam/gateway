import { APIHandler } from "../../lib/api-handler";
import fetch from "node-fetch";

const origins = JSON.parse(
  process.env.ARWEAVE_GATEWAY_ORIGINS || "null"
) as string[];

if (!Array.isArray(origins)) {
  throw new Error(
    `error.config: Invalid env var, process.env.ARWEAVE_GATEWAY_ORIGINS: ${process.env.ARWEAVE_GATEWAY_ORIGINS}`
  );
}

export const handler: APIHandler = async (request, response) => {
  response.status(200).json({
    region: process.env.AWS_REGION,
    origins: await Promise.all(
      origins.map(async (originUrl) => {
        console.log("originUrl", originUrl);
        try {
          const response = await fetch(`${originUrl}/info`);
          return {
            endpoint: originUrl,
            status: response.status,
            info: await response.json(),
          };
        } catch (error) {
          console.error(error);
          return error;
        }
      })
    ),
  });
};
