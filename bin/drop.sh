#!/bin/bash
echo Dropping temporary tables please wait

sudo -u postgres psql -d arweave <<EOF

DROP TABLE tags_temp;
DROP TABLE transactions_temp;

EOF

echo Dropped temporary tables