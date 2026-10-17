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
    authChanged() { for (const listener of listeners) listener() },
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
