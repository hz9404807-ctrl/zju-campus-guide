import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { safeFoodReturn } from '../src/lib/foodAuth.ts'

// Exercise the real hook with controlled promises, including the interval before effect cleanup.
const hookUrl = new URL('../src/hooks/useFoodAuth.ts', import.meta.url).href
const fixtureKey = Symbol.for('campus-guide.food-auth-hook-test')
const reactUrl = 'food-auth-fixture:react'
const serviceUrl = 'food-auth-fixture:service'
const loader = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === hookUrl && specifier === 'react') return { url: reactUrl, shortCircuit: true }
    if (context.parentURL === hookUrl && specifier === '../lib/foodService') return { url: serviceUrl, shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    const getFixture = "globalThis[Symbol.for('campus-guide.food-auth-hook-test')]"
    if (url === reactUrl) return { format: 'module', shortCircuit: true, source: `
      export const createContext = (value) => ({ value });
      export const useContext = (context) => context.value;
      ${['useState', 'useEffect', 'useCallback', 'useRef'].map((name) => `export const ${name} = (...args) => ${getFixture}.${name}(...args);`).join('\n')}
    ` }
    if (url === serviceUrl) return { format: 'module', shortCircuit: true, source: `
      export const currentFoodUser = () => ${getFixture}.currentFoodUser();
      export const watchFoodUser = (callback) => ${getFixture}.watchFoodUser(callback);
    ` }
    return next(url, context)
  },
})
const { useFoodAuthState } = await import(hookUrl)
loader.deregister()

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function createHookFixture() {
  const slots = [], effects = new Map(), requests = [], listeners = new Set()
  let cursor = 0
  const sameDeps = (left, right) => !!left && left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
  const fixture = {
    requests,
    useState(initial) {
      const slot = cursor++
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial
      return [slots[slot], (next) => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next }]
    },
    useRef(value) { const slot = cursor++; return slots[slot] ??= { current: value } },
    useCallback(callback, deps) {
      const slot = cursor++
      if (!sameDeps(slots[slot]?.deps, deps)) slots[slot] = { deps, callback }
      return slots[slot].callback
    },
    useEffect(effect, deps) {
      const slot = cursor++
      if (!sameDeps(slots[slot]?.deps, deps)) effects.set(slot, { effect, deps })
    },
    currentFoodUser() { const request = deferred(); requests.push(request); return request.promise },
    watchFoodUser(callback) { listeners.add(callback); return () => listeners.delete(callback) },
    render() { globalThis[fixtureKey] = fixture; cursor = 0; return useFoodAuthState() },
    flushEffects() {
      for (const [slot, { effect, deps }] of effects) {
        slots[slot]?.cleanup?.()
        slots[slot] = { deps, cleanup: effect() }
      }
      effects.clear()
    },
    authChanged(event, userId) { for (const listener of listeners) listener(event, userId) },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
  fixture.render(); fixture.flushEffects()
  return fixture
}
const member = (id) => ({ id, email: `${id}@zju.edu.cn`, verifiedCampus: true, anonymous: false })
const settle = () => new Promise((resolve) => setImmediate(resolve))

test('个人中心返回地址保留查询和锚点，美食原路径继续可用', () => {
  for (const address of ['/account', '/account?section=ratings#mine', '/food/mine?status=withdrawn#item', '/food/a/edit?from=mine']) {
    assert.equal(safeFoodReturn(address), address)
  }
  for (const address of ['/account-other', '/account/settings', '/account/../about', '/food/login?returnTo=/account', '//outside.invalid/account', '/\\outside.invalid/account', 'https://outside.invalid/account']) {
    assert.equal(safeFoodReturn(address), '/food')
  }
})

test('切换账号事件立即失效旧请求，即使旧请求在effect清理前返回', async () => {
  const fixture = createHookFixture()
  fixture.authChanged()
  fixture.requests[0].resolve(member('old-owner'))
  await settle()
  let state = fixture.render()
  assert.equal(state.user, null); assert.equal(state.loading, true)
  fixture.flushEffects()
  fixture.requests[1].resolve(member('current-owner'))
  await settle()
  state = fixture.render()
  assert.equal(state.user.id, 'current-owner'); assert.equal(state.loading, false)
  fixture.unmount()
})

test('退出事件清理邮箱，旧账号结果不能把已退出界面重新登录', async () => {
  const fixture = createHookFixture()
  fixture.requests[0].resolve(member('first-owner'))
  await settle()
  assert.equal(fixture.render().user.id, 'first-owner')
  fixture.authChanged(); fixture.render(); fixture.flushEffects()
  fixture.authChanged()
  fixture.requests[1].resolve(member('first-owner'))
  await settle()
  assert.equal(fixture.render().user, null)
  fixture.flushEffects()
  fixture.requests[2].resolve(null)
  await settle()
  const state = fixture.render()
  assert.equal(state.user, null); assert.equal(state.loading, false); assert.equal(state.error, '')
  fixture.unmount()
})

test('过时失败不会覆盖当前加载状态；当前失败允许重试且卸载后不接收结果', async () => {
  const fixture = createHookFixture()
  fixture.authChanged()
  fixture.requests[0].reject(new Error('old-account failure'))
  await settle()
  assert.equal(fixture.render().error, '')
  fixture.flushEffects()
  fixture.requests[1].reject(new Error('network unavailable'))
  await settle()
  const failed = fixture.render()
  assert.equal(failed.error, 'network unavailable'); assert.equal(failed.loading, false)
  failed.retry(); fixture.render(); fixture.flushEffects()
  assert.equal(fixture.render().error, '')
  fixture.unmount()
  fixture.requests[2].resolve(member('late-owner'))
  await settle()
  assert.equal(fixture.render().user, null)
})

test('同一已验证账号刷新或重复登录保留当前身份，并继续向服务端复核', async () => {
  for (const event of ['TOKEN_REFRESHED', 'SIGNED_IN']) {
    const fixture = createHookFixture()
    const confirmedUser = member('same-owner')
    fixture.requests[0].resolve(confirmedUser)
    await settle()
    fixture.render()
    fixture.authChanged(event, confirmedUser.id)
    let state = fixture.render()
    assert.equal(state.user, confirmedUser); assert.equal(state.loading, false); assert.equal(state.error, '')
    fixture.flushEffects()
    assert.equal(fixture.requests.length, 2, 'keeping the form never skips server verification')
    fixture.requests[1].resolve({ ...confirmedUser, email: 'server-confirmed@zju.edu.cn' })
    await settle()
    state = fixture.render()
    assert.equal(state.user.email, 'server-confirmed@zju.edu.cn'); assert.equal(state.loading, false)
    fixture.unmount()
  }
})

test('同账号后台复核失败或不再验证时清空身份，不使用事件内容继续授权', async () => {
  for (const outcome of ['error', 'signed-out', 'unverified']) {
    const fixture = createHookFixture()
    fixture.requests[0].resolve(member('owner'))
    await settle(); fixture.render()
    fixture.authChanged('TOKEN_REFRESHED', 'owner')
    fixture.render(); fixture.flushEffects()
    if (outcome === 'error') fixture.requests[1].reject(new Error('server verification failed'))
    else fixture.requests[1].resolve(outcome === 'signed-out' ? null : { ...member('owner'), verifiedCampus: false })
    await settle()
    const state = fixture.render()
    assert.equal(Boolean(state.user?.verifiedCampus), false); assert.equal(state.loading, false)
    if (outcome === 'error') { assert.equal(state.user, null); assert.equal(state.error, 'server verification failed') }
    fixture.unmount()
  }
})

test('不同账号、登出、未知事件及手动重试立即清空，不沿用同账号刷新例外', async () => {
  for (const change of [
    (fixture) => fixture.authChanged('SIGNED_IN', 'other-owner'),
    (fixture) => fixture.authChanged('TOKEN_REFRESHED', 'other-owner'),
    (fixture) => fixture.authChanged('SIGNED_OUT', 'owner'),
    (fixture) => fixture.authChanged('USER_UPDATED', 'owner'),
    (fixture) => fixture.authChanged('INITIAL_SESSION', 'owner'),
    (fixture) => fixture.authChanged('SIGNED_IN', null),
    (fixture) => fixture.render().retry(),
  ]) {
    const fixture = createHookFixture()
    fixture.requests[0].resolve(member('owner'))
    await settle(); fixture.render()
    change(fixture)
    const state = fixture.render()
    assert.equal(state.user, null); assert.equal(state.loading, true)
    fixture.unmount()
  }
})

test('事件中的同一ID不能把匿名或未确认账号提升为已验证身份', async () => {
  for (const initialUser of [null, { ...member('owner'), anonymous: true, verifiedCampus: false }]) {
    const fixture = createHookFixture()
    fixture.requests[0].resolve(initialUser)
    await settle(); fixture.render()
    fixture.authChanged('SIGNED_IN', 'owner')
    const state = fixture.render()
    assert.equal(state.user, null); assert.equal(state.loading, true)
    fixture.unmount()
  }
})

test('后台旧成功和失败不能覆盖其后的登出或换账号，effect清理前也失效', async () => {
  for (const staleOutcome of ['success', 'failure']) {
    const fixture = createHookFixture()
    fixture.requests[0].resolve(member('old-owner'))
    await settle(); fixture.render()
    fixture.authChanged('TOKEN_REFRESHED', 'old-owner')
    fixture.render(); fixture.flushEffects()
    fixture.authChanged(staleOutcome === 'success' ? 'SIGNED_OUT' : 'SIGNED_IN', staleOutcome === 'success' ? null : 'new-owner')
    if (staleOutcome === 'success') fixture.requests[1].resolve(member('old-owner'))
    else fixture.requests[1].reject(new Error('outdated background failure'))
    await settle()
    let state = fixture.render()
    assert.equal(state.user, null); assert.equal(state.loading, true); assert.equal(state.error, '')
    fixture.flushEffects()
    fixture.requests[2].resolve(staleOutcome === 'success' ? null : member('new-owner'))
    await settle()
    state = fixture.render()
    assert.equal(state.user?.id ?? null, staleOutcome === 'success' ? null : 'new-owner')
    fixture.unmount()
  }
})

test('新同账号后台请求取代旧请求，旧失败不能清空已保留的身份', async () => {
  const fixture = createHookFixture()
  fixture.requests[0].resolve(member('owner'))
  await settle(); fixture.render()
  fixture.authChanged('TOKEN_REFRESHED', 'owner')
  fixture.render(); fixture.flushEffects()
  fixture.authChanged('SIGNED_IN', 'owner')
  fixture.requests[1].reject(new Error('stale background error'))
  await settle()
  let state = fixture.render()
  assert.equal(state.user.id, 'owner'); assert.equal(state.loading, false); assert.equal(state.error, '')
  fixture.flushEffects()
  fixture.requests[2].resolve(member('owner'))
  await settle()
  state = fixture.render()
  assert.equal(state.user.id, 'owner'); assert.equal(state.error, '')
  fixture.unmount()
})
