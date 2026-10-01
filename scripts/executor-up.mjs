#!/usr/bin/env node
// One command to stand up the Obra QA executor (the isolated bridge).
//
// Obra QA never runs target code inside the agent — it delegates to this
// executor, a small loopback service that runs each check in an isolated Docker
// container. Onboarding used to be five manual steps (setup-local, openssl,
// build runner, run bridge, wire compose); this collapses them into one and
// prints exactly what to set in the agent's environment.
//
//   node scripts/executor-up.mjs
//
// It is idempotent: existing token, certificate and fixtures are reused, so
// re-running it just restarts the bridge. Requires Docker, Node and openssl.
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const local = resolve(root, 'local');
const tokenPath = resolve(local, 'bridge-token');
const certPath = resolve(local, 'bridge.crt');
const keyPath = resolve(local, 'bridge.key');
const configPath = resolve(local, 'bridge.json');

function have(cmd, ...args) {
  try { execFileSync(cmd, args, {stdio: 'ignore'}); return true; } catch { return false; }
}
function die(msg) { console.error('\n✗ ' + msg + '\n'); process.exit(1); }

// 1. Prerequisites — fail early with a clear reason, not a stack trace.
if (!have('docker', 'version')) die('Docker is required and not reachable. Install Docker (or start Docker Desktop) and run this again. The executor runs each check in an isolated container, so Docker is not optional.');
if (!have('openssl', 'version')) die('openssl is required to create the loopback TLS certificate. Install it and run this again.');

mkdirSync(local, {recursive: true});

// 2. Token + fixture + bridge.json — setup-local generates them; skip if a
//    token already exists so custom project configuration is preserved.
if (!existsSync(tokenPath)) {
  console.log('• Generating executor token, fixture and configuration…');
  spawnSync('node', [resolve(root, 'scripts/setup-local.mjs')], {stdio: 'inherit', cwd: root});
  if (!existsSync(tokenPath)) die('setup-local did not produce local/bridge-token. Check its output above.');
} else {
  console.log('• Reusing existing token and configuration in local/.');
}

// 3. Loopback TLS certificate (7-day dev cert). Covers localhost,
//    host.docker.internal and 127.0.0.1 so the agent reaches it either way.
const certValid = existsSync(certPath) && existsSync(keyPath) &&
  have('openssl', 'x509', '-checkend', '86400', '-noout', '-in', certPath);
if (!certValid) {
  console.log('• Creating loopback TLS certificate (valid 7 days)…');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '7',
    '-subj', '/CN=localhost', '-keyout', keyPath, '-out', certPath,
    '-addext', 'subjectAltName=DNS:localhost,DNS:host.docker.internal,IP:127.0.0.1'], {stdio: 'ignore'});
  execFileSync('chmod', ['600', keyPath]);
} else {
  console.log('• Reusing valid TLS certificate.');
}

// 4. Runner image — the sandbox each check executes in.
console.log('• Building the isolated runner image (obra-qa-runner)…');
execFileSync('docker', ['build', '--platform', 'linux/amd64', '-f',
  resolve(root, 'runner.Dockerfile'), '-t', 'obra-qa-runner', root], {stdio: 'inherit'});

// 5. Tell the operator exactly what to set in the agent, then run the bridge.
const pyVenv = resolve(local, 'venv/bin/python');
// Pairing code: the agent connects itself from this, entirely through chat — no
// environment variables, no token file on the agent side. It carries the URL,
// token and CA, so it is sensitive (treat like a password). OBRA_QA_PUBLIC_URL
// overrides the advertised URL when the agent runs on another machine.
const publicUrl = process.env.OBRA_QA_PUBLIC_URL || 'https://host.docker.internal:4781';
const pairing = 'OBRAQA1-' + Buffer.from(JSON.stringify({
  u: publicUrl,
  t: readFileSync(tokenPath, 'utf8').trim(),
  c: readFileSync(certPath, 'utf8'),
})).toString('base64url');
const banner = [
  '', '='.repeat(68),
  '  Executor ready, listening on 127.0.0.1:4781. Keep this running.', '',
  '  CONNECT BY CHAT — send this one-line pairing code to your agent:', '',
  '    ' + pairing, '',
  '  The agent runs `qa-client.mjs pair <code>` and connects itself —',
  '  no environment variables, no token file on the agent side.',
  '  The code carries the executor URL + credential: treat it like a',
  '  password, and only send it to your own agent.', '',
  '  Agent on another machine? Set OBRA_QA_PUBLIC_URL to a URL it can',
  '  reach BEFORE running this (this code points to ' + publicUrl + ').',
  '  (For the bundled local agent, compose.local.yml still wires the',
  '  file paths directly — pairing is for one-click/phone installs.)',
  '='.repeat(68), ''];
console.log(banner.join('\n'));

const env = {...process.env, OBRA_QA_TOKEN_FILE: tokenPath};
if (existsSync(pyVenv)) env.OBRA_QA_PDF_PYTHON = pyVenv; // PDF is optional; degrades cleanly without it.
const bridge = spawnSync('node', [resolve(root, 'src/bridge.mjs'), configPath], {stdio: 'inherit', cwd: root, env});
process.exit(bridge.status ?? 0);
