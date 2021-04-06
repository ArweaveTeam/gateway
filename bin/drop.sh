#!/bin/bash
echo Dropping temporary tables please wait

sudo -u postgres psql -d arweave <<EOF

SET statement_timeout TO 360000000;
COMMIT;
show statement_timeout;

DROP TABLE tags_temp;
DROP TABLE transactions_temp;

EOF

echo Dropped temporary tables