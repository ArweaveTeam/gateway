#!/bin/bash
##########
# Make sure to fill out the configuration variables below
##########

export PGHOST=
export PGUSER=
export PGPORT=
export PGDATABASE=
export PGPASSWORD=
export OUTPUT=

export FORMAT="(DELIMITER '|', FORMAT CSV, HEADER, FORCE_QUOTE *, ESCAPE '\', ENCODING UTF8)"

export BLOCKLIST='("id", "previous_block", "mined_at", "height", "txs", "extended")'
export TXLIST='("format", "id", "signature", "owner", "owner_address", "target", "reward", "last_tx", "height", "tags", "quantity", "content_type", "data_size", "data_root")'
export TAGLIST='("tx_id", "index", "name", "value")'

echo COPYing database to CSV please wait

psql -h $PGHOST -U $PGUSER -p $PGPORT -d $PGDATABASE << EOF

set statement_timeout to 60000000; commit;
show statement_timeout;

\COPY blocks $BLOCKLIST TO '$OUTPUT/block.csv' WITH $FORMAT;
\COPY transactions $TXLIST TO '$OUTPUT/transaction.csv' WITH $FORMAT;
\COPY tags $TAGLIST TO '$OUTPUT/tag.csv' WITH $FORMAT;

EOF

echo Finished COPYing database to CSV