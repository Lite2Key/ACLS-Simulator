import bradycardiaCaseJson from './bradycardia-v1.case.json';
import { assertValidCaseDefinition } from './validate';
import type { CaseDefinitionV2 } from '../types/case';

const rawCases: unknown[] = [bradycardiaCaseJson];

export const CASES: CaseDefinitionV2[] = rawCases.map((raw) => {
  assertValidCaseDefinition(raw);
  return raw;
});

export const DEFAULT_CASE = CASES[0];