const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCode, generateUniqueCode, CHARSET, CODE_LENGTH } = require('../src/utils/roomCode');

test('generateCode produces codes of the expected length from the unambiguous charset', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateCode();
    assert.equal(code.length, CODE_LENGTH);
    for (const char of code) {
      assert.ok(CHARSET.includes(char), `unexpected character ${char}`);
    }
  }
});

test('generateUniqueCode retries past collisions', () => {
  let calls = 0;
  const existsFn = (code) => {
    calls += 1;
    return calls <= 2;
  };
  const code = generateUniqueCode(existsFn);
  assert.equal(typeof code, 'string');
  assert.equal(calls, 3);
});

test('generateUniqueCode throws if every attempt collides', () => {
  assert.throws(() => generateUniqueCode(() => true, 5));
});
