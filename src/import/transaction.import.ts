import 'colors';
import {connection} from '../database/connection.database';

export const batchAmount = 100000;

let total = 0;

export async function importTransactions(offset: number = 0) {
  const output = await connection.raw(`
        INSERT INTO
        transactions("format","id","signature","owner","owner_address","target","reward","last_tx","height","tags","quantity","content_type","data_size","data_root","App-Name","app","domain","namespace")
        SELECT 
        "format","id","signature","owner","owner_address","target","reward","last_tx","height","tags","quantity","content_type","data_size","data_root","App-Name","app","domain","namespace"
        FROM transactions_temp ORDER BY "id" ASC LIMIT ${batchAmount} OFFSET ${offset};
    `);

  console.log(`Successfully added ${output.rowCount} entries into the transactions table`.green);
  total += output.rowCount;

  if (output.rowCount === 0) {
    console.log(`Successfully inserted a total of ${total} entries, the import has been completed`.green.bold);
    process.exit();
  }

  await importTransactions(offset + batchAmount);
}

(async () => await importTransactions())();
