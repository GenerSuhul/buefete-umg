const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const config = {};
for (const file of ['.env', '.env.platform.local']) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const offset = line.indexOf('=');
    if (offset > 0 && !line.startsWith('#')) config[line.slice(0, offset)] = line.slice(offset + 1);
  }
}
const base = process.env.BUFETE_QA_API || 'http://127.0.0.1:5107/api/v1';
const mailFile = process.env.BUFETE_QA_MAIL_FILE || '.artifacts/changes-qa/065f3491deaa/smtp-message.txt';
async function req(path, body) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Sede-Code': 'peten' }, body: JSON.stringify(body) });
  const raw = await response.text();
  return { status: response.status, body: raw ? JSON.parse(raw) : null };
}
function latestCode() {
  const mail = fs.readFileSync(mailFile, 'utf8').split('--- QA MESSAGE END ---').map(item => item.trim()).filter(Boolean).at(-1);
  const encoded = mail.split(/\r?\n\r?\n/).at(-1).trim();
  const html = Buffer.from(encoded, 'base64').toString('utf8');
  const code = html.match(/<strong>(\d{8})<\/strong>/)?.[1];
  assert.match(code, /^\d{8}$/);
  return code;
}
async function start() {
  const before = fs.existsSync(mailFile) ? fs.statSync(mailFile).size : 0;
  const started = await req('/auth/platform-password-recovery/start', { email: config.PlatformAdmin__Email });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  assert.ok(started.body.challengeToken);
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(mailFile) && fs.statSync(mailFile).size > before) return { token: started.body.challengeToken, code: latestCode() };
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('SMTP QA no recibió el código.');
}
async function main() {
  const originalPassword = config.PlatformAdmin__Password;
  const newPassword = `QA-${crypto.randomBytes(14).toString('hex')}`;
  assert.equal((await req('/auth/login', { email: config.PlatformAdmin__Email, password: originalPassword })).status, 200);
  const first = await start();
  const incorrect = await req('/auth/platform-password-recovery/complete', { challengeToken: first.token, code: '00000000' === first.code ? '11111111' : '00000000', newPassword });
  assert.equal(incorrect.status, 401, JSON.stringify(incorrect.body));
  const completed = await req('/auth/platform-password-recovery/complete', { challengeToken: first.token, code: first.code, newPassword });
  assert.equal(completed.status, 204, JSON.stringify(completed.body));
  const replay = await req('/auth/platform-password-recovery/complete', { challengeToken: first.token, code: first.code, newPassword });
  assert.equal(replay.status, 401, JSON.stringify(replay.body));
  assert.equal((await req('/auth/login', { email: config.PlatformAdmin__Email, password: originalPassword })).status, 401);
  assert.equal((await req('/auth/login', { email: config.PlatformAdmin__Email, password: newPassword })).status, 200);
  const restore = await start();
  assert.equal((await req('/auth/platform-password-recovery/complete', { challengeToken: restore.token, code: restore.code, newPassword: originalPassword })).status, 204);
  assert.equal((await req('/auth/login', { email: config.PlatformAdmin__Email, password: originalPassword })).status, 200);
  console.log(JSON.stringify({ ok: true, api: base, checks: ['email-code', 'invalid-code-rejected', 'password-updated', 'challenge-one-use', 'old-password-rejected', 'original-qa-password-restored'] }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
