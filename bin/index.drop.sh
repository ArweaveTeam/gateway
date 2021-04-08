#!/bin/bash
echo Indexing database please wait

sudo -u postgres psql -d arweave <<EOF

DROP INDEX "blocks_height";
DROP INDEX "blocks_mined_at";

DROP INDEX "tags_name";
DROP INDEX "tags_value";
DROP INDEX "tags_name_value";
DROP INDEX "tags_tx_id_name";

DROP INDEX "index_App-Name_transactions";
DROP INDEX "index_app_transactions";
DROP INDEX "index_domain_transactions";
DROP INDEX "index_namespace_transactions";
DROP INDEX "transactions_owner_address";
DROP INDEX "transactions_target";
DROP INDEX "transactions_height";

EOF

echo Finished indexing database