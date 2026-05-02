import bradycardiaCaseJson from './bradycardia-v1.case.json';
import septicShockCaseJson from './septic-shock-v1.case.json';
import { assertValidCaseDefinition } from './validate';
import type { CaseDefinitionV2 } from '../types/case';

const rawCases: unknown[] = [bradycardiaCaseJson, septicShockCaseJson];

export const CASES: CaseDefinitionV2[] = rawCases.map((raw) => {
  assertValidCaseDefinition(raw);
  return raw;
});

export const DEFAULT_CASE = CASES[0];
