import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export const DEFAULT_LIMITS = Object.freeze({ maxRequests: 40, concurrency: 3, timeoutMs: 6000, maxBytes: 65536, maxRedirects: 3, retries: 1 });
export const STATUS_LABELS = Object.freeze({
  reachable: '链接正常（内容未核实）', 'login-required': '需要登录',
  'network-restricted': '网络或反爬限制', 'suspected-invalid': '疑似失效',
  'manual-review': '内容待人工核验', blocked: '安全规则阻止请求', 'not-checked': '本次未请求',
});

function failure(code) { const error = new Error(code); error.code = code; return error; }

export function boundedLimits(input = {}) {
  const bounds = { maxRequests: [1, 100], concurrency: [1, 5], timeoutMs: [50, 10000], maxBytes: [64, 131072], maxRedirects: [0, 4], retries: [0, 1] };
  const result = {};
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const value = input[key] ?? DEFAULT_LIMITS[key];
    if (!Number.isInteger(value) || value < min || value > max) throw failure(`INVALID_LIMIT_${key}`);
    result[key] = value;
  }
  return result;
}

function publicIPv4(address) {
  const p = address.split('.').map(Number);
  if (p.length !== 4 || p.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = p;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

function ipv6Words(address) {
  const normalized = address.toLowerCase();
  if (normalized.includes('%')) return null;
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const words = (part) => part ? part.split(':').flatMap((item) => {
    if (item.includes('.')) {
      if (isIP(item) !== 4) return [NaN];
      const p = item.split('.').map(Number); return [(p[0] << 8) | p[1], (p[2] << 8) | p[3]];
    }
    return [parseInt(item, 16)];
  }) : [];
  const left = words(halves[0]); const right = words(halves[1]);
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const result = [...left, ...Array(missing).fill(0), ...right];
  return result.length === 8 && result.every((word) => Number.isInteger(word) && word >= 0 && word <= 65535) ? result : null;
}

/** Conservative public-only policy: IPv4-mapped, NAT64, 6to4, documentation and special-use IPv6 are rejected. */
export function isPublicAddress(address) {
  if (isIP(address) === 4) return publicIPv4(address);
  if (isIP(address) !== 6) return false;
  const p = ipv6Words(address);
  if (!p || (p[0] & 0xe000) !== 0x2000) return false;
  if ((p[0] === 0x2001 && p[1] <= 0x01ff) || (p[0] === 0x2001 && p[1] === 0x0db8) || p[0] === 0x2002 || (p[0] === 0x3fff && p[1] < 0x1000)) return false;
  return true;
}

export function safeSourceUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048 || /[\x00-\x20\x7f\\]/u.test(raw)) throw failure('UNSAFE_URL');
  let url;
  try { url = new URL(raw); } catch { throw failure('INVALID_URL'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
    (url.port && !['80', '443'].includes(url.port))) throw failure('UNSAFE_URL');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || !hostname.includes('.') && !isIP(hostname) ||
    /(?:^|\.)(?:localhost|local|internal|intranet|test|invalid|example|onion)$/u.test(hostname) ||
    (isIP(hostname) && !isPublicAddress(hostname))) throw failure('UNSAFE_HOST');
  if (/;jsessionid=/i.test(url.pathname)) throw failure('CREDENTIAL_QUERY');
  for (const key of url.searchParams.keys()) {
    if (/^(?:code|sid|jsessionid|auth|key|apikey|accesskey)$/i.test(key) || /(?:^|[_-])(?:password|passwd|token|session|cookie|ticket|authorization|credential|secret|api[_-]?key)(?:$|[_-])/i.test(key)) throw failure('CREDENTIAL_QUERY');
  }
  url.hash = '';
  return url;
}

async function deadline(promise, ms) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(failure('ETIMEDOUT')), ms); })]); }
  finally { clearTimeout(timer); }
}

export async function resolvePublicTarget(url, lookup = dnsLookup, timeoutMs = DEFAULT_LIMITS.timeoutMs) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await deadline(lookup(hostname, { all: true, verbatim: true }), timeoutMs);
  if (!Array.isArray(addresses) || !addresses.length || addresses.some((answer) => !isPublicAddress(answer.address) || ![4, 6].includes(answer.family))) throw failure('UNSAFE_DNS');
  return addresses[0];
}

/** Requests one response only. The socket uses the already checked DNS address; it never performs a second resolution. */
export function pinnedRequest(url, target, { timeoutMs, maxBytes }, requestFactory) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request;
    let timer;
    const finish = (error, value) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const client = requestFactory ?? (url.protocol === 'https:' ? httpsRequest : httpRequest);
    request = client(url, {
      method: 'GET', agent: false, family: target.family,
      lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, [{ address: target.address, family: target.family }]);
        else callback(null, target.address, target.family);
      },
      maxHeaderSize: 16384,
      headers: { 'User-Agent': 'ZJU-Campus-Guide-Source-Review/1.0', Accept: 'text/html,text/plain;q=0.9,*/*;q=0.1', 'Accept-Encoding': 'identity' },
    }, (response) => {
      const chunks = []; let bytes = 0; let limited = false;
      response.on('data', (chunk) => {
        const available = maxBytes - bytes;
        if (available > 0) { chunks.push(chunk.subarray(0, available)); bytes += Math.min(available, chunk.length); }
        if (chunk.length > available || bytes >= maxBytes) {
          limited = true;
          finish(null, { status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8'), bytes, truncated: true });
          response.destroy(); request.destroy();
        }
      });
      response.on('end', () => finish(null, { status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8'), bytes, truncated: limited }));
      response.on('error', (error) => finish(error));
      response.on('aborted', () => { if (!limited) finish(failure('RESPONSE_ABORTED')); });
    });
    request.on('error', (error) => finish(error));
    timer = setTimeout(() => { finish(failure('ETIMEDOUT')); request.destroy(); }, timeoutMs);
    request.end();
  });
}

function loginUrl(url) { return /(?:^|[./_-])(?:login|signin|sso|cas|authserver)(?:[./_?=-]|$)/i.test(`${url.hostname}${url.pathname}`); }

export function classifyResponse(response, finalUrl, originalUrl) {
  const status = response.status;
  if ([401, 407].includes(status) || loginUrl(finalUrl)) return { status: 'login-required', evidence: `HTTP ${status}；需要身份验证，不使用用户登录态检查。` };
  if ([403, 408, 429].includes(status) || status >= 500) return { status: 'network-restricted', evidence: `HTTP ${status}；可能为权限、反爬或服务暂时异常，不能据此判定页面不存在。` };
  if ([404, 410].includes(status)) return { status: 'suspected-invalid', evidence: `HTTP ${status}；请人工确认入口是否迁移。` };
  if (status < 200 || status >= 300) return { status: 'manual-review', evidence: `HTTP ${status}；需人工检查响应。` };
  const text = String(response.body ?? '');
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1]?.replace(/<[^>]*>/g, '').slice(0, 180) ?? '';
  if (/<input\b[^>]*\btype\s*=\s*["']?password\b/i.test(text) || /统一身份认证|single sign[ -]on|CAS\s+Login/i.test(title)) return { status: 'login-required', evidence: `HTTP ${status}；页面显示登录表单或统一身份认证标题。` };
  if (/(?:^|\W)404(?:\W|$)|页面不存在|页面未找到|网页不存在|资源不存在|page not found/i.test(title) || /\/(?:404|not[-_]?found|error404)(?:[./]|$)/i.test(finalUrl.pathname)) return { status: 'suspected-invalid', evidence: `HTTP ${status}；标题或最终路径显示找不到页面，需人工确认。` };
  if (originalUrl.pathname !== '/' && finalUrl.pathname === '/' && originalUrl.origin === finalUrl.origin) return { status: 'manual-review', evidence: `HTTP ${status}；深层页面跳到同站首页，可能失去原内容。` };
  return { status: 'reachable', evidence: `HTTP ${status}；仅确认链接可连接，不能证明办理流程仍准确。${response.truncated ? '仅读取响应前部，已到大小上限。' : ''}` };
}

export async function checkLink(raw, { lookup = dnsLookup, transport = pinnedRequest, limits: inputLimits, takeRequest = () => true, takeResolution = () => true } = {}) {
  const limits = boundedLimits(inputLimits);
  let original;
  try { original = safeSourceUrl(raw); } catch { return { url: '[来源地址已隐藏：不符合安全规则]', status: 'blocked', evidence: '来源地址不符合协议、凭据或公网地址安全规则。按受影响内容 ID 检查原始配置。', attempts: 0 }; }
  let current = original; const visited = new Set(); let attempts = 0; let redirects = 0; let retries = 0;
  while (true) {
    if (visited.has(current.href)) return { url: original.href, status: 'suspected-invalid', evidence: '检测到跳转循环，需人工核查。', attempts };
    if (!takeResolution()) return { url: original.href, status: 'not-checked', evidence: '已达到本轮 DNS/目标解析上限（跳转和重试也计入）。', attempts };
    let target;
    try { target = await resolvePublicTarget(current, lookup, limits.timeoutMs); }
    catch (error) {
      return { url: original.href, status: error.code === 'UNSAFE_DNS' ? 'blocked' : 'network-restricted', evidence: error.code === 'UNSAFE_DNS' ? 'DNS包含非公网地址，未发出请求。' : 'DNS解析失败或超时；不能据此判定页面不存在。', attempts };
    }
    if (!takeRequest()) return { url: original.href, status: 'not-checked', evidence: '已达到本轮请求上限（跳转和重试也计入）。', attempts };
    attempts += 1;
    let response;
    try { response = await transport(current, target, limits); }
    catch {
      if (retries < limits.retries) { retries += 1; continue; }
      return { url: original.href, status: 'network-restricted', evidence: '连接、证书、响应中断或超时；不能据此判定页面不存在。', attempts };
    }
    if (response.status >= 500 && retries < limits.retries) { retries += 1; continue; }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects >= limits.maxRedirects) return { url: original.href, status: 'manual-review', evidence: '已达到跳转上限，需人工核查。', attempts };
      let next;
      try {
        if (typeof response.headers?.location !== 'string' || !response.headers.location.trim()) throw failure('MISSING_LOCATION');
        next = safeSourceUrl(new URL(response.headers.location, current).href);
      }
      catch { return { url: original.href, status: 'blocked', evidence: '跳转目的地缺失或不符合公网/无凭据安全规则，未继续访问。', attempts }; }
      // Even a login redirect must pass destination policy; no cookies, credentials or referrer are forwarded.
      visited.add(current.href); current = next; redirects += 1; retries = 0; continue;
    }
    return { url: original.href, finalUrl: current.href, ...classifyResponse(response, current, original), httpStatus: response.status, attempts };
  }
}

function refs(record) {
  return [...(record.references ?? []), ...(record.stepActions ?? []), record.timetable?.source,
    ...(record.routes ?? []).flatMap((route) => [...(route.references ?? []), ...(route.stepActions ?? []), route.timetable?.source])]
    .filter((item) => item && typeof item.url === 'string').map((item) => item.url);
}

export function collectConfiguredSources(data) {
  const links = new Map(); const missing = [];
  const rows = [...data.guides.map((row) => ({ ...row, recordType: 'guide', label: row.title })), ...data.websites.map((row) => ({ ...row, recordType: 'website', label: row.name })), ...data.accounts.map((row) => ({ ...row, recordType: 'account', label: row.name })), ...data.windows.map((row) => ({ ...row, recordType: 'window', label: row.name }))];
  for (const row of rows) {
    const affected = { type: row.recordType, id: row.id, title: row.label };
    const urls = row.recordType === 'website' ? [row.url] : refs(row);
    if (!urls.length) missing.push({ ...affected, evidence: row.source || row.image ? '保留有采集出处/截图，但没有可自动复查的公开网页；请人工核对原资料。' : '缺少可复查的来源链接或采集出处，请维护者补充依据。' });
    for (const raw of urls) {
      let key;
      try { key = safeSourceUrl(raw).href; } catch { key = String(raw); }
      if (!links.has(key)) links.set(key, { url: key, affected: [] });
      const item = links.get(key);
      if (!item.affected.some((other) => other.type === affected.type && other.id === affected.id)) item.affected.push(affected);
    }
  }
  return { links: [...links.values()], missing, rows };
}

function textFields(row) {
  const fields = ['title', 'name', 'label', 'summary', 'steps', 'materials', 'notes', 'troubleshooting', 'verificationScope', 'openingHours', 'notice', 'notices', 'completionNote', 'audienceNote', 'source'];
  return fields.flatMap((key) => (Array.isArray(row[key]) ? row[key] : [row[key]]).filter((value) => typeof value === 'string').map((text) => ({ field: key, text })))
    .concat((row.references ?? []).filter((item) => typeof item.label === 'string').map((item, index) => ({ field: `references.${index}.label`, text: item.label })))
    .concat((row.stepActions ?? []).filter((item) => typeof item.label === 'string').map((item, index) => ({ field: `stepActions.${index}.label`, text: item.label })))
    .concat(row.timetable ? textFields({ ...row.timetable, source: undefined }).map((entry) => ({ ...entry, field: `timetable.${entry.field}` })) : [])
    .concat(typeof row.timetable?.source?.label === 'string' ? [{ field: 'timetable.source.label', text: row.timetable.source.label }] : [])
    .concat((row.routes ?? []).flatMap((route) => textFields({ ...route, routes: undefined }).map((entry) => ({ ...entry, field: `routes.${route.id}.${entry.field}` }))));
}

export function findDateCandidates(rows, asOf) {
  const date = new Date(`${asOf}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(+date) || date.toISOString().slice(0, 10) !== asOf) throw failure('INVALID_AS_OF');
  const year = date.getUTCFullYear(); const schoolStart = date.getUTCMonth() >= 8 ? year : year - 1;
  const candidates = [];
  for (const row of rows) {
    const seen = new Set();
    const add = (kind, evidence, field) => {
      const key = `${kind}:${evidence}`;
      if (!seen.has(key)) { seen.add(key); candidates.push({ type: row.recordType, id: row.id, title: row.label, kind, field, evidence, conclusion: '仅为可能过期的候选，不自动修改正文或核实标记。' }); }
    };
    for (const { field, text } of textFields(row)) {
      for (const match of text.matchAll(/(20\d{2})\s*年?\s*[-—–至/]\s*(20\d{2})\s*年?\s*学年/g)) {
        if (+match[1] < schoolStart) add('academic-year', `${match[0]}；检查日 ${asOf} 已处于更新学年，需确认是否仍适用。`, field);
      }
      for (const match of text.matchAll(/(20\d{2})年(?:\d{1,2}月)?[^。；\n]{0,14}?(?:修订|修正|编印|发布|版)|(?:修订|修正|编印|发布)[^。；\n]{0,12}?(20\d{2})年/g)) {
        if (+(match[1] ?? match[2]) < year) add('dated-edition', `${match[0]}；旧修订/发布版本，需确认有无新版；历史版本不自动等于失效。`, field);
      }
      for (const match of text.matchAll(/(20\d{2})年?度|(?:关于|通知|报名|申请|申报|招生)[^。；\n]{0,25}?(20\d{2})年/g)) {
        if (+(match[1] ?? match[2]) < year) add('annual-notice', `${match[0]}；早于检查年 ${year}，需确认是否有新版。`, field);
      }
      for (const match of text.matchAll(/(20\d{2})(?:年|[-/.])(\d{1,2})(?:月|[-/.])(\d{1,2})日?/g)) {
        const nearby = text.slice(Math.max(0, match.index - 28), match.index + match[0].length + 28);
        if (!/截止|截至|有效期|(?:报名|申请|申报|受理|结束|开放|办理)(?:时间|期限|日期|于)/.test(nearby)) continue;
        const value = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        const parsed = new Date(`${value}T00:00:00Z`);
        if (!Number.isNaN(+parsed) && parsed.toISOString().slice(0, 10) === value && value < asOf) add('past-date', `${nearby.slice(0, 110)}（日期 ${value} 早于检查日 ${asOf}）`, field);
      }
      if (/(?:截止|截至)[^。；\n]{0,12}\d{1,2}月\d{1,2}日|\d{1,2}月\d{1,2}日[^。；\n]{0,12}(?:截止|截至)/.test(text) && !/20\d{2}年/.test(text)) add('undated-deadline', text.slice(0, 110) + '；截止日期未标明年份，需人工确认。', field);
    }
    for (const raw of row.recordType === 'website' ? [row.url] : refs(row)) {
      const match = /\/(20\d{2})(?:\d{2})?(?:\d{2})?[/-]/.exec(raw);
      if (match && +match[1] < year) {
        let display;
        try { display = safeSourceUrl(raw).href; } catch { display = '[来源地址已隐藏：不符合安全规则]'; }
        add('dated-source-url', `来源路径含 ${match[1]} 年：${display}；历史来源不等于当前流程已失效。`, 'references');
      }
    }
  }
  return candidates;
}

const normalized = (value) => String(value ?? '').replace(/[\s，,、；;。()（）\-–—]/g, '').toLowerCase();
const phones = (value) => [...String(value ?? '').matchAll(/(?:0\d{2,3}[-\s]?)?\d{7,8}/g)].map((match) => match[0].replace(/\D/g, '')).sort();

export function findConflicts(data) {
  const candidates = []; const groups = new Map(); const compared = new Set();
  const windowMap = new Map(data.windows.map((row) => [row.id, row]));
  const values = (row) => ({ location: row.location, openingHours: row.openingHours, phone: row.contacts?.map((contact) => contact.number).join(' / ') ?? row.contact });
  const compare = (left, right, affected, basis) => {
    for (const key of ['location', 'openingHours', 'phone']) {
      if (!left[key] || !right[key]) continue;
      if (key === 'phone') {
        const a = phones(left[key]); const b = phones(right[key]);
        if (!a.length || !b.length || a.some((phone) => b.includes(phone))) continue;
      } else if (normalized(left[key]) === normalized(right[key])) continue;
      const comparisonId = `${key}:${affected.map((row) => `${row.type}:${row.id}`).sort().join('|')}`;
      if (compared.has(comparisonId)) continue;
      compared.add(comparisonId);
      candidates.push({ kind: 'possible-conflict', field: key, affected, evidence: `${basis}；记录A：${left[key]}；记录B：${right[key]}`, conclusion: '文本差异只作为疑似冲突，可能是不同窗口、同义表述或历史安排；须人工确认。' });
    }
  };
  for (const row of data.windows) {
    const campus = normalized(row.campus);
    const identities = [{ key: `${campus}:name:${normalized(row.name)}`, basis: '同校区、同名服务窗口存在多条记录' }];
    if (row.location) identities.push({ key: `${campus}:location:${normalized(row.location)}`, basis: '同校区的服务窗口填写相同地点，但其他字段不同' });
    for (const phone of phones(values(row).phone)) identities.push({ key: `${campus}:phone:${phone}`, basis: '同校区的服务窗口共用电话号码，但地点或时段不同；也可能是共用热线' });
    for (const { key, basis } of identities) {
      if (!groups.has(key)) groups.set(key, []);
      for (const other of groups.get(key)) compare(values(other), values(row), [{ type: 'window', id: other.id }, { type: 'window', id: row.id }], basis);
      groups.get(key).push(row);
    }
  }
  for (const row of data.guides) {
    const variants = [{ ...row, variantId: row.id }, ...(row.routes ?? []).map((route) => ({ ...route, variantId: `${row.id}#${route.id}` }))];
    for (const variant of variants) {
      const ids = variant.serviceWindowIds ?? [];
      for (const id of ids) {
        if (!windowMap.has(id)) candidates.push({ kind: 'missing-window', affected: [{ type: 'guide', id: row.id }, { type: 'window', id }], evidence: `指南/路线 ${variant.variantId} 引用的共享窗口 ${id} 不存在。`, conclusion: '检查引用是否已更名或删除。' });
      }
      if (ids.length !== 1) continue; // Different campus windows legitimately have different details.
      const window = windowMap.get(ids[0]);
      if (!window) continue;
      compare(values(variant), values(window), [{ type: 'guide', id: row.id }, { type: 'window', id: window.id }], `指南/路线 ${variant.variantId} 与其唯一共享服务窗口的直接字段不同`);
    }
  }
  return candidates;
}

export async function runSourceHealth(data, { offline = false, offset = 0, asOf = new Date().toISOString().slice(0, 10), limits: inputLimits, lookup, transport } = {}) {
  const limits = boundedLimits(inputLimits); const collected = collectConfiguredSources(data);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > collected.links.length) throw failure('INVALID_OFFSET');
  const dateCandidates = findDateCandidates(collected.rows, asOf); const conflicts = findConflicts(data);
  let requests = 0; let resolutions = 0; let index = 0; const links = Array(collected.links.length);
  const takeRequest = () => { if (requests >= limits.maxRequests) return false; requests += 1; return true; };
  const takeResolution = () => { if (resolutions >= limits.maxRequests) return false; resolutions += 1; return true; };
  const worker = async () => {
    while (index < collected.links.length) {
      const slot = index++; const item = collected.links[slot];
      let safeOfflineUrl;
      try { safeOfflineUrl = safeSourceUrl(item.url).href; } catch { safeOfflineUrl = '[来源地址已隐藏：不符合安全规则]'; }
      const result = slot < offset || offline || requests >= limits.maxRequests || resolutions >= limits.maxRequests
        ? { url: safeOfflineUrl, status: safeOfflineUrl.startsWith('[') ? 'blocked' : 'not-checked', evidence: safeOfflineUrl.startsWith('[') ? '配置地址不符合安全规则，按受影响内容 ID 检查原始配置。' : slot < offset ? '位于本轮来源起点之前；本次未请求。' : offline ? '离线模式：未发出网络请求。' : '已达到本轮请求或 DNS/目标解析上限（跳转和重试也计入）。', attempts: 0 }
        : await checkLink(item.url, { limits, lookup, transport, takeRequest, takeResolution });
      links[slot] = { ...result, affected: item.affected };
    }
  };
  await Promise.all(Array.from({ length: limits.concurrency }, worker));
  const nextIndex = links.findIndex((item, index) => index >= offset && item.status === 'not-checked');
  return { schemaVersion: 1, checkedAt: new Date().toISOString(), asOf, mode: offline ? 'offline' : 'bounded-network', startIndex: offset, nextOffset: offline || nextIndex < 0 ? null : nextIndex, limits, requests, resolutions,
    boundary: '只检查仓库配置来源。链接可访问不等于流程有效；年度/冲突规则读取仓库文本与来源路径，不做官方网页语义核验；所有提示均待人工确认，不修改业务内容或 verifiedAt。无登录态、Cookie、凭据或访客 URL 输入。',
    summary: { records: collected.rows.length, uniqueLinks: links.length, statuses: Object.fromEntries(Object.keys(STATUS_LABELS).map((status) => [status, links.filter((link) => link.status === status).length])), dateCandidates: dateCandidates.length, conflictCandidates: conflicts.length, missingSources: collected.missing.length },
    links, dateCandidates, conflicts, missingSources: collected.missing };
}

function escapeMarkdown(value) { return String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/[|\\<>`]/g, (character) => `\\${character}`); }
function affectedText(affected) { return affected.map((item) => `${item.type}:${item.id}${item.title ? `（${item.title}）` : ''}`).join('；'); }

export function renderMarkdown(report) {
  const lines = ['# 校园资料待核查清单', '', `检查日：${report.asOf}；模式：${report.mode}；实际 HTTP 请求 ${report.requests}/${report.limits.maxRequests}，DNS/目标解析 ${report.resolutions}/${report.limits.maxRequests}（各自上限均含重试和跳转）。`, '', `本轮从去重来源索引 ${report.startIndex ?? 0} 开始。${report.nextOffset != null ? `仍有未请求来源，下一批可加 --offset=${report.nextOffset}；先审阅本批报告，再运行下一批。` : report.mode === 'offline' ? '离线模式未做网络检查。' : '本轮范围内来源已处理，仍需按分类人工核查。'}`, '', report.boundary, '', '## 摘要', '', `记录 ${report.summary.records} 条；去重来源 ${report.summary.uniqueLinks} 个；日期候选 ${report.summary.dateCandidates} 条；冲突候选 ${report.summary.conflictCandidates} 条；缺少在线核查依据 ${report.summary.missingSources} 条。`, '', ...Object.entries(report.summary.statuses).map(([status, count]) => `- ${STATUS_LABELS[status]}：${count}`), '', '## 链接检查', '', '| 状态 | 来源 | 受影响内容 | 依据 |', '| --- | --- | --- | --- |'];
  const priority = { blocked: 0, 'suspected-invalid': 1, 'manual-review': 2, 'network-restricted': 3, 'login-required': 4, reachable: 5, 'not-checked': 6 };
  for (const item of [...report.links].sort((a, b) => priority[a.status] - priority[b.status])) lines.push(`| ${STATUS_LABELS[item.status]} | ${escapeMarkdown(item.url)}${item.finalUrl && item.finalUrl !== item.url ? ` → ${escapeMarkdown(item.finalUrl)}` : ''} | ${escapeMarkdown(affectedText(item.affected))} | ${escapeMarkdown(item.evidence)} |`);
  lines.push('', '## 年度、学年与截止日期候选', '');
  for (const item of report.dateCandidates) lines.push(`- ${escapeMarkdown(`${item.type}:${item.id}（${item.title}） / ${item.field}：${item.evidence}`)}`);
  if (!report.dateCandidates.length) lines.push('本轮未发现规则匹配候选；不代表所有内容仍有效。');
  lines.push('', '## 共享窗口疑似冲突', '');
  for (const item of report.conflicts) lines.push(`- ${escapeMarkdown(affectedText(item.affected))}：${escapeMarkdown(item.evidence)} ${item.conclusion}`);
  if (!report.conflicts.length) lines.push('本轮未发现可比较字段的差异；未做语义等价判断或现场核实。');
  lines.push('', '## 缺少可自动复查的依据', '');
  for (const item of report.missingSources) lines.push(`- ${escapeMarkdown(`${item.type}:${item.id}（${item.title}）`)}：${item.evidence}`);
  lines.push('', '## 人工处理与重复运行', '', '先逐项核对疑似失效和安全阻止项，再检查网络/反爬限制、年度候选、冲突及缺少依据的记录。需要学校登录时，由维护者在自己的浏览器查看，工具不接收会话。更新来源前保留原始采集证据与变更依据，不因 HTTP 200 添加“已核实”。', '', '重复运行覆盖本目录固定的 source-health.json 与 source-health.md。离线：npm run check:sources -- --offline；受限联网：npm run check:sources -- --max-requests=40。本报告不自动创建 issue、修改卡片或定时访问。', '');
  return lines.join('\n');
}
