import { classifyError, isRetryableError } from './llm_provider';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function main(): void {
  assert(classifyError({ message: 'quota exceeded' }) === 'quota_exceeded', 'quota errors have a distinct classification');
  assert(classifyError({ status: 429, message: 'too many requests' }) === 'rate_limit', 'rate limits remain distinct from quota');
  assert(classifyError({ status: 503, message: 'service unavailable' }) === 'network', 'transient provider failures classify as network');
  assert(isRetryableError({ status: 503 }), 'network failures are retryable');
  assert(!isRetryableError({ status: 400, message: 'invalid schema' }), 'schema failures are not retryable');
  assert(!isRetryableError({ status: 401, message: 'unauthorized' }), 'auth failures are not retryable');
  console.log('PATCH 6.0-R2 retry assertions: PASS');
}

main();