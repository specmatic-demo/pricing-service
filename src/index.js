'use strict';

const fs = require('fs');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const host = process.env.PRICING_HOST || '0.0.0.0';
const port = Number.parseInt(process.env.PRICING_PORT || '9000', 10);

function findFirstExistingPath(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const protoPath = findFirstExistingPath([
  process.env.PRICING_PROTO_PATH,
  path.join(__dirname, '..', '.specmatic', 'repos', 'central-contract-repository', 'contracts', 'services', 'pricing-service', 'rpc', 'pricing.proto'),
  path.join(__dirname, '..', '..', 'central-contract-repository', 'contracts', 'services', 'pricing-service', 'rpc', 'pricing.proto'),
  '/contracts/contracts/services/pricing-service/rpc/pricing.proto'
]);

if (!protoPath) {
  throw new Error('Could not find pricing.proto. Set PRICING_PROTO_PATH');
}

const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const pricingProto = grpc.loadPackageDefinition(packageDefinition).pricing.v1;

function quotePrice(call, callback) {
  const request = call.request || {};
  const quantity = Number.isFinite(request.quantity) ? request.quantity : Number.parseInt(String(request.quantity || 1), 10) || 1;
  const unitPrice = 100.0;
  callback(null, {
    sku: request.sku || 'SKU-DEFAULT',
    quantity,
    unitPrice,
    totalPrice: unitPrice * quantity,
    currency: 'USD'
  });
}

const server = new grpc.Server();
server.addService(pricingProto.PricingService.service, { quotePrice });

server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (error, boundPort) => {
  if (error) {
    throw error;
  }

  server.start();
  console.log(`pricing-service gRPC listening on ${host}:${boundPort}`);
  console.log(`Using proto at ${protoPath}`);
});
