import { SNS } from "aws-sdk";

const topicArn = process.env.ARWEAVE_SNS_EVENTS_ARN!;
const sns = new SNS();

export const publish = async <T>(message: T) => {
  await sns
    .publish({
      TopicArn: topicArn,
      Message: JSON.stringify(message)
    })
    .promise();
};
