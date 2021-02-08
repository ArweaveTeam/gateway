FROM node:12
LABEL Arweave Team <hello@arweave.org>

WORKDIR /app

COPY bin/wait.sh bin/wait.sh
COPY .env .env
COPY types.graphql types.graphql
COPY codegen.yml codegen.yml
COPY knexfile.ts knexfile.ts
COPY package.json package.json
COPY tsconfig.json tsconfig.json
COPY src src
COPY migrations migrations

RUN chmod +x bin/wait.sh
RUN yarn
RUN yarn dev:build

CMD ["./bin/wait.sh", "$DATABASE_HOST:$DATABASE_PORT", "--", "yarn", "start"]