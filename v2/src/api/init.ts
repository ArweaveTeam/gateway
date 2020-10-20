import express, { Express } from "express";
import { setStorageDriver } from "../arweave/cache";
import { configureMonitoring, setHosts } from "../arweave/nodes";
import { createQueue, enqueue, setQueueDriver } from "../queue";
// import { LocalStorageDriver } from "../lib/storage/driver/local-driver";
import { RedisQueueDriver } from "../lib/queue/driver/redis";

import { SQSQueueDriver } from "../lib/queue/driver/sqs";
import { LocalStorageDriver } from "../lib/storage/driver/local-driver";

export const init = async (): Promise<Express> => {
  setHosts([
    "http://lon-1.eu-west-1.arweave.net:1984",
    "http://lon-2.eu-west-1.arweave.net:1984",
    "http://lon-3.eu-west-1.arweave.net:1984",
    "http://lon-4.eu-west-1.arweave.net:1984",
    "http://lon-5.eu-west-1.arweave.net:1984",
    "http://lon-6.eu-west-1.arweave.net:1984",
  ]);

  configureMonitoring({
    enabled: true,
    interval: 5000,
    timeout: 2000,
    log: true,
  });

  setStorageDriver(new LocalStorageDriver());

  // setStorageDriver(new LocalStorageDriver());

  // setQueueDriver(
  //   new RedisQueueDriver({
  //     prefix: process.env.RSMQ_PREFIX!,
  //     connection: process.env.REDIS_CONNECTION!,
  //   })
  // );

  setQueueDriver(
    new SQSQueueDriver({
      aws: {
        region: process.env.AWS_REGION!,
        accountId: parseInt(process.env.AWS_ACCOUNT_ID!),
        prefix: process.env.SQS_PREFIX!,
      },
    })
  );

  console.log(await enqueue("import-tx", { test: 1 }));

  await Promise.all([
    createQueue("dispatch-tx"),
    createQueue("import-tx"),
    createQueue("import-bundle"),
    createQueue("import-block"),
    createQueue("import-chunk"),
    createQueue("export-chunk"),
  ]);

  return express();
};
