import { describe, expect, it } from 'vitest';
import { DEFAULT_CASE } from '../src/cases';
import { validateCaseDefinition } from '../src/cases/validate';

describe('case validation', () => {
  it('validates the vertical slice case against schema', () => {
    const result = validateCaseDefinition(DEFAULT_CASE);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('includes required realism gates for the bradycardia slice', () => {
    const gateIds = new Set(DEFAULT_CASE.gates.map((gate) => gate.id));

    expect(gateIds.has('atropine_requires_access')).toBe(true);
    expect(gateIds.has('pacing_requires_pads')).toBe(true);
    expect(gateIds.has('capture_requires_setup')).toBe(true);
    expect(gateIds.has('sync_for_cardioversion')).toBe(true);
  });
});
