# Snapshots

Use this guide to generate your own snapshots or import a snapshot.

## Generate a Snapshot

You can generate a snapshot by running `\COPY` on your Postgres Database. Use `bin/export.sh` to generate the appropriate `.csv` files. Make sure to fill out the configuration variables in `bin/export.sh` before exporting

```bash
export PGHOST=
export PGUSER=
export PGPORT=
export PGDATABASE=
export PGPASSWORD=

# This is the output folder
export OUTPUT=
```

After a successful `\COPY` of your database. You will then went to compress the files into `.tar.gz`.

```bash
tar -zcvf snapshot.tar.gz snapshot
```

You can then upload this snapshot to Arweave by running.

```bash
arweave deploy snapshot.tar.gz
```

## Importing a Snapshot

If you want the official Snapshot. Download this URL:

```bash
curl -o snapshot.tar.gz https://snapshots.amplify.host/APRIL7TH/snapshot.tar.gz
```

If you're downloading a `.tar.gz` file. You should decompress it in the `/arweave` folder.

```bash
# Move the .tar.gz to /arweave path
mkdir /arweave
mv /path/to/snapshot.tar.gz /arweave/snapshot.tar.gz

# Decompress it
tar -xvzf snapshot.tar.gz
```

Also make sure that the folder that holds the snapshot csv files has `rwx` permissions.

```bash
chmod +x /arweave/snapshot
```

You should first create the tables and then drop the indices on the tables by running `bin/index.drop.sh`

```bash
# In the gateway repo
yarn migrate:latest
sh bin/index.drop.sh
```

You can then run the import `shell` script.

```bash
# In the gateway repo
sh bin/import.sh
```

If successful, it should output `COPY [NUM ROWS]` continuously.

```bash
COPY [NUM ROWS]
COPY ...
COPY ...
```

After it copies all the entries into the database. Recreate the indices by running `bin/index.create.sh`

```bash
# In the gateway repo
sh bin/index.create.sh
```

Once complete, you have successfully imported the snapshot and can now start up the Gateway!