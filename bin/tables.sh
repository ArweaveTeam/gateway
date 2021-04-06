#!/bin/bash
echo Creating temporary tables please wait

sudo -u postgres psql -d arweave <<EOF

CREATE TABLE transactions_temp AS SELECT * FROM transactions;
CREATE TABLE tags_temp AS SELECT * FROM tags;

EOF

echo Created temporary tables