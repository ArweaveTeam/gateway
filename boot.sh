#!/bin/bash
# Fresh boot of a new node

yarn
yarn dev:build
yarn migrate:reset

sh bin/index.drop.sh
sh bin/import.sh
sh bin/index.create.sh

pm2 start node dist/src/Gateway --name gateway