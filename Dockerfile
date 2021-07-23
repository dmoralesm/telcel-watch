FROM node:14-alpine AS build
WORKDIR /app/build

COPY package*.json ./
COPY src ./
COPY tsconfig.json ./

RUN npm install
RUN npm run build

FROM node:14-alpine
WORKDIR /app

ENV NODE_ENV production
ENV TZ America/Mexico_City

COPY package*.json ./
COPY --from=build /app/build/dist dist

RUN apk add tzdata
RUN npm install --production

USER node

CMD ["npm", "run", "prod"]
