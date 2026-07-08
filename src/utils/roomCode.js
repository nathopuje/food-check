const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}

function generateUniqueCode(existsFn, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateCode();
    if (!existsFn(code)) return code;
  }
  throw new Error('Could not generate a unique room code');
}

module.exports = { generateCode, generateUniqueCode, CHARSET, CODE_LENGTH };
