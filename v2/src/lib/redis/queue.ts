import RedisSMQ from "rsmq";
import { log } from "../log";

export type QueueName =
  | "dispatch-tx"
  | "import-tx"
  | "import-bundle"
  | "import-block"
  | "import-chunk"
  | "export-chunk";

const rsmq = new RedisSMQ({
  options: { url: process.env.REDIS_CONNECTION },
  ns: process.env.REDIS_SMQ_NAMESPACE,
});

export const createQueue = async function (
  name: QueueName,
  options: Partial<RedisSMQ.CreateQueueOptions> = {}
): Promise<void> {
  try {
    await rsmq.createQueueAsync({ qname: name, ...options });
    log.info(`Queue created: ${name}`);
  } catch (error) {
    if (error.name == "queueExists") {
      log.info(`Queue already exists: ${name}`);
      return;
    }
    throw error;
  }
};

export const listQueues = rsmq.listQueuesAsync;

export const enqueue = async (queueName: string, message: any) => {
  rsmq.sendMessageAsync({
    qname: queueName,
    message: JSON.stringify(message),
  });
};
