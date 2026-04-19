import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(projectRoot, 'specs', 'case.schema.json');
const casesDir = path.join(projectRoot, 'src', 'cases');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

const caseFiles = fs
  .readdirSync(casesDir)
  .filter((file) => file.endsWith('.case.json'))
  .sort();

let invalidCount = 0;

for (const file of caseFiles) {
  const fullPath = path.join(casesDir, file);
  const caseDef = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  if (!validate(caseDef)) {
    invalidCount += 1;
    console.error(`\n${file} failed validation:`);
    for (const error of validate.errors ?? []) {
      const location = error.instancePath || '/';
      console.error(`- ${location} ${error.message ?? 'invalid'}`);
    }
  }
}

if (invalidCount > 0) {
  console.error(`\nValidation failed for ${invalidCount} case(s).`);
  process.exit(1);
}

console.log(`Validated ${caseFiles.length} case(s) successfully.`);
