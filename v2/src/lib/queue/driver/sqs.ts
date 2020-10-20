import { SQS } from "aws-sdk";
import { QueueDriver } from "..";

const sqs = new SQS({
  maxRetries: 3,
  httpOptions: { timeout: 5000, connectTimeout: 5000 },
});

interface SQSConfig {
  aws: {
    region: string;
    accountId: number;
    prefix: string;
  };
}

export class SQSQueueDriver implements QueueDriver {
  config: SQSConfig;

  constructor(config: SQSConfig) {
    this.config = config;
  }

  async createQueue(name: string): Promise<void> {
    await sqs.createQueue({ QueueName: this.perfixName(name) }).promise();
  }

  async enqueue(queueName: string, message: any) {
    const { MessageId } = await sqs
      .sendMessage({
        QueueUrl: this.getUrl(queueName),
        MessageBody: JSON.stringify(message),
      })
      .promise();

    if (MessageId) {
      return MessageId;
    }

    throw new Error(`Failed to enqueue message`);
  }

  // https://sqs.us-east-2.amazonaws.com/123456789012/MyQueue
  getUrl(name: string): string {
    return `https://sqs.${this.config.aws.region}.amazonaws.com/${
      this.config.aws.accountId
    }/${this.perfixName(name)}`;
  }

  perfixName(name: string): string {
    return `${this.config.aws.prefix}-${name}`;
  }
}
