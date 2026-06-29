import { describe, expect, it } from 'vitest';
import { stat } from 'node:fs/promises';
import { jobTmpDir, withTmpDir } from '../fs-temp.js';

describe('fs-temp', () => {
  it('jobTmpDir lives under the sanitize root and strips unsafe chars', () => {
    const dir = jobTmpDir('abc-123');
    expect(dir).toMatch(/abc-123$/);
    const dirty = jobTmpDir('../../etc/passwd');
    expect(dirty).not.toContain('..');
  });

  it('withTmpDir creates then removes the dir', async () => {
    let captured = '';
    await withTmpDir('test-job-xyz', async dir => {
      captured = dir;
      await stat(dir); // exists inside the callback
    });
    await expect(stat(captured)).rejects.toThrow(); // gone after
  });

  it('withTmpDir cleans up even when fn throws', async () => {
    let captured = '';
    await expect(
      withTmpDir('test-job-fail', async dir => {
        captured = dir;
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(stat(captured)).rejects.toThrow();
  });
});
