import { CreateQueue, Enqueue, QueueDriver } from "../lib/queue";

const config: {
  driver?: QueueDriver;
} = {};

export type QueueName =
  | "dispatch-tx"
  | "import-tx"
  | "import-bundle"
  | "import-block"
  | "import-chunk"
  | "export-chunk";

export const createQueue = (key: QueueName) => {
  return getQueueDriver().createQueue(key);
};

export const enqueue = <T = any>(key: QueueName, message: T) => {
  return getQueueDriver().enqueue(key, message);
};

export const setQueueDriver = (driver: QueueDriver): void => {
  config.driver = driver;
};

export const getQueueDriver = (): QueueDriver => {
  if (config.driver) {
    return config.driver;
  }

  throw new Error(`queue driver not configured`);
};
