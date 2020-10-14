import fetch from "node-fetch";
import { RequestHandler } from "express";
import { getLatestBlock } from "../../../database/block-db";
import { getConnectionPool } from "../../../database/postgres";
import log from "../../../lib/log";

const origins = JSON.parse(process.env.ARWEAVE_NODES || "null") as string[];

if (!Array.isArray(origins)) {
  throw new Error(
    `error.config: Invalid env var, process.env.ARWEAVE_NODES: ${process.env.ARWEAVE_NODES}`
  );
}

export const handler: RequestHandler = async (req, res) => {
  const healthStatus = {
    region: process.env.AWS_REGION,
    origins: await originHealth(),
    database: await databaseHealth(),
  };
  res.send(healthStatus).end();
};

const originHealth = async () => {
  try {
    return await Promise.all(
      origins.map(async (originUrl) => {
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
    );
  } catch (error) {
    log.error(`[health-check] database error`, { error });
    return false;
  }
};

const databaseHealth = async () => {
  try {
    const pool = getConnectionPool("read");
    return { block: await getLatestBlock(pool) };
  } catch (error) {
    log.error(`[health-check] database error`, { error });
    return false;
  }
};
