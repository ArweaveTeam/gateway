import RedisSMQ from "rsmq";
import { CreateQueue, Enqueue, QueueDriver } from "..";

export class RedisQueueDriver implements QueueDriver {
  createQueue = createQueue;
  enqueue = enqueue;
}

const rsmq = new RedisSMQ({
  options: { url: process.env.REDIS_CONNECTION },
  ns: process.env.REDIS_SMQ_NAMESPACE,
});

export const createQueue: CreateQueue = async function (
  name: string
): Promise<void> {
  try {
    await rsmq.createQueueAsync({ qname: name });
    console.log(`Queue created: ${name}`);
  } catch (error) {
    if (error.name == "queueExists") {
      console.log(`Queue already exists: ${name}`);
      return;
    }
    throw error;
  }
};

export const enqueue: Enqueue = async (queueName: string, message: any) => {
  return rsmq.sendMessageAsync({
    qname: queueName,
    message: JSON.stringify(message),
  });
};
