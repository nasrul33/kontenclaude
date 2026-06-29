import { PLATFORM_LIMITS, PlatformConstraintError, type Platform } from '@clipflow/shared';

// Pure, testable. Enforced BEFORE upload (invariants #8 YouTube ≤60s, #9 Facebook ≤90s).
export function assertDurationWithinLimit(platform: Platform, durationSec: number): void {
  const limit = PLATFORM_LIMITS[platform];
  if (durationSec > limit.maxDurationSec) {
    throw new PlatformConstraintError(
      `${platform}: video ${durationSec.toFixed(1)}s exceeds ${limit.maxDurationSec}s cap`,
    );
  }
}

export function assertFileWithinLimit(platform: Platform, bytes: number): void {
  const limit = PLATFORM_LIMITS[platform];
  if (bytes > limit.maxFileBytes) {
    throw new PlatformConstraintError(
      `${platform}: file ${bytes} bytes exceeds ${limit.maxFileBytes} cap`,
    );
  }
}
