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
const banner = [
  '', '='.repeat(64),
  '  Executor ready. Set these in the AGENT\'s environment:', '',
  '    OBRA_QA_URL=https://host.docker.internal:4781',
  '    OBRA_QA_TOKEN_FILE=' + tokenPath,
  '    OBRA_QA_CA_FILE=' + certPath, '',
  '  (For the bundled agent, compose.local.yml already wires these.)',
  '  Keep this process running. It binds only 127.0.0.1:4781.',
  '  Never paste the token into chat — hand the agent the file path.',
  '='.repeat(64), ''];
console.log(banner.join('\n'));

const env = {...process.env, OBRA_QA_TOKEN_FILE: tokenPath};
if (existsSync(pyVenv)) env.OBRA_QA_PDF_PYTHON = pyVenv; // PDF is optional; degrades cleanly without it.
const bridge = spawnSync('node', [resolve(root, 'src/bridge.mjs'), configPath], {stdio: 'inherit', cwd: root, env});
process.exit(bridge.status ?? 0);
