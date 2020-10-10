import RedisSMQ from "rsmq";
import { log } from "../log";

const rsmq = new RedisSMQ({
  options: { url: process.env.REDIS_CONNECTION },
  ns: process.env.REDIS_SMQ_NAMESPACE,
});

export const createQueue = async function (
  name: string,
  options: Partial<RedisSMQ.CreateQueueOptions>
): Promise<void> {
  try {
    rsmq.createQueueAsync({ qname: name, ...options });
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

export const sendMessage = rsmq.sendMessageAsync;
