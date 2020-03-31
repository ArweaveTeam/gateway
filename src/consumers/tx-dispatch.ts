import { getQueueUrl, createQueueHandler } from "../lib/queues";
import { publish } from "../lib/pub-sub";
import { getEncoded } from "../lib/buckets";
import { broadcast } from "../lib/broadcast";
import { TxEvent } from "../interfaces/messages";

export const handler = createQueueHandler<TxEvent>(
  getQueueUrl("tx-dispatch"),
  async message => {
    console.log(message);
    const { data_size, tx } = message;
    console.log(`tx: ${tx.id}`);

    const fullTx = {
      ...tx,
      data: data_size ? getEncoded("tx-data", tx.id) : ""
    };

    console.log(`broadcasting: ${tx.id}`);

    await broadcast(fullTx, [
      "http://lon-1.eu-west-1.arweave.net:1984",
      "http://lon-2.eu-west-1.arweave.net:1984",
      "http://lon-3.eu-west-1.arweave.net:1984",
      "http://lon-4.eu-west-1.arweave.net:1984",
      "http://lon-5.eu-west-1.arweave.net:1984",
      "http://lon-6.eu-west-1.arweave.net:1984"
    ]);

    console.log(`publishing: ${tx.id}`);

    await publish<TxEvent>(message);
  }
);
