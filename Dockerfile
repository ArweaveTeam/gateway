FROM node:12.16.3-alpine AS base

WORKDIR /usr/app

COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .

RUN npm ci

# We're splitting NPM and node_modules into a separate
# image so we have lighter layers, with just our code changes.

FROM node:12.16.3-alpine AS build

WORKDIR /usr/app

COPY --from=base /usr/app/node_modules node_modules

COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .
COPY src src

RUN npm run tsc

RUN npm prune --production

ENTRYPOINT ["node"]

CMD ["dist/gateway/app.js"]