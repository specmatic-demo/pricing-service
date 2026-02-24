FROM node:24

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src

ENV PRICING_HOST=0.0.0.0
ENV PRICING_PORT=9000
ENV PRICING_PROTO_PATH=/contracts/contracts/services/pricing-service/rpc/pricing.proto

EXPOSE 9000
CMD ["npm", "run", "start"]
