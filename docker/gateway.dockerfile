FROM node:14

WORKDIR /app

COPY . .
RUN npm install
RUN npm run build

ENTRYPOINT ["node"]

CMD ["dist/gateway/app.js"]