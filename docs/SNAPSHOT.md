# Snapshots

Use this guide to generate your own snapshots or import a snapshot.

## Generate a Snapshot

You can generate a snapshot while syncing your node by enabling snapshots with the `SNAPSHOT=1` variable in your environment file.

However, you can have an instance solely dedicated to creating a snapshot file by running `yarn dev:snapshot`.

You can configure the level of block synchronization by modifying the `PARALLEL` variable.

**Examples**

```bash
# Sync 4 blocks at a time when running yarn dev:snapshot
PARALLEL=4
SNAPSHOT=1
```

```bash
# Sync 8 blocks at a time
PARALLEL=8
SNAPSHOT=1
```

When generating a snapshot. Output will appear in the `snapshot` folder. You can tar.gz the archive by running.

```bash
tar -zcvf snapshot.tar.gz snapshot
```

You can then upload the snapshot to Arweave by running.

```bash
arweave deploy snapshot.tar.gz
```

## Importing a Snapshot

If you want to import a snapshot. You need to make sure to update your `.env` file to have the absolute paths to each CSV

```bash
BLOCK_PATH=/path/to/snapshot/block.csv
TRANSACTION_PATH=/path/to/snapshot/transaction.csv
TAGS_PATH=/path/to/snapshot/tags.csv
```

If you're downloading a `.tar.gz` file. You can decompress it by running.

```bash
tar -zxf snapshot.tar.gz -C snapshot
```

Also make sure that the folder that holds the snapshot csv files has `rwx` permissions.

```bash
chmod +x /path/to/snapshot
```

You can then run the import command.

```bash
yarn dev:import
```

If successful, it should output.

```bash
info: [snapshot] successfully imported block.csv
info: [snapshot] successfully imported transaction.csv
info: [snapshot] successfully imported tags.csv
```
