// Plans are model-authored hypotheses, never proof of coverage or authority.
export function validatePlan(plan, revision) {
 if (!plan || plan.revision !== revision || !/^[a-f0-9]{40,64}$/.test(revision)) throw Error('Plan must match the exact inspected revision');
 if (!Array.isArray(plan.requirements) || !plan.requirements.length || plan.requirements.length > 12 || !Array.isArray(plan.tests) || plan.tests.length > 4) throw Error('Plan requires 1–12 requirements and at most 4 generated tests');
 const ids = new Set(), names = new Set();
 for (const r of plan.requirements) {
  if (!r || !/^[a-z0-9-]{1,40}$/.test(r.id || '') || ids.has(r.id) || typeof r.behavior !== 'string' || !r.behavior.trim() || r.behavior.length > 1500 || typeof r.basis !== 'string' || !r.basis.trim() || r.basis.length > 1000) throw Error('Each requirement needs a unique id, behavior and evidence basis');
  ids.add(r.id);
 }
 for (const t of plan.tests) {
  if (!t || !/^[a-z0-9-]{1,40}$/.test(t.name || '') || names.has(t.name) || typeof t.source !== 'string' || !t.source.trim() || Buffer.byteLength(t.source) > 24000 || !Array.isArray(t.requirements) || !t.requirements.length || t.requirements.some(id => !ids.has(id))) throw Error('Invalid generated test or requirement mapping');
  names.add(t.name);
 }
 return plan;
}
export function applyPlan(spec, plan) {
 validatePlan(plan, plan.revision);
 const checks = plan.tests.map(t => ({name:`generated-${t.name}`, argv:['sh','-c','if [ -d /deps/node_modules ]; then ln -s /deps/node_modules /work/node_modules; fi; exec node --test "$1"','qa',`.obra-qa-tests/${t.name}.test.mjs`], timeoutMs:120000}));
 const result = {...spec, checks:[...spec.checks,...checks], generatedTests:plan.tests, plan};
 if (result.checks.length > 10) throw Error('Combined plan exceeds 10 checks');
 return result;
}
export function coverageFor(plan, checks) {
 return plan.requirements.map(r => {
  const names = plan.tests.filter(t => t.requirements.includes(r.id)).map(t => `generated-${t.name}`);
  const results = names.map(name => checks.find(c => c.name === name));
  return {...r, checks:names, status:!names.length ? 'not-tested' : results.every(c => c?.status === 'passed') ? 'checks-passed' : 'needs-review'};
 });
}
