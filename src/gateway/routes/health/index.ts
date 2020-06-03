import fetch from "node-fetch";
import { RequestHandler } from "express";
import { getLatestBlock } from "../../../database/block-db";
import { getConnectionPool } from "../../../database/postgres";

const origins = JSON.parse(process.env.ARWEAVE_NODES || "null") as string[];

if (!Array.isArray(origins)) {
  throw new Error(
    `error.config: Invalid env var, process.env.ARWEAVE_NODES: ${process.env.ARWEAVE_NODES}`
  );
}

export const handler: RequestHandler = async (req, res, next) => {
  const healthStatus = {
    region: process.env.AWS_REGION,
    origins: await originHealth(),
    database: await databaseHealth(),
  };
  res.send(healthStatus);
};

const originHealth = async () => {
  try {
    return await Promise.all(
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
    );
  } catch (error) {
    false;
  }
};

const databaseHealth = async () => {
  try {
    const pool = getConnectionPool("read");
    return { block: await getLatestBlock(pool) };
  } catch (error) {
    console.error(error);
    return false;
  }
};
