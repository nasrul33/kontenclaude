// Smoke test — proves the test runner can resolve apps/api code paths.
import { describe, expect, it } from 'vitest';

describe('apps/api smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
