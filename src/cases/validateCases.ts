import { CASES } from './index';
import { validateCaseDefinition } from './validate';

let invalidCount = 0;

for (const caseDef of CASES) {
  const result = validateCaseDefinition(caseDef);
  if (!result.valid) {
    invalidCount += 1;
    console.error(`\nCase ${caseDef.metadata.id} failed validation:`);
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
  }
}

if (invalidCount > 0) {
  console.error(`\nValidation failed for ${invalidCount} case(s).`);
  process.exit(1);
}

console.log(`Validated ${CASES.length} case(s) successfully.`);