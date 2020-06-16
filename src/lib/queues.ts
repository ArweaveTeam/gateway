import { SQS } from "aws-sdk";
import { SQSEvent, SQSHandler, SQSRecord } from "aws-lambda";
import log from "../lib/log";

type QueueType =
  | "dispatch-txs"
  | "import-txs"
  | "import-blocks"
  | "import-chunks"
  | "export-chunks";
type SQSQueueUrl = string;
type MessageGroup = string;
type MessageDeduplicationId = string;
interface HandlerContext {
  sqsMessage?: SQSRecord;
}

const queues: { [key in QueueType]: SQSQueueUrl } = {
  "dispatch-txs": process.env.ARWEAVE_SQS_DISPATCH_TXS_URL!,
  "import-chunks": process.env.ARWEAVE_SQS_IMPORT_CHUNKS_URL!,
  "export-chunks": process.env.ARWEAVE_SQS_EXPORT_CHUNKS_URL!,
  "import-txs": process.env.ARWEAVE_SQS_IMPORT_TXS_URL!,
  "import-blocks": process.env.ARWEAVE_SQS_IMPORT_BLOCKS_URL!,
};

const sqs = new SQS();

export const getQueueUrl = (type: QueueType): SQSQueueUrl => {
  return queues[type];
};

export const enqueue = async <MessageType extends object>(
  queueUrl: SQSQueueUrl,
  message: MessageType,
  options?:
    | { messagegroup?: MessageGroup; deduplicationId?: MessageDeduplicationId }
    | undefined
) => {
  await sqs
    .sendMessage({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageGroupId: options && options.messagegroup,
      MessageDeduplicationId: options && options.deduplicationId,
    })
    .promise();
};

export const enqueueBatch = async <MessageType extends object>(
  queueUrl: SQSQueueUrl,
  messages: {
    id: string;
    message: MessageType;
    messagegroup?: MessageGroup;
    deduplicationId?: MessageDeduplicationId;
  }[]
) => {
  await sqs
    .sendMessageBatch({
      QueueUrl: queueUrl,
      Entries: messages.map((message) => {
        return {
          Id: message.id,
          MessageBody: JSON.stringify(message),
          MessageGroupId: message.messagegroup,
          MessageDeduplicationId: message.deduplicationId,
        };
      }),
    })
    .promise();
};

const deleteMessages = async (
  queueUrl: SQSQueueUrl,
  receipts: { Id: string; ReceiptHandle: string }[]
) => {
  if (!receipts.length) {
    return;
  }
  await sqs
    .deleteMessageBatch({
      QueueUrl: queueUrl,
      Entries: receipts,
    })
    .promise();
};

export const createQueueHandler = <MessageType>(
  queueUrl: SQSQueueUrl,
  handler: (message: MessageType, sqsMessage: SQSRecord) => Promise<void>,
  hooks?: {
    before?: () => Promise<void>;
    after?: () => Promise<void>;
  }
): SQSHandler => {
  return async (event: SQSEvent) => {
    if (hooks && hooks.before) {
      await hooks.before();
    }
    try {
      if (!event) {
        log.info(`[sqs-handler] invalid SQS messages received`, { event });
        throw new Error("Queue handler: invalid SQS messages received");
      }

      log.info(`[sqs-handler] received messages`, {
        count: event.Records.length,
        source: event.Records[0].eventSourceARN,
      });

      const receipts: { Id: string; ReceiptHandle: string }[] = [];

      const errors: Error[] = [];

      await Promise.all(
        event.Records.map(async (sqsMessage) => {
          log.info(`[sqs-handler] processing message`, { sqsMessage });
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
            log.error(`[sqs-handler] error processing message`, { event });
            errors.push(error);
          }
        })
      );

      log.info(`[sqs-handler] queue handler complete`, {
        successful: receipts.length,
        failed: event.Records.length - receipts.length,
      });

      await deleteMessages(queueUrl, receipts);

      if (receipts.length !== event.Records.length) {
        log.warn(
          `Failed to process ${event.Records.length - receipts.length} messages`
        );

        // If all the errors are the same then fail the whole queue with a more specific error mesage
        if (errors.every((error) => error.message == errors[0].message)) {
          throw new Error(
            `Failed to process SQS messages: ${errors[0].message}`
          );
        }

        throw new Error(`Failed to process SQS messages`);
      }
    } finally {
      if (hooks && hooks.after) {
        await hooks.after();
      }
    }
  };
};
