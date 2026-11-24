import { existsSync } from 'node:fs';

import SwaggerParser from '@apidevtools/swagger-parser';

const openapiEntry = 'mock/openapi.yaml';

if (!existsSync(openapiEntry)) {
  throw new Error(`OpenAPI mock entry not found: ${openapiEntry}`);
}

await SwaggerParser.validate(openapiEntry);
