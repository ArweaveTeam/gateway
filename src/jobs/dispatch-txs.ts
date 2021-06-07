import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { publish } from "../lib/pub-sub";
import { get } from "../lib/buckets";
import { broadcastTx } from "../lib/broadcast";
import { ImportTx, DispatchTx } from "../interfaces/messages";
import { toB64url } from "../lib/encoding";
import { Transaction } from "../lib/arweave";
import { hosts } from "./export-chunks";

export const handler = createQueueHandler<DispatchTx>(
  getQueueUrl("dispatch-txs"),
  async (message) => {
    console.log(message);
    const { tx, data_size: dataSize, data_format } = message;

    console.log(`data_size: ${dataSize}, tx: ${tx.id}`);

    console.log(`broadcasting: ${tx.id}`);

    const fullTx: Transaction = {
      ...tx,
      data:
        (!data_format || data_format < 2.1) && dataSize > 0
          ? await getEncodedData(tx.id)
          : "",
    };

    await broadcastTx(fullTx, hosts);

    console.log(`publishing: ${tx.id}`);

    await publish<ImportTx>(message);
  }
);

const getEncodedData = async (txid: string): Promise<string> => {
  try {
    const data = await get("tx-data", `tx/${txid}`);
    return toB64url(data.Body as Buffer);
  } catch (error) {
    return "";
  }
};
