import test from 'node:test'
import assert from 'node:assert/strict'
import { createTimeoutFetch } from '../src/lib/timeoutFetch.ts'

test('works without AbortSignal.any/timeout and preserves request options and the original response', async (t) => {
  const any = Object.getOwnPropertyDescriptor(AbortSignal, 'any')
  const timeout = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')
  Object.defineProperty(AbortSignal, 'any', { configurable: true, value: undefined })
  Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: undefined })
  t.after(() => { Object.defineProperty(AbortSignal, 'any', any); Object.defineProperty(AbortSignal, 'timeout', timeout) })
  const parent = new AbortController()
  const response = new Response('ok', { status: 201, headers: { 'x-request': 'retained' } })
  const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', credentials: 'omit', signal: parent.signal }
  let actual
  const request = createTimeoutFetch(12000, async (input, init) => { actual = { input, init }; return response })
  assert.equal(await request('https://fixture.invalid/', options), response)
  assert.equal(actual.input, 'https://fixture.invalid/')
  assert.deepEqual({ ...actual.init, signal: parent.signal }, options)
  assert.equal(actual.init.signal.aborted, false)
  parent.abort()
  assert.equal(actual.init.signal.aborted, true)
})

test('an already cancelled caller sends nothing; cancellation during a request propagates', async () => {
  const cancelled = new AbortController(); cancelled.abort()
  let calls = 0
  const request = createTimeoutFetch(12000, async (_input, init) => {
    calls++
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }))
  })
  await assert.rejects(request('https://fixture.invalid/', { signal: cancelled.signal }), { name: 'AbortError' })
  assert.equal(calls, 0)
  const live = new AbortController()
  const pending = request('https://fixture.invalid/', { signal: live.signal })
  live.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(calls, 1)
})

test('timeout cancels both a pending request and a response body stalled after headers', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pendingFetch = createTimeoutFetch(12000, async (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
  }))
  const pending = pendingFetch('https://fixture.invalid/')
  const rejected = assert.rejects(pending, { name: 'TimeoutError' })
  t.mock.timers.tick(12000)
  await rejected
  const bodyFetch = createTimeoutFetch(12000, async (_input, init) => new Response(new ReadableStream({
    start(controller) { init.signal.addEventListener('abort', () => controller.error(init.signal.reason), { once: true }) },
  })))
  const response = await bodyFetch('https://fixture.invalid/')
  const read = assert.rejects(response.text(), { name: 'TimeoutError' })
  t.mock.timers.tick(12000)
  await read
})

test('caller signal on a Request is retained, immediate failures stay failures, invalid deadlines are rejected', async () => {
  const parent = new AbortController()
  const input = new Request('https://fixture.invalid/', { signal: parent.signal })
  let signal
  await createTimeoutFetch(12000, async (_input, init) => { signal = init.signal; return new Response('body') })(input)
  parent.abort()
  assert.equal(signal.aborted, true)
  const failure = new Error('offline')
  await assert.rejects(createTimeoutFetch(12000, async () => { throw failure })('https://fixture.invalid/'), error => error === failure)
  for (const deadline of [0, -1, Infinity, NaN]) assert.throws(() => createTimeoutFetch(deadline), RangeError)
})
