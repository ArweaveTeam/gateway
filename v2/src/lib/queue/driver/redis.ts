import RedisSMQ from "rsmq";
import { QueueDriver } from "..";

export class RedisQueueDriver implements QueueDriver {
  rsmq: RedisSMQ;

  constructor({ prefix, connection }: { prefix: string; connection: string }) {
    this.rsmq = new RedisSMQ({
      options: { url: connection },
      ns: prefix,
    });
  }

  async createQueue(name: string): Promise<void> {
    try {
      await this.rsmq.createQueueAsync({ qname: name });
      console.log(`[queue/redis] creating queue: ${name}`);
    } catch (error) {
      if (error.name == "queueExists") {
        console.log(`[queue/redis] queue already exists: ${name}`);
        return;
      }
      throw error;
    }
  }

  async enqueue(queueName: string, message: any) {
    return this.rsmq.sendMessageAsync({
      qname: queueName,
      message: JSON.stringify(message),
    });
  }
}
