import 'colors';
import {connection} from '../database/connection.database';

export const batchAmount = 100000;

let total = 0;

export async function importTags(offset: number = 0) {
  const output = await connection.raw(`
        INSERT INTO
        tags("tx_id", "index", "name", "value")
        SELECT 
        "tx_id", "index", "name", "value"
        FROM tags_temp ORDER BY "tx_id" ASC, "index" ASC LIMIT ${batchAmount} OFFSET ${offset};
    `);

  total += output.rowCount;
  console.log(`Successfully added ${total} entries into the tags table`.green);

  if (output.rowCount === 0) {
    console.log(`Successfully inserted a total of ${total} entries, the import has been completed`.green.bold);
    process.exit();
  }

  await importTags(offset + batchAmount);
}

(async () => await importTags())();
