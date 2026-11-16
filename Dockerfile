FROM node:22-alpine

WORKDIR /app
COPY . .

ENV NODE_ENV=production \
    PORT=8080 \
    KII_DATA_DIR=/app/data

RUN mkdir -p /app/data
EXPOSE 8080

CMD ["node", "server/server.cjs"]
