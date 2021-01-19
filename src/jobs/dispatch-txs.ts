import { getQueueChannel, createQueueHandler } from "../lib/queues";
import { publish } from "../lib/pub-sub";
import { get } from "../lib/buckets";
import { broadcastTx } from "../lib/broadcast";
import { ImportTx, DispatchTx } from "../interfaces/messages";
import { toB64url } from "../lib/encoding";
import { Transaction } from "../lib/arweave";

export const handler = createQueueHandler<DispatchTx>(
  getQueueChannel("dispatch-txs"),
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

    await broadcastTx(fullTx, [
      "http://lon-1.eu-west-1.arweave.net:1984",
      "http://lon-2.eu-west-1.arweave.net:1984",
      "http://lon-3.eu-west-1.arweave.net:1984",
      "http://lon-4.eu-west-1.arweave.net:1984",
      "http://lon-5.eu-west-1.arweave.net:1984",
      "http://lon-6.eu-west-1.arweave.net:1984",
    ]);

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
