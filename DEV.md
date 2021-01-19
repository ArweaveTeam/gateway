# Gateway Development Guide

If you want to develop and contribute to the Gateway source code, use this guide as a reference for development and starting a server. If you're looking to deploy a Gateway. We suggest using the normal guide found [here.](./README.md)

## Requirements

1. A Unix OS

2. Postgres v10+

3. Redis v5+

4. Node.js v12.20.1

## Node Version

*Please note there may be some problems with Node v14 LTS or later. If necessary run*

```bash
# Install Node.js v12 LTS
nvm install 12
# Or just use v12 LTS if already installed
nvm use 12
```

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

DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=arweave
DATABASE_PASSWORD=arweave
DATABASE_NAME=arweave

REDIS_HOST=cache
REDIS_PORT=6379

ENVIRONMENT=public
PORT=3000
```

You will want to change the `DATABASE_HOST` and `REDIS_HOST` to `localhost`.

Make sure you copy this configuration to `.env`.

```bash
cp .env.default .env
```

## Deploying Migrations with Knex

For development purposes, you will want to debug Knex migrations.

To spin up the tables for Postgres run:

```bash
yarn migrate:latest
```

To drop the tables run:

```bash
yarn migrate:down
```

## Developing

Assuming everything was smooth with the above. You can now run.

```bash
yarn dev
```

You can now test queries on.

```bash
http://localhost:3000/graphql
```

This webpage should look similar to.

```bash
https://arweave.dev/graphql
```
