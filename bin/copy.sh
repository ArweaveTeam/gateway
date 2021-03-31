#!/bin/bash
echo COPYing files please wait

export BLOCK_PATH=
export TRANSACTION_PATH=
export TAGS_PATH=

psql -d arweave <<EOF
set statement_timeout to 60000000; commit;
show statement_timeout;

\COPY blocks ("id", "previous_block", "mined_at", "height", "txs", "extended") FROM '$BLOCK_PATH' WITH (FORMAT CSV, HEADER, ESCAPE '\', DELIMITER '|', FORCE_NULL("height"));
\COPY transactions ("format","id","signature","owner","owner_address","target","reward","last_tx","height","tags","quantity","content_type","data_size","data_root","App-Name","app","domain","namespace") FROM '$TRANSACTION_PATH' WITH (FORMAT CSV, HEADER, ESCAPE '\', DELIMITER '|', FORCE_NULL("format", "height", "data_size"));
\COPY tags ("tx_id", "index", "name", "value") FROM '$TAGS_PATH' WITH (FORMAT CSV, HEADER, ESCAPE '\', DELIMITER '|', FORCE_NULL(index));
EOF

echo COPY complete