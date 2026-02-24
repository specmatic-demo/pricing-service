import fs from 'node:fs';
import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'node:url';

const host = process.env.PRICING_HOST || '0.0.0.0';
const port = Number.parseInt(process.env.PRICING_PORT || '9000', 10);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findFirstExistingPath(paths: Array<string | undefined>): string | null {
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
  path.join(__dirname, '..', '..', 'central-contract-repository', 'contracts', 'services', 'pricing-service', 'rpc', 'pricing.proto')
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

type QuotePriceRequest = {
  sku?: string;
  quantity?: number | string;
  customerTier?: string;
};

type QuotePriceResponse = {
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
};

function quotePrice(
  call: grpc.ServerUnaryCall<QuotePriceRequest, QuotePriceResponse>,
  callback: grpc.sendUnaryData<QuotePriceResponse>
): void {
  const request = call.request || {};
  const quantityValue =
    typeof request.quantity === 'number'
      ? request.quantity
      : Number.parseInt(String(request.quantity ?? 1), 10);
  const quantity = Number.isFinite(quantityValue) ? quantityValue : 1;
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

server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (error: Error | null, boundPort: number) => {
  if (error) {
    throw error;
  }

  server.start();
  console.log(`pricing-service gRPC listening on ${host}:${boundPort}`);
  console.log(`Using proto at ${protoPath}`);
});
