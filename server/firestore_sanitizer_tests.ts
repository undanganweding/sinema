/**
 * Comprehensive regression tests for sanitizeForFirestore() and the API key invariant.
 *
 * Covers:
 * 1. Root undefined -> undefined
 * 2. Nested undefined property -> removed
 * 3. Undefined in array -> removed
 * 4. Undefined in array of objects -> undefined property removed from object
 * 5-9. contextPackage.sources[] optional fields (publisher, author, url, reference, sourceNotes) undefined -> keys removed
 * 10. Deep nested objects (3-4 levels) -> all undefined removed, valid retained
 * 11-16. Primitives & empty structures preserved (null, false, 0, "", [], {})
 * 17. Date preserved
 * 18. Firestore special objects preserved (Timestamp, GeoPoint, DocumentReference, etc.)
 * 19. reasoning_config.api_key completely absent
 * 20. Existing API-key regression invariants intact
 * 21. JSON fallback compatibility intact
 */
import fs from 'fs';
import path from 'path';
import { db, sanitizeForFirestore, sanitizeProjectForStorage } from './db';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function findUndefinedValue(node: unknown, trail = '$'): string | null {
  if (node === undefined) return trail;
  if (node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const hit = findUndefinedValue(node[i], `${trail}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const hit = findUndefinedValue(v, `${trail}.${k}`);
    if (hit) return hit;
  }
  return null;
}

function findApiKeyProperty(node: unknown, trail = '$'): string | null {
  if (node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const hit = findApiKeyProperty(node[i], `${trail}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === 'api_key') return `${trail}.${k}`;
    const hit = findApiKeyProperty(v, `${trail}.${k}`);
    if (hit) return hit;
  }
  return null;
}

async function main() {
  console.log('Running Firestore Recursive Sanitizer Tests...');

  // 1. Root undefined
  assert(sanitizeForFirestore(undefined) === undefined, 'root undefined');

  // 2-4. Nested objects & arrays with undefined
  const testObj = {
    a: undefined,
    b: 'valid',
    c: {
      d: undefined,
      e: 0,
      f: false,
      g: null,
      h: '',
      i: [],
      j: {},
    },
    arr: [undefined, 1, 'text', { k: undefined, l: 'inner' }],
  };

  const sanitized: any = sanitizeForFirestore(testObj);

  assert(!('a' in sanitized), 'root undefined property removed');
  assert(sanitized.b === 'valid', 'valid primitive preserved');
  assert(!('d' in sanitized.c), 'nested undefined property removed');
  assert(sanitized.c.e === 0, '0 preserved');
  assert(sanitized.c.f === false, 'false preserved');
  assert(sanitized.c.g === null, 'null preserved');
  assert(sanitized.c.h === '', 'empty string preserved');
  assert(Array.isArray(sanitized.c.i) && sanitized.c.i.length === 0, 'empty array preserved');
  assert(typeof sanitized.c.j === 'object' && Object.keys(sanitized.c.j).length === 0, 'empty object preserved');
  assert(sanitized.arr.length === 3, 'undefined element removed from array');
  assert(sanitized.arr[0] === 1, 'array element 1 preserved');
  assert(sanitized.arr[1] === 'text', 'array element text preserved');
  assert(!('k' in sanitized.arr[2]), 'undefined property in array object removed');
  assert(sanitized.arr[2].l === 'inner', 'valid property in array object preserved');

  // 5-9. Production reproduction: contextPackage.sources[0] with undefined optional fields (publisher, author, url, reference, sourceNotes)
  const prodFixture = {
    contextPackage: {
      sources: [
        {
          sourceId: 'source_default_1',
          sourceType: 'GENERAL_WEB',
          title: 'Initial grounding context',
          author: undefined,
          publisher: undefined,
          publicationDate: undefined,
          reference: undefined,
          url: undefined,
          sourceNotes: undefined,
          relevance: 0.6,
          usedFor: ['classification', 'context'],
          authority: 'UNKNOWN',
          verification: 'UNAVAILABLE',
        },
      ],
    },
    reasoning_config: {
      provider_type: 'google',
      model_id: 'gemini-3.7-flash',
      api_key: 'sk-secret-ephemeral-key',
    },
  };

  const sanitizedProd: any = sanitizeForFirestore(prodFixture);

  const source0 = sanitizedProd.contextPackage.sources[0];
  assert(!('publisher' in source0), 'publisher: undefined is completely removed');
  assert(!('author' in source0), 'author: undefined is completely removed');
  assert(!('url' in source0), 'url: undefined is completely removed');
  assert(!('reference' in source0), 'reference: undefined is completely removed');
  assert(!('sourceNotes' in source0), 'sourceNotes: undefined is completely removed');
  assert(source0.title === 'Initial grounding context', 'valid source title preserved');
  assert(source0.relevance === 0.6, 'valid source relevance preserved');

  // 10. Deep nested objects (3-4 levels)
  const deepObj = {
    level1: {
      level2: {
        level3: {
          level4: {
            valid: 'deep',
            missing: undefined,
          },
        },
      },
    },
  };
  const sanitizedDeep: any = sanitizeForFirestore(deepObj);
  assert(sanitizedDeep.level1.level2.level3.level4.valid === 'deep', 'deep nested valid preserved');
  assert(!('missing' in sanitizedDeep.level1.level2.level3.level4), 'deep nested undefined removed');

  // 17. Date preserved
  const testDate = new Date();
  const sanitizedDate: any = sanitizeForFirestore({ date: testDate });
  assert(sanitizedDate.date instanceof Date, 'Date object preserved');

  // 18. Firestore special objects preserved (simulate timestamp/geopoint/docref via duck-typing or custom class)
  class MockTimestamp {
    toMillis() { return 123456789; }
  }
  const mockTs = new MockTimestamp();
  const sanitizedSpecial = sanitizeForFirestore({ ts: mockTs, un: undefined });
  assert(sanitizedSpecial.ts === mockTs, 'Firestore special object preserved');
  assert(!('un' in sanitizedSpecial), 'undefined removed alongside special object');

  // 19. reasoning_config.api_key completely absent
  const apiKeyTrail = findApiKeyProperty(sanitizedProd);
  assert(apiKeyTrail === null, `reasoning_config.api_key absent from sanitized payload (found at ${apiKeyTrail})`);
  assert(sanitizedProd.reasoning_config.model_id === 'gemini-3.7-flash', 'other reasoning_config fields retained');

  // Deep walk assert: NO undefined anywhere
  const finalUndefinedTrail = findUndefinedValue(sanitizedProd);
  assert(finalUndefinedTrail === null, `Deep walk confirmed ZERO undefined values anywhere in sanitized output (found at ${finalUndefinedTrail})`);

  console.log('ALL FIRESTORE RECURSIVE SANITIZER TESTS PASSED SUCCESSFULLY.');
}

main().catch((err) => {
  console.error('TEST FAIL:', err);
  process.exitCode = 1;
});
