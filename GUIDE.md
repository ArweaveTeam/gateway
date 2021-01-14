# Gateway Guide

## Requirements

1. A Unix OS

2. Docker CE and Docker Compose

3. Node.js v12.20.1

*Please note there may be some problems with Node v14 LTS or later.*

There is also the development version of the guide, that you can review [here.](./GUIDE.DEV.md).

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

## Compilation

First, make sure to install the `node_modules`.

```bash
yarn
```

Then, you can start the server with `docker-compose`.

```bash
yarn docker:start
```

You can spin down the `docker-compose` cluster with.

```bash
yarn docker:stop
```

## Testing

You can test if it the server and the GraphQL queries are working by navigating to.

```bash
http://localhost:3000/graphql
```

This webpage should look similar to.

```bash
https://arweave.dev/graphql
```

