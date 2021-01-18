FROM node:12
LABEL Arweave Team <hello@arweave.org>

WORKDIR /app

COPY bin bin
COPY .env .env
copy knexfile.ts knexfile.ts
COPY package.json package.json
COPY tsconfig.json tsconfig.json
COPY src src
COPY migrations migrations

RUN chmod +x bin/wait-for-it.sh
RUN npm install
RUN npm run build

CMD ["./bin/wait-for-it.sh", "postgres:5432", "--", "npm", "start"]