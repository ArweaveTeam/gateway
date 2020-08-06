FROM node:12.16.3-alpine AS base

RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh

WORKDIR /usr/app

COPY ./package.json .
COPY ./package-lock.json .
COPY ./tsconfig.json .

RUN npm ci

# We're splitting NPM and node_modules into a separate
# image so we have lighter layers, with just our code changes.

FROM node:12.16.3-alpine AS build

WORKDIR /usr/app

RUN pwd

COPY --from=base /usr/app/node_modules ./node_modules

COPY ./node_modules/arweave ./node_modules/arweave
COPY ./node_modules/arweave-asn1 ./node_modules/arweave-asn1

COPY --from=base /usr/app/package.json .
COPY --from=base /usr/app/package-lock.json .
COPY --from=base /usr/app/tsconfig.json .

RUN ls ./node_modules/arweave

COPY src ./src

RUN npm run build

RUN npm prune --production

ENTRYPOINT ["node"]

CMD ["dist/gateway/app.js"]