import { SQS } from "aws-sdk";
import { SQSEvent, SQSHandler, SQSRecord } from "aws-lambda";

type QueueType = "dispatch-txs" | "import-txs" | "import-blocks";
type SQSQueueUrl = string;
type MessageGroup = string;
type MessageDeduplicationId = string;
interface HandlerContext {
  sqsMessage?: SQSRecord;
}

const queues: { [key in QueueType]: SQSQueueUrl } = {
  "dispatch-txs": process.env.ARWEAVE_SQS_DISPATCH_TXS_URL!,
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
        throw new Error("Queue handler: invalid SQS messages received");
      }
      const receipts: { Id: string; ReceiptHandle: string }[] = [];

      console.log(
        `Received messages, source: ${event.Records[0].eventSourceARN}, count: ${event.Records.length}`
      );

      await Promise.all(
        event.Records.map(async (sqsMessage) => {
          console.log(`Record.map ${sqsMessage}`);
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
            console.error(error);
          }
        })
      );

      console.log("receipts", receipts);

      await deleteMessages(queueUrl, receipts);

      if (receipts.length !== event.Records.length) {
        throw new Error(
          `Failed to process ${event.Records.length - receipts.length} messages`
        );
      }
    } finally {
      if (hooks && hooks.after) {
        await hooks.after();
      }
    }
  };
};
