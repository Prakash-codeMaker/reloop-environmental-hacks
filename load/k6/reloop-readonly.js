import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Safety guard: this script is deliberately limited to authenticated GETs.
// Never point a stress test at production without explicit written authorization.
const baseUrl = (__ENV.RELOOP_BASE_URL || '').replace(/\/$/, '');
const confirmation = __ENV.RELOOP_LOAD_TEST_CONFIRM || '';
const stagingSuffix = (__ENV.RELOOP_STAGING_HOST_SUFFIX || '').toLowerCase().replace(/^\./, '');
if (!baseUrl || confirmation !== 'staging-only' || !stagingSuffix) {
  throw new Error('Set RELOOP_BASE_URL, RELOOP_STAGING_HOST_SUFFIX, and RELOOP_LOAD_TEST_CONFIRM=staging-only.');
}
const parsed = new URL(baseUrl);
const hostname = parsed.hostname.toLowerCase();
if (['localhost', '127.0.0.1', '::1'].includes(hostname) || parsed.protocol !== 'https:' || !(hostname === stagingSuffix || hostname.endsWith(`.${stagingSuffix}`))) {
  throw new Error('Load tests require HTTPS and a hostname equal to or below RELOOP_STAGING_HOST_SUFFIX; localhost, HTTP, and non-matching hosts are blocked.');
}
const target = Math.max(3, Math.min(10000, Number(__ENV.LOAD_TARGET_VUS || 30)));
const roleUsers = [
  { role: 'generator', share: 0.5, email: __ENV.RELOOP_GENERATOR_EMAIL, password: __ENV.RELOOP_GENERATOR_PASSWORD },
  { role: 'buyer', share: 0.3, email: __ENV.RELOOP_BUYER_EMAIL, password: __ENV.RELOOP_BUYER_PASSWORD },
  { role: 'collector', share: 0.2, email: __ENV.RELOOP_COLLECTOR_EMAIL, password: __ENV.RELOOP_COLLECTOR_PASSWORD },
];
for (const user of roleUsers) {
  if (!user.email || !user.password) throw new Error(`Missing staging credentials for role: ${user.role}`);
}
const totalVus = roleUsers.reduce((sum, user) => sum + Math.ceil(target * user.share), 0);
const failures = new Rate('reloop_request_failures');
const apiLatency = new Trend('reloop_api_latency', true);

export const options = {
  scenarios: Object.fromEntries(roleUsers.map(user => [user.role, {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: Math.max(1, Math.ceil(target * user.share * 0.25)) },
      { duration: '2m', target: Math.max(1, Math.ceil(target * user.share * 0.5)) },
      { duration: '3m', target: Math.ceil(target * user.share) },
      { duration: '2m', target: Math.ceil(target * user.share) },
      { duration: '1m', target: 0 },
    ],
    exec: `journey_${user.role}`,
    gracefulRampDown: '30s',
  }])),
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    reloop_request_failures: ['rate<0.01'],
    reloop_api_latency: ['p(95)<1000'],
  },
  tags: { app: 'reloop', test_type: 'read-only-staging' },
};

function request(path, name) {
  const response = http.get(`${baseUrl}${path}`, {
    tags: { endpoint: name },
    headers: { Accept: 'application/json' },
    timeout: '10s',
  });
  apiLatency.add(response.timings.duration, { endpoint: name });
  const ok = check(response, {
    [`${name}: HTTP 200`]: r => r.status === 200,
    [`${name}: JSON response`]: r => (r.headers['Content-Type'] || '').includes('application/json'),
  });
  failures.add(!ok);
  return response;
}

function runRole(user) {
  const login = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
    expectedRole: user.role,
  }), {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    tags: { endpoint: 'auth_login', role: user.role },
    timeout: '10s',
  });
  const loginOk = check(login, {
    [`${user.role}: login succeeds`]: r => r.status === 200,
    [`${user.role}: role is correct`]: r => {
      try { return JSON.parse(r.body).user.role === user.role; } catch { return false; }
    },
  });
  failures.add(!loginOk);
  if (!loginOk) { sleep(1); return; }

  request('/api/auth/me', `${user.role}_auth_me`);
  request('/api/workspace', `${user.role}_workspace`);
  request('/api/batches', `${user.role}_batches`);
  request('/api/notifications', `${user.role}_notifications`);
  if (user.role === 'buyer') request('/api/matches', 'buyer_matches');
  sleep(1 + Math.random() * 2);
}

export function journey_generator() { runRole(roleUsers[0]); }
export function journey_buyer() { runRole(roleUsers[1]); }
export function journey_collector() { runRole(roleUsers[2]); }

export function handleSummary(data) {
  return {
    'load/results/reloop-readonly-summary.json': JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseUrl,
      requestedTargetVus: target,
      plannedPeakVusAcrossScenarios: totalVus,
      thresholds: data.thresholds,
      metrics: Object.fromEntries(Object.entries(data.metrics).map(([key, value]) => [key, value.values || {}])),
      note: 'Read-only GET workflow plus login. Review with server/database telemetry; this is not a capacity certification.',
    }, null, 2),
    stdout: `ReLoop staging load test finished. Review thresholds, per-endpoint metrics, and server/database telemetry.\n`,
  };
}
