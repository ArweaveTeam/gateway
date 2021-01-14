import { readFileSync } from "fs";
import { sequentialBatch } from "../lib/helpers";
import { enqueueBatch } from "../lib/queues";
import { ImportTx } from "../interfaces/messages";

handler();

export async function handler(): Promise<void> {
  const args = process.argv.slice(2);
  const csvPath = args[0];
  const queueUrl = args[1];

  const rows = readFileSync(csvPath, "utf8").split("\n");

  let count = 0;
  let total = rows.length;

  console.log(`queueUrl: ${queueUrl}\ninputData: ${total} rows`);

  await sequentialBatch(rows, 50, async (batch: string[]) => {
    await Promise.all([
      enqueueBatch<ImportTx>(
        queueUrl,
        batch.slice(0, 10).map((id) => {
          return {
            id,
            message: { id },
          };
        })
      ),
      enqueueBatch<ImportTx>(
        queueUrl,
        batch.slice(10, 20).map((id) => {
          return {
            id,
            message: { id },
          };
        })
      ),
      enqueueBatch<ImportTx>(
        queueUrl,
        batch.slice(20, 30).map((id) => {
          return {
            id,
            message: { id },
          };
        })
      ),
      enqueueBatch<ImportTx>(
        queueUrl,
        batch.slice(30, 40).map((id) => {
          return {
            id,
            message: { id },
          };
        })
      ),
      enqueueBatch<ImportTx>(
        queueUrl,
        batch.slice(40, 50).map((id) => {
          return {
            id,
            message: { id },
          };
        })
      ),
    ]);

    count = count + batch.length;
    console.log(`${count}/${total}`);
  });
}
