import Ajv2020 from 'ajv/dist/2020';
import caseSchema from '../../specs/case.schema.json';
import type { CaseDefinitionV2 } from '../types/case';

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(caseSchema);

export interface CaseValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCaseDefinition(caseDef: unknown): CaseValidationResult {
  const valid = validate(caseDef);
  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validate.errors ?? []).map((error) => {
    const path = error.instancePath || '/';
    return `${path} ${error.message ?? 'invalid'}`;
  });

  return {
    valid: false,
    errors,
  };
}

export function assertValidCaseDefinition(caseDef: unknown): asserts caseDef is CaseDefinitionV2 {
  const result = validateCaseDefinition(caseDef);
  if (!result.valid) {
    throw new Error(`Case validation failed:\n${result.errors.join('\n')}`);
  }
}
