import { client } from "./redis";
import log from "../lib/log";

type QueueType =
  | "dispatch-txs"
  | "import-txs"
  | "import-blocks"
  | "import-bundles"
  | "import-chunks"
  | "export-chunks";

type QueueChannel = string;
type MessageGroup = string;
type MessageDeduplicationId = string;
type DelaySeconds = number;

const queues: { [key in QueueType]: QueueChannel } = {
  "dispatch-txs": process.env.ARWEAVE_SQS_DISPATCH_TXS_URL!,
  "import-chunks": process.env.ARWEAVE_SQS_IMPORT_CHUNKS_URL!,
  "export-chunks": process.env.ARWEAVE_SQS_EXPORT_CHUNKS_URL!,
  "import-txs": process.env.ARWEAVE_SQS_IMPORT_TXS_URL!,
  "import-blocks": process.env.ARWEAVE_SQS_IMPORT_BLOCKS_URL!,
  "import-bundles": process.env.ARWEAVE_SQS_IMPORT_BUNDLES_URL!,
};

export const getQueueChannel = (type: QueueType): QueueChannel => {
  return queues[type];
};

export const enqueue = async <MessageType extends object>(
  queueChannel: QueueChannel,
  message: MessageType,
  options?:
    | {
        messagegroup?: MessageGroup;
        deduplicationId?: MessageDeduplicationId;
        delaySeconds?: DelaySeconds;
      }
    | undefined
) => {
  if (!queueChannel) {
    throw new Error(`Queue URL undefined`);
  }

  client.publish(queueChannel, JSON.stringify(message));
};

export const enqueueBatch = async <MessageType extends object>(
  queueChannel: QueueChannel,
  messages: {
    id: string;
    message: MessageType;
    messagegroup?: MessageGroup;
    deduplicationId?: MessageDeduplicationId;
  }[]
) => {
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    client.publish(queueChannel, JSON.stringify(message));
  }
};

export const createQueueHandler = <MessageType>(
  queueChannel: QueueChannel,
  handler: (message: MessageType, sqsMessage) => Promise<void>,
  hooks?: {
    before?: () => Promise<void>;
    after?: () => Promise<void>;
  }
) => {
  return async (event) => {
    if (hooks && hooks.before) {
      await hooks.before();
    }
    try {
      if (!event) {
        log.info(`[queue-handler] invalid Queue messages received`, { event });
        throw new Error("Queue handler: invalid Queue messages received");
      }

      log.info(`[queue-handler] received messages`, {
        count: event.Records.length,
        source: event.Records[0].eventSourceARN,
      });

      const receipts: { Id: string; ReceiptHandle: string }[] = [];

      const errors: Error[] = [];

      await Promise.all(
        event.Records.map(async (sqsMessage) => {
          log.info(`[queue-handler] processing message`, { sqsMessage });
          try {
            await handler(
              JSON.parse(sqsMessage.body) as MessageType,
              sqsMessage
            );
            receipts.push({
              Id: sqsMessage.messageId,
              ReceiptHandle: sqsMessage.receiptHandle,
            });
          } catch (error) {
            log.error(`[queue-handler] error processing message`, {
              event,
              error,
            });
            errors.push(error);
          }
        })
      );

      log.info(`[queue-handler] queue handler complete`, {
        successful: receipts.length,
        failed: event.Records.length - receipts.length,
      });

      if (receipts.length !== event.Records.length) {
        log.warn(
          `Failed to process ${event.Records.length - receipts.length} messages`
        );

        // If all the errors are the same then fail the whole queue with a more specific error mesage
        if (errors.every((error) => error.message == errors[0].message)) {
          throw new Error(
            `Failed to process Queue messages: ${errors[0].message}`
          );
        }

        throw new Error(`Failed to process Queue messages`);
      }
    } finally {
      if (hooks && hooks.after) {
        await hooks.after();
      }
    }
  };
};
