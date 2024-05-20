FROM node:lts as builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

FROM node:lts

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules /usr/src/app/node_modules

COPY . .

EXPOSE 3000

CMD ["node", "./src/index.js"]
