#!/bin/bash
echo COPYing files please wait

export BLOCK_PATH=/mnt/51d141ea-be42-4823-92ec-5dce2074387b/arweave/snapshot/block.csv
export TRANSACTION_PATH=/mnt/51d141ea-be42-4823-92ec-5dce2074387b/arweave/snapshot/transaction.csv
export TAGS_PATH=/mnt/51d141ea-be42-4823-92ec-5dce2074387b/arweave/snapshot/tags.csv

psql -d arweave <<EOF
set statement_timeout to 60000000; commit;
show statement_timeout;

\COPY blocks ("id", "previous_block", "mined_at", "height", "txs", "extended") FROM '$BLOCK_PATH' WITH (FORMAT CSV, HEADER, ESCAPE '\', DELIMITER '|', FORCE_NULL("height"));
\COPY transactions ("format","id","signature","owner","owner_address","target","reward","last_tx","height","tags","quantity","content_type","data_size","data_root") FROM '$TRANSACTION_PATH' WITH (FORMAT CSV, HEADER, ESCAPE '\', DELIMITER '|', FORCE_NULL("format", "height", "data_size"));
\COPY tags ("tx_id", "index", "name", "value") FROM '$TAGS_PATH' WITH (FORMAT CSV, HEADER, ESCAPE '\', DELIMITER '|', FORCE_NULL(index));
EOF

echo COPY complete