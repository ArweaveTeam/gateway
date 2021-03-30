import 'colors';
import {config} from 'dotenv';
import {writeFileSync} from 'fs';
import {indices, transactionOrder} from './utility/order.utility';

config();

export async function copy() {
  console.log('Generating SQL for COPY commands in bin/copy.sh\n'.green.bold);

  const txFields = transactionOrder
      .concat(indices)
      .map((field) => `"${field}"`);

  const blocks = '\\COPY blocks ("id", "previous_block", "mined_at", "height", "txs", "extended") FROM \'$BLOCK_PATH\' WITH (FORMAT CSV, HEADER, ESCAPE \'\\\', DELIMITER \'|\', FORCE_NULL("height"));';

  const transactions = `\\COPY transactions (${txFields.join(',')}) FROM '$TRANSACTION_PATH' WITH (FORMAT CSV, HEADER, ESCAPE '\\', DELIMITER '|', FORCE_NULL("format", "height", "data_size"));`;

  const tags = '\\COPY tags ("tx_id", "index", "name", "value") FROM \'$TAGS_PATH\' WITH (FORMAT CSV, HEADER, ESCAPE \'\\\', DELIMITER \'|\', FORCE_NULL(index));';

  const output = `#!/bin/bash
echo COPYing files please wait

export BLOCK_PATH=
export TRANSACTION_PATH=
export TAGS_PATH=

psql -d arweave <<EOF

set statement_timeout to 60000000; commit;
show statement_timeout;

${blocks}
${transactions}
${tags}

EOF

echo COPY complete`;

  writeFileSync('bin/copy.sh', output);

  console.log('Finished writing to bin/copy.sh\n'.green.bold);
}

(async () => await copy())();
