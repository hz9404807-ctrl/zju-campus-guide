import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  isPublicAddress, safeSourceUrl, resolvePublicTarget, boundedLimits, checkLink,
  pinnedRequest, classifyResponse, collectConfiguredSources, findDateCandidates, findConflicts, runSourceHealth, renderMarkdown,
} from '../scripts/source-health-lib.mjs';

const publicLookup = async () => [{ address: '8.8.8.8', family: 4 }];
const html = (status = 200, body = '<title>学校服务说明</title>') => ({ status, body, headers: {}, bytes: body.length });
const data = (overrides = {}) => ({ guides: [], websites: [], accounts: [], windows: [], ...overrides });

test('public address policy rejects private, local, mapped, reserved and transition networks', () => {
  for (const address of ['0.0.0.0', '10.0.0.1', '100.64.1.2', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '192.0.0.1', '192.0.2.1', '192.88.99.1', '198.18.1.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.1.2.3', '::1', '::ffff:127.0.0.1', '::ffff:8.8.8.8', '::ffff:7f00:1', 'fc00::1', 'fe80::1', 'ff02::1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001::1', '2001:db8::1', '3fff::1', 'not-ip']) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['1.1.1.1', '8.8.8.8', '210.32.0.1', '2606:4700:4700::1111', '240c::6666', '2001:4860:4860::8888']) assert.equal(isPublicAddress(address), true, address);
});

test('URL policy rejects credentials, unusual ports, local and decimal IP forms and unsafe schemes', () => {
  for (const url of ['file:///etc/passwd', 'ftp://zju.edu.cn/a', 'http://user:pass@zju.edu.cn/', 'https://zju.edu.cn:8443/', 'http://localhost/', 'http://intranet/', 'http://2130706433/', 'http://0x7f000001/', 'http://127.1/', 'http://[::ffff:7f00:1]/', 'http://metadata.internal/', 'http://school.local./', 'https://zju.edu.cn/?access_token=abc', 'https://zju.edu.cn/?ticket=abc', 'https://zju.edu.cn/?api_key=abc', 'https://zju.edu.cn/?code=abc', 'https://zju.edu.cn/?JSESSIONID=abc', 'https://zju.edu.cn/a;jsessionid=abc', 'https://zju.edu.cn/\\evil', 'https://zju.edu.cn/has space']) assert.throws(() => safeSourceUrl(url), undefined, url);
  assert.equal(safeSourceUrl('https://www.zju.edu.cn/guide?id=10#section').href, 'https://www.zju.edu.cn/guide?id=10');
});

test('DNS rejects an entire mixed answer set and binds a single inspected address', async () => {
  await assert.rejects(resolvePublicTarget(new URL('https://www.zju.edu.cn/'), async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]), { code: 'UNSAFE_DNS' });
  const seen = [];
  const result = await checkLink('https://www.zju.edu.cn/service', { lookup: async (host, options) => { seen.push({ host, options }); return [{ address: '8.8.8.8', family: 4 }, { address: '1.1.1.1', family: 4 }]; }, transport: async (url, target, limits) => { assert.deepEqual(target, { address: '8.8.8.8', family: 4 }); assert.equal(limits.maxBytes, 65536); assert.equal(url.hostname, 'www.zju.edu.cn'); return html(); } });
  assert.equal(result.status, 'reachable'); assert.equal(seen.length, 1); assert.equal(seen[0].options.all, true);
});

test('redirect target DNS is checked every hop and a private destination never reaches transport', async () => {
  const requested = [];
  const result = await checkLink('https://www.zju.edu.cn/a', {
    lookup: async (host) => [{ address: host === 'www.zju.edu.cn' ? '8.8.8.8' : '127.0.0.1', family: 4 }],
    transport: async (url) => { requested.push(url.href); return { status: 302, headers: { location: 'https://private.zju.edu.cn/inside' } }; },
  });
  assert.equal(result.status, 'blocked'); assert.equal(requested.length, 1); assert.equal(result.attempts, 1);
  let dnsCalls = 0; let httpCalls = 0;
  const rebind = await checkLink('https://www.zju.edu.cn/a', { lookup: async () => [{ address: ++dnsCalls === 1 ? '8.8.8.8' : '127.0.0.1', family: 4 }], transport: async () => { httpCalls += 1; return { status: 302, headers: { location: '/b' } }; } });
  assert.equal(rebind.status, 'blocked'); assert.equal(dnsCalls, 2); assert.equal(httpCalls, 1);
});

test('redirects with credentials, missing location or loop are bounded and classified', async () => {
  for (const location of [undefined, '', 'http://127.0.0.1/secret', 'https://user:pass@www.zju.edu.cn/', 'https://www.zju.edu.cn/?ticket=private']) {
    let requests = 0;
    const result = await checkLink('https://www.zju.edu.cn/a', { lookup: publicLookup, transport: async () => { requests += 1; return { status: 302, headers: { location } }; } });
    assert.equal(result.status, 'blocked'); assert.equal(requests, 1);
  }
  const loop = await checkLink('https://www.zju.edu.cn/a', { lookup: publicLookup, transport: async () => ({ status: 302, headers: { location: '/a' } }) });
  assert.equal(loop.status, 'suspected-invalid'); assert.equal(loop.attempts, 1);
  const chain = await checkLink('https://www.zju.edu.cn/a', { lookup: publicLookup, transport: async (url) => ({ status: 302, headers: { location: `${url.pathname}a` } }), limits: { maxRedirects: 2 } });
  assert.equal(chain.status, 'manual-review'); assert.equal(chain.attempts, 3);
});

test('classification distinguishes 404, anti-bot, auth, soft-404 and ordinary HTTP200', async () => {
  const url = new URL('https://www.zju.edu.cn/guide');
  assert.equal(classifyResponse(html(404), url, url).status, 'suspected-invalid');
  assert.equal(classifyResponse(html(410), url, url).status, 'suspected-invalid');
  for (const status of [403, 408, 429, 500, 503]) assert.equal(classifyResponse(html(status), url, url).status, 'network-restricted');
  assert.equal(classifyResponse(html(401), url, url).status, 'login-required');
  assert.equal(classifyResponse(html(200, '<title>统一身份认证</title>'), url, url).status, 'login-required');
  assert.equal(classifyResponse(html(200, '<input type="password" name="password">'), url, url).status, 'login-required');
  assert.equal(classifyResponse(html(200, '<title>404 Not Found</title>'), url, url).status, 'suspected-invalid');
  assert.equal(classifyResponse(html(200, '<title>办事流程</title>如需登录请点这里，历史404案例'), url, url).status, 'reachable');
  assert.equal(classifyResponse(html(), new URL('https://www.zju.edu.cn/'), url).status, 'manual-review');
  assert.match(classifyResponse(html(), url, url).evidence, /不能证明/);
  const redirected = await checkLink(url.href, { lookup: publicLookup, transport: async (current) => current.pathname === '/guide' ? { status: 302, headers: { location: 'https://authserver.zju.edu.cn/authserver/login' } } : html() });
  assert.equal(redirected.status, 'login-required');
});

test('network timeout is not a missing page, transient retries and global requests are bounded', async () => {
  let calls = 0;
  const timeout = await checkLink('https://www.zju.edu.cn/', { lookup: publicLookup, transport: async () => { calls += 1; throw new Error('ETIMEDOUT'); } });
  assert.equal(timeout.status, 'network-restricted'); assert.equal(calls, 2);
  let lookupCalls = 0;
  const report = await runSourceHealth(data({ websites: Array.from({ length: 30 }, (_, index) => ({ id: `website-${index}`, name: '来源', url: `https://www.zju.edu.cn/${index}` })) }), { limits: { maxRequests: 2 }, lookup: async () => { lookupCalls += 1; return publicLookup(); }, transport: async () => html(503) });
  assert.equal(report.requests, 2); assert.ok(lookupCalls <= 2); assert.ok(report.links.every((entry) => entry.status !== 'suspected-invalid'));
  for (const input of [{ concurrency: 6 }, { maxRequests: 101 }, { timeoutMs: 10001 }, { maxBytes: 131073 }, { maxRedirects: 5 }, { retries: 2 }]) assert.throws(() => boundedLimits(input));
});

test('failed DNS checks also have a global budget and cannot traverse the whole configuration', async () => {
  let lookupCalls = 0;
  const report = await runSourceHealth(data({ websites: Array.from({ length: 20 }, (_, index) => ({ id: `w${index}`, name: '来源', url: `https://www.zju.edu.cn/${index}` })) }), { limits: { maxRequests: 2 }, lookup: async () => { lookupCalls += 1; throw new Error('ENOTFOUND'); }, transport: () => assert.fail('DNS failure must not initiate HTTP') });
  assert.equal(report.requests, 0); assert.equal(report.resolutions, 2); assert.equal(lookupCalls, 2);
  assert.equal(report.links.filter((entry) => entry.status === 'not-checked').length, 18);
  assert.equal(report.nextOffset, 2);
});

test('a numeric offset reviews the tail of configured sources without accepting a visitor URL', async () => {
  const requested = [];
  const fixture = data({ websites: Array.from({ length: 5 }, (_, index) => ({ id: `w${index}`, name: '来源', url: `https://www.zju.edu.cn/${index}` })) });
  const report = await runSourceHealth(fixture, { offset: 3, lookup: publicLookup, transport: async (url) => { requested.push(url.pathname); return html(); } });
  assert.deepEqual(requested.sort(), ['/3', '/4']); assert.equal(report.startIndex, 3); assert.equal(report.nextOffset, null);
  assert.equal(report.links.slice(0, 3).every((item) => item.status === 'not-checked'), true);
  for (const offset of [-1, 1.2, 6, 'https://127.0.0.1/']) await assert.rejects(runSourceHealth(fixture, { offset, offline: true }), { code: 'INVALID_OFFSET' });
});

test('configured source collection deduplicates route/source links with all affected IDs', () => {
  const result = collectConfiguredSources(data({ guides: [{ id: 'guide-a', title: '办事', references: [{ url: 'https://www.zju.edu.cn/a#one' }], routes: [{ id: 'online', stepActions: [{ url: 'https://www.zju.edu.cn/a#two' }] }] }], websites: [{ id: 'website-a', name: '官网', url: 'https://www.zju.edu.cn/a' }], accounts: [{ id: 'account-a', name: '公众号', source: '原采集表第2行', image: '/sources/a.jpg' }] }));
  assert.equal(result.links.length, 1); assert.equal(result.links[0].affected.length, 2);
  assert.equal(result.missing.length, 1); assert.match(result.missing[0].evidence, /采集出处/);
  const timetable = collectConfiguredSources(data({ guides: [{ id: 'timetable', title: '班车', routes: [{ id: 'route', timetable: { source: { url: 'https://www.zju.edu.cn/timetable' } } }] }] }));
  assert.equal(timetable.links.length, 1); assert.equal(timetable.missing.length, 0);
});

test('date candidates use explicit evidence and ignore import/verification metadata and future rules', () => {
  const rows = [{ id: 'a', recordType: 'guide', label: '指南', summary: '2024年度申请通知。2025-2026学年适用。报名截至2026年10月19日。', importedAt: '2020-01-01', verifiedAt: '2020-01-01', references: [{ url: 'https://www.zju.edu.cn/2023/guide' }] }, { id: 'b', recordType: 'guide', label: '新规则', summary: '2026-2027学年适用。申请截至2026年10月21日。', importedAt: '2020-01-01', verificationScope: '未核实登录后申请系统；2026-10-10核对档案馆预约页面。' }, { id: 'c', recordType: 'guide', label: '缺年', summary: '报名截至10月24日。' }];
  const result = findDateCandidates(rows, '2026-10-20');
  for (const kind of ['annual-notice', 'academic-year', 'past-date', 'dated-source-url', 'undated-deadline']) assert.ok(result.some((item) => item.kind === kind), kind);
  assert.ok(result.every((item) => item.id !== 'b' && !/importedAt|verifiedAt/.test(item.field)));
  assert.throws(() => findDateCandidates(rows, '2026-02-30'));
});

test('dated reference editions and structured notices are examined without inventing an unstated deadline', () => {
  const rows = [{ id: 'finance', recordType: 'guide', label: '报销', references: [{ label: '财务报销办事指南（2025年5月修订）', url: 'https://www.zju.edu.cn/finance.pdf' }], source: '校方财务资料', importedAt: '2020-01-01', routes: [{ id: 'bus', timetable: { notices: ['有效期截至2026年10月19日。'], source: { label: '2025年度班车通知', url: 'https://www.zju.edu.cn/bus.pdf' } } }] }, { id: 'annual', recordType: 'guide', label: '每年申请', steps: ['核对当年度通知中的截止时间。'] }];
  const result = findDateCandidates(rows, '2026-10-20');
  assert.ok(result.some((item) => item.kind === 'dated-edition' && item.field === 'references.0.label'));
  assert.ok(result.some((item) => item.kind === 'past-date' && item.field === 'routes.bus.timetable.notices'));
  assert.ok(result.some((item) => item.kind === 'annual-notice' && item.field === 'routes.bus.timetable.source.label'));
  assert.ok(result.every((item) => item.id !== 'annual'));
});

test('shared phone or shared location can expose mismatches under different window names, without duplicate candidates', () => {
  const result = findConflicts(data({ windows: [{ id: 'a', name: '窗口A', campus: '紫金港', location: 'A楼101', openingHours: '8:00–12:00', contacts: [{ number: '0571-88201111' }] }, { id: 'b', name: '窗口B', campus: '紫金港', location: 'B楼201', openingHours: '9:00–12:00', contacts: [{ number: '0571-88201111' }] }, { id: 'c', name: '窗口C', campus: '紫金港', location: 'A楼101', openingHours: '8:00–12:00', contacts: [{ number: '0571-88203333' }] }] }));
  assert.ok(result.some((item) => item.field === 'location' && /共用电话号码/.test(item.evidence)));
  assert.ok(result.some((item) => item.field === 'phone' && /相同地点/.test(item.evidence)));
  assert.equal(new Set(result.map((item) => `${item.field}:${item.affected.map((entry) => entry.id).sort().join()}`)).size, result.length);
});

test('conflicts compare the same shared window and retain affected records without treating all campuses as one', () => {
  const fixture = data({ windows: [{ id: 'w1', name: '校园卡窗口', campus: '紫金港', location: 'A楼', openingHours: '8:00-12:00', contacts: [{ number: '0571-88201111' }] }, { id: 'w2', name: '校园卡窗口', campus: '紫金港', location: 'B楼', openingHours: '9:00-12:00', contacts: [{ number: '0571-88202222' }] }, { id: 'w3', name: '校园卡窗口', campus: '玉泉', location: 'C楼', contacts: [{ number: '0571-88203333' }] }], guides: [{ id: 'g1', title: '卡', serviceWindowIds: ['w1'], location: '旧A楼', contact: '0571-88204444' }, { id: 'g2', title: '多校区', serviceWindowIds: ['w1', 'w3'], location: '全校区' }, { id: 'g3', title: '失效引用', serviceWindowIds: ['deleted'] }] });
  const result = findConflicts(fixture);
  assert.ok(result.some((item) => item.field === 'phone' && item.affected.some((entry) => entry.id === 'g1')));
  assert.ok(result.some((item) => item.field === 'openingHours'));
  assert.ok(result.some((item) => item.kind === 'missing-window'));
  assert.ok(result.every((item) => !item.affected.some((entry) => entry.id === 'g2' || entry.id === 'w3')));
});

test('offline report does not invoke networking, escapes table fields and does not mark content verified', async () => {
  const report = await runSourceHealth(data({ websites: [{ id: 'x', name: '标题 | <script>', url: 'https://www.zju.edu.cn/' }], guides: [{ id: 'g', title: '无来源' }] }), { offline: true, asOf: '2026-10-20', lookup: () => { assert.fail('offline DNS'); }, transport: () => { assert.fail('offline transport'); } });
  assert.equal(report.requests, 0); assert.equal(report.links[0].status, 'not-checked');
  assert.equal(report.missingSources.length, 1);
  const markdown = renderMarkdown(report);
  assert.match(markdown, /\\\|/); assert.match(markdown, /HTTP 200/); assert.match(markdown, /不修改业务内容或 verifiedAt/);
});

test('production adapter pins lookup, caps body and sends no cookies, auth or referrer', async () => {
  let captured; let destroyedRequest = false; let destroyedResponse = false;
  const factory = (url, options, onResponse) => {
    captured = { url, options };
    const request = new EventEmitter();
    request.destroy = () => { destroyedRequest = true; };
    request.end = () => queueMicrotask(() => {
      const response = new EventEmitter(); response.statusCode = 200; response.headers = {};
      response.destroy = () => { destroyedResponse = true; };
      onResponse(response);
      response.emit('data', Buffer.alloc(1000, 'x')); response.emit('end');
    });
    return request;
  };
  const result = await pinnedRequest(new URL('https://www.zju.edu.cn/'), { address: '8.8.8.8', family: 4 }, { timeoutMs: 100, maxBytes: 128 }, factory);
  assert.equal(result.bytes, 128); assert.equal(result.body.length, 128); assert.equal(result.truncated, true);
  assert.equal(destroyedRequest, true); assert.equal(destroyedResponse, true);
  const { options } = captured;
  assert.deepEqual(await new Promise((resolve, reject) => options.lookup('www.zju.edu.cn', {}, (error, address, family) => error ? reject(error) : resolve({ address, family }))), { address: '8.8.8.8', family: 4 });
  assert.deepEqual(await new Promise((resolve, reject) => options.lookup('www.zju.edu.cn', { all: true }, (error, answers) => error ? reject(error) : resolve(answers))), [{ address: '8.8.8.8', family: 4 }]);
  assert.equal(options.headers['Accept-Encoding'], 'identity'); assert.equal(options.maxHeaderSize, 16384);
  assert.equal(options.agent, false); assert.equal(options.headers.Cookie, undefined); assert.equal(options.headers.Authorization, undefined); assert.equal(options.headers.Referer, undefined);
});

test('adapter enforces wall timeout and DNS timeout does not initiate HTTP', async () => {
  let destroyed = false;
  await assert.rejects(pinnedRequest(new URL('https://www.zju.edu.cn/'), { address: '8.8.8.8', family: 4 }, { timeoutMs: 50, maxBytes: 128 }, () => {
    const request = new EventEmitter(); request.end = () => {}; request.destroy = () => { destroyed = true; }; return request;
  }), { code: 'ETIMEDOUT' });
  assert.equal(destroyed, true);
  const result = await checkLink('https://www.zju.edu.cn/', { limits: { timeoutMs: 50 }, lookup: () => new Promise(() => {}), transport: () => assert.fail('no HTTP after DNS timeout') });
  assert.equal(result.status, 'network-restricted'); assert.equal(result.attempts, 0);
});

test('a forbidden configured credential URL is never copied into offline or online output', async () => {
  const fixture = data({ websites: [{ id: 'source', name: '入口', url: 'https://user:VERY_SECRET@www.zju.edu.cn/2022/a?ticket=VERY_SECRET' }] });
  for (const offline of [true, false]) {
    const report = await runSourceHealth(fixture, { offline, lookup: () => assert.fail('blocked URL DNS'), transport: () => assert.fail('blocked URL HTTP') });
    assert.equal(report.links[0].status, 'blocked'); assert.doesNotMatch(JSON.stringify(report), /VERY_SECRET/); assert.doesNotMatch(renderMarkdown(report), /VERY_SECRET/);
  }
});
