#!/bin/bash
echo Inserting temporary table entries to actual table please wait

sudo -u postgres psql -d arweave <<EOF

SET statement_timeout TO 200000000;
COMMIT;
show statement_timeout;

INSERT INTO tags("tx_id", "index", "name", "value") SELECT "tx_id", "index", "name", "value" FROM tags_temp;
INSERT INTO transactions("format","id","signature","owner","owner_address","target","reward","last_tx","height","tags","quantity","content_type","data_size","data_root","App-Name","app","domain","namespace") SELECT "format","id","signature","owner","owner_address","target","reward","last_tx","height","tags","quantity","content_type","data_size","data_root","App-Name","app","domain","namespace" FROM transactions;

DROP TABLE tags_temp;
DROP TABLE transactions_temp;

EOF

echo Successfully inserted from temporary tables to actual table entries