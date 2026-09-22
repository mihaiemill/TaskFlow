/**
 * k6 Stress Test — TaskFlow API
 * Run: k6 run load-test.js
 * Run cu JSON: k6 run --summary-export=k6-summary.json load-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5179';

const PRIORITIES = ['Low', 'Medium', 'High'];
const STATUSES   = ['Todo', 'InProgress', 'Done'];

// ─── Metrici custom ───────────────────────────────────────────────────────────
const authErrors    = new Counter('auth_errors');
const projectErrors = new Counter('project_errors');
const taskErrors    = new Counter('task_errors');
const apiErrorRate  = new Rate('api_error_rate');
const projectCreateDuration = new Trend('project_create_duration', true);
const taskCreateDuration    = new Trend('task_create_duration', true);

// ─── Options ──────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '20s', target: 50  },  // warm-up gradual
    { duration: '30s', target: 200 },  // urcare la sarcina medie
    { duration: '30s', target: 500 },  // spike la maxim
    { duration: '30s', target: 500 },  // menține spike
    { duration: '20s', target: 50  },  // drop gradual
    { duration: '20s', target: 0   },  // recuperare completă
  ],
  thresholds: {
    // stress test — praguri realiste, nu aborta la primul eșec
    'api_error_rate':    [{ threshold: 'rate<0.15', abortOnFail: false }],
    'http_req_duration': [{ threshold: 'p(95)<10000', abortOnFail: false }],
    'auth_errors':       [{ threshold: 'count<200',   abortOnFail: false }],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TIMEOUT = { timeout: '15s' };

function headers(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...TIMEOUT,
  };
}

function assertOk(res, label) {
  const ok = res.status >= 200 && res.status < 300;
  apiErrorRate.add(ok ? 0 : 1);
  check(res, { [`${label} → 2xx`]: () => ok });
  return ok;
}

function parseJson(res) {
  try { return JSON.parse(res.body); } catch { return null; }
}

// ─── VU principal ─────────────────────────────────────────────────────────────
export default function () {
  const uid      = `${__VU}_${__ITER}_${randomString(4)}`;
  const email    = `k6_${uid}@test.local`;
  const password = 'Test@1234!';
  const fullName = `K6 User ${uid}`;

  let token     = null;
  let projectId = null;
  let taskId    = null;
  let tagId     = null;

  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  group('Auth', () => {
    // retry o dată dacă server returnează 5xx (supraîncărcat)
    let regRes = http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({ email, password, fullName }),
      headers(null),
    );
    if (regRes.status >= 500) {
      sleep(randomIntBetween(1, 3));
      regRes = http.post(
        `${BASE_URL}/api/auth/register`,
        JSON.stringify({ email, password, fullName }),
        headers(null),
      );
    }
    if (!assertOk(regRes, 'Register')) { authErrors.add(1); return; }

    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email, password }),
      headers(null),
    );
    if (!assertOk(loginRes, 'Login')) { authErrors.add(1); return; }

    const body = parseJson(loginRes);
    token = body?.token ?? body?.accessToken ?? null;
    check(token, { 'Login → token prezent': (t) => !!t });
  });

  if (!token) { sleep(1); return; }

  // ── 2. Projects ──────────────────────────────────────────────────────────────
  group('Projects', () => {
    assertOk(http.get(`${BASE_URL}/api/projects`, headers(token)), 'GET projects');

    const t0 = Date.now();
    const createRes = http.post(
      `${BASE_URL}/api/projects`,
      JSON.stringify({
        name:        `Proiect k6 ${uid}`,
        description: 'Generat automat de k6 stress test',
        color:       '#524E91',
      }),
      headers(token),
    );
    projectCreateDuration.add(Date.now() - t0);

    if (!assertOk(createRes, 'POST project')) { projectErrors.add(1); return; }

    const proj = parseJson(createRes);
    projectId = proj?.id ?? proj?.Id ?? null;
    check(projectId, { 'Proiect creat → id prezent': (id) => !!id });
    if (!projectId) { projectErrors.add(1); return; }

    assertOk(http.get(`${BASE_URL}/api/projects/${projectId}`, headers(token)), 'GET project by id');

    assertOk(http.put(
      `${BASE_URL}/api/projects/${projectId}`,
      JSON.stringify({ name: `Proiect k6 ${uid} (upd)`, description: 'Updatat de k6', color: '#5AC4C2' }),
      headers(token),
    ), 'PUT project');
  });

  sleep(0.5);
  if (!projectId) { sleep(1); return; }

  // ── 3. Tasks ─────────────────────────────────────────────────────────────────
  group('Tasks', () => {
    const t0 = Date.now();
    const createRes = http.post(
      `${BASE_URL}/api/tasks`,
      JSON.stringify({
        title:       `Task k6 ${uid}`,
        description: 'Task generat de stress test',
        priority:    PRIORITIES[randomIntBetween(0, 2)],
        status:      'Todo',
        projectId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      headers(token),
    );
    taskCreateDuration.add(Date.now() - t0);

    if (!assertOk(createRes, 'POST task')) { taskErrors.add(1); return; }

    const task = parseJson(createRes);
    taskId = task?.id ?? task?.Id ?? null;
    check(taskId, { 'Task creat → id prezent': (id) => !!id });
    if (!taskId) { taskErrors.add(1); return; }

    assertOk(http.get(`${BASE_URL}/api/tasks/${taskId}`, headers(token)), 'GET task by id');

    assertOk(http.put(
      `${BASE_URL}/api/tasks/${taskId}`,
      JSON.stringify({
        title:     `Task k6 ${uid} (upd)`,
        priority:  PRIORITIES[randomIntBetween(0, 2)],
        status:    STATUSES[randomIntBetween(0, 2)],
        projectId,
      }),
      headers(token),
    ), 'PUT task');
  });

  sleep(0.5);

  // ── 4. Tags ──────────────────────────────────────────────────────────────────
  group('Tags', () => {
    const createRes = http.post(
      `${BASE_URL}/api/tags`,
      JSON.stringify({ name: `tag-k6-${uid}` }),
      headers(token),
    );
    const tagOk = [200, 201, 409].includes(createRes.status);
    apiErrorRate.add(tagOk ? 0 : 1);
    check(createRes, { 'POST tag → 2xx/409': () => tagOk });

    if (createRes.status === 200 || createRes.status === 201) {
      tagId = parseJson(createRes)?.id ?? null;
    }

    assertOk(http.get(`${BASE_URL}/api/tags`, headers(token)), 'GET tags');

    // Asociere tag la task
    if (taskId && tagId) {
      const addRes = http.post(
        `${BASE_URL}/api/tasks/${taskId}/tags/${tagId}`,
        null,
        headers(token),
      );
      assertOk(addRes, 'POST task tag');
    }
  });

  sleep(0.5);

  // ── 5. Comments ───────────────────────────────────────────────────────────────
  if (taskId) {
    group('Comments', () => {
      assertOk(http.post(
        `${BASE_URL}/api/tasks/${taskId}/comments`,
        JSON.stringify({ content: `Comentariu k6 ${new Date().toISOString()}` }),
        headers(token),
      ), 'POST comment');
    });
  }

  sleep(randomIntBetween(1, 3));
}

// ─── Summary ──────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const p95 = (m) => (data.metrics[m]?.values?.['p(95)'] ?? 0).toFixed(0);
  const cnt = (m) => data.metrics[m]?.values?.count ?? 0;
  const rate = (m) => ((data.metrics[m]?.values?.rate ?? 0) * 100).toFixed(2);

  const line = (label, val) => `║  ${(label + ':').padEnd(24)} ${String(val).padEnd(27)}║`;

  const summary = [
    '╔══════════════════════════════════════════════════════╗',
    '║       TaskFlow k6 — Rezultate Stress Test            ║',
    '╠══════════════════════════════════════════════════════╣',
    line('Total requests', cnt('http_reqs')),
    line('Request rate', (data.metrics.http_reqs?.values?.rate ?? 0).toFixed(2) + ' req/s'),
    line('Error rate', rate('api_error_rate') + '%'),
    '╠══════════════════════════════════════════════════════╣',
    line('http_req_duration p(95)', p95('http_req_duration') + ' ms'),
    line('project_create p(95)', p95('project_create_duration') + ' ms'),
    line('task_create p(95)', p95('task_create_duration') + ' ms'),
    '╠══════════════════════════════════════════════════════╣',
    line('Auth errors', cnt('auth_errors')),
    line('Project errors', cnt('project_errors')),
    line('Task errors', cnt('task_errors')),
    '╚══════════════════════════════════════════════════════╝',
  ].join('\n');

  console.log(summary);

  return {
    stdout:            summary,
    'k6-summary.json': JSON.stringify(data, null, 2),
  };
}