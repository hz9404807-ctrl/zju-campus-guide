/** A bounded request deadline using APIs available in older WebViews too. */
export function createTimeoutFetch(timeoutMs = 12000, fetchImpl: typeof fetch = globalThis.fetch): typeof fetch {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('A positive request deadline is required')
  return async (input, init) => {
    const parent = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined)
    if (parent?.aborted) throw parent.reason ?? new DOMException('Request cancelled', 'AbortError')
    const controller = new AbortController()
    const cancel = () => { controller.abort(parent?.reason); cleanup() }
    const timer = setTimeout(() => {
      controller.abort(new DOMException('Request deadline exceeded', 'TimeoutError'))
      cleanup()
    }, timeoutMs)
    // Node test/maintenance callers need not keep a process open for an already-read response.
    const timerHandle: unknown = timer
    if (typeof timerHandle === 'object' && timerHandle !== null && 'unref' in timerHandle && typeof timerHandle.unref === 'function') timerHandle.unref()
    function cleanup() { clearTimeout(timer); parent?.removeEventListener('abort', cancel) }
    parent?.addEventListener('abort', cancel, { once: true })
    try {
      const response = await fetchImpl(input, { ...init, signal: controller.signal })
      // Keep the deadline after headers so a stalled JSON body can still be cancelled.
      // Listeners are bounded by this same deadline; no response wrapping changes URL/headers.
      if (!response.body) cleanup()
      return response
    } catch (error) { cleanup(); throw error }
  }
}
