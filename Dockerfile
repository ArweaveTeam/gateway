FROM node:12.16.3-alpine AS base
RUN apk update && apk upgrade && \
    apk add --no-cache bash git
WORKDIR /usr/app
COPY ./package.json .
COPY ./tsconfig.json .
RUN yarn
RUN yarn add arweave @types/mime
# RUN yarn run build

# We're splitting NPM and node_modules into a separate
# image so we have lighter layers, with just our code changes.

FROM node:12.16.3-alpine AS build
WORKDIR /usr/app
COPY --from=base /usr/app/node_modules ./node_modules
COPY --from=base /usr/app/package.json .
COPY --from=base /usr/app/tsconfig.json .
COPY src ./src

RUN yarn run build
ENTRYPOINT ["node"]
CMD ["dist/gateway/app.js"]