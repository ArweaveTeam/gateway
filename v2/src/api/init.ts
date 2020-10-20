import express, { Express } from "express";
import { setStorageDriver } from "../arweave/cache";
import { configureMonitoring, setHosts } from "../arweave/nodes";
import { createQueue } from "../lib/redis/queue";
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
