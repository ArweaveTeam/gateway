FROM node:12
LABEL Arweave Team <hello@arweave.org>

WORKDIR /app

COPY bin/wait.sh bin/wait.sh
COPY .env .env
COPY knexfile.ts knexfile.ts
COPY package.json package.json
COPY tsconfig.json tsconfig.json
COPY src src
COPY migrations migrations

RUN chmod +x bin/wait.sh
RUN npm install
RUN npm run dev:build

CMD ["./bin/wait.sh", "postgres:5432", "--", "npm", "start"]