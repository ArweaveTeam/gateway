import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { publish } from "../lib/pub-sub";
import { get } from "../lib/buckets";
import { broadcastTx } from "../lib/broadcast";
import { ImportTx, DispatchTx } from "../interfaces/messages";
import { toB64url } from "../lib/encoding";

export const handler = createQueueHandler<DispatchTx>(
  getQueueUrl("dispatch-txs"),
  async (message) => {
    console.log(message);
    const { tx } = message;
    console.log(`tx: ${tx.id}`);

    const fullTx = {
      ...tx,
      data: tx.data_size
        ? toB64url((await get("tx-data", `tx/${tx.id}`)).Body as Buffer)
        : "",
    };

    console.log(`broadcasting: ${tx.id}`);

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
