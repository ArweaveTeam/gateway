#!/bin/bash
echo Creating temporary tables please wait

sudo -u postgres psql -d arweave <<EOF

CREATE TABLE transactions_temp AS SELECT * FROM transactions;
CREATE TABLE tags_temp AS SELECT * FROM tags;

ALTER TABLE transactions_temp ADD PRIMARY KEY ("id");
ALTER TABLE tags_temp ADD PRIMARY KEY ("tx_id", "index");

EOF

echo Created temporary tables