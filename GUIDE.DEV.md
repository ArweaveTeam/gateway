# Gateway Development Guide

If you want to develop and contribute to the Gateway source code, use this guide as a reference for development and starting a server. If you're looking to deploy a Gateway. We suggest using the normal guide found [here.](./GUIDE.md)

## Requirements

1. A Unix OS

2. Postgres v10+

3. Redis v5+

4. Node.js v12.20.1

## Configuring Postgres

Before you begin, you'll need to create and configure the Database and User.

```bash
# Access PSQL Terminal
sudo -u postgres psql

# Create the arweave database and user
CREATE DATABASE arweave;
CREATE USER arweave WITH ENCRYPTED PASSWORD 'arweave';
GRANT ALL PRIVILEGES ON DATABASE arweave TO arweave;

# exit PSQL Terminal
exit
```

## Configuring Redis

There is not much additional configuration required for Redis other than it running on port `6379`.
If you don't have Redis, but do have Docker. You can deploy an instance by running.

```bash
docker run -it -p 6379:6379 redis:6.0
```

## Environment

By default, there is a default environment you can use located at `.env.default` in the repository.

```env
ARWEAVE_NODES=["..."]

DATABASE_HOST=0.0.0.0
DATABASE_PORT=5432
DATABASE_USER=arweave
DATABASE_PASSWORD=arweave
DATABASE_NAME=arweave

PORT=3000
```

Make sure you copy this configuration to `.env`

```bash
cp .env.default .env
```

## Deploying Migrations with Knex

TBD...