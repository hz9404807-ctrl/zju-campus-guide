// Optional browser regression: playwright-cli -s=personal-center run-code --filename=tests/browser/personal-center.js
// Start Vite on 127.0.0.1:5176 with the documented isolated fixture configuration first.
// All Supabase requests are intercepted. This proves UI behaviour, never real cloud persistence.
async (page) => {
  const base = 'http://127.0.0.1:5176'
  const service = 'https://personal-center-test.invalid'
  await page.context().unroute(service + '/**')
  const storageKey = 'sb-personal-center-test-auth-token'
  const ids = { a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222', guest: '33333333-3333-4333-8333-333333333333' }
  const foodA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const foodB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const hiddenFood = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const now = Math.floor(Date.now() / 1000)
  const tokens = await page.evaluate(({ ids, now }) => {
    const part = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    return Object.fromEntries(Object.entries(ids).map(([key, sub]) => [key, `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub, aud: 'authenticated', role: 'authenticated', exp: now + 3600 })}.fixture`]))
  }, { ids, now })
  function user(who) {
    return { id: ids[who], aud: 'authenticated', role: 'authenticated', email: who === 'guest' ? '' : `browser-${who}@zju.edu.cn`, is_anonymous: who === 'guest', email_confirmed_at: who === 'guest' ? undefined : '2026-10-17T00:00:00Z', app_metadata: { provider: who === 'guest' ? 'anonymous' : 'email', providers: [who === 'guest' ? 'anonymous' : 'email'] }, user_metadata: {}, created_at: '2026-10-17T00:00:00Z' }
  }
  function session(who) {
    return { access_token: tokens[who], refresh_token: 'fixture-refresh-' + who, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: user(who) }
  }
  function whoFor(request) {
    const token = request.headers().authorization?.slice(7) ?? ''
    return Object.keys(ids).find((who) => token === session(who).access_token) ?? 'guest'
  }
  const rows = [
    { id: foodA, name: 'A的测试菜品', created_by: ids.a, deleted_at: null },
    { id: foodB, name: 'B的测试菜品', created_by: ids.b, deleted_at: null },
    { id: hiddenFood, name: 'A已撤下的测试菜品', created_by: ids.a, deleted_at: '2026-10-17T00:00:00Z' },
  ].map((row) => ({ location: '测试食堂', area: 'campus', category: '饭类', price: 12, description: '仅浏览器测试', tags: [], image_url: null, average_rating: 4, rating_count: 1, updated_at: '2026-10-17T00:00:00Z', created_at: '2026-10-17T00:00:00Z', ...row }))
  const checks = []
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  let ratingsMode = 'normal'
  let postsMode = 'normal'
  let authFailure = false
  let logoutFailure = false
  let delayRatings = false
  let delayedRelease
  let delayedStarted
  let delayedStartedPromise
  const setDelay = () => {
    delayRatings = true
    delayedStartedPromise = new Promise((resolve) => { delayedStarted = resolve })
  }
  await page.context().route(service + '/**', async (route) => {
    const request = route.request()
    const relative = request.url().slice(service.length)
    const query = Object.fromEntries((relative.split('?')[1] ?? '').split('&').filter(Boolean).map((field) => field.split('=').map(decodeURIComponent)))
    const url = { pathname: relative.split('?')[0], searchParams: { has: (key) => key in query, get: (key) => query[key] ?? null } }
    const who = whoFor(request)
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (url.pathname === '/auth/v1/user') return authFailure ? reply({ message: 'fixture offline' }, 503) : reply(user(who))
    if (url.pathname === '/auth/v1/signup') return reply(session('guest'))
    if (url.pathname === '/auth/v1/otp') return reply({})
    if (url.pathname === '/auth/v1/verify') return reply(session('a'))
    if (url.pathname === '/auth/v1/logout') return logoutFailure ? reply({ message: 'fixture logout error' }, 500) : route.fulfill({ status: 204 })
    if (url.pathname === '/rest/v1/food_summaries') {
      if (url.searchParams.has('created_by') && postsMode === 'failure') return reply({ message: 'fixture query error' }, 503)
      const owner = url.searchParams.get('created_by')?.replace('eq.', '')
      const id = url.searchParams.get('id')?.replace('eq.', '')
      const found = rows.filter((row) => (!owner || row.created_by === owner) && (!id || row.id === id) && (owner || !row.deleted_at))
      return reply(postsMode === 'empty' && owner ? [] : id ? found[0] ?? null : found)
    }
    if (url.pathname === '/rest/v1/ratings') return reply(null)
    if (url.pathname === '/rest/v1/rpc/get_my_campus_details') return reply([])
    if (url.pathname === '/rest/v1/rpc/list_my_food_ratings') {
      if (delayRatings) { delayRatings = false; delayedStarted(); await new Promise((resolve) => { delayedRelease = resolve }) }
      if (ratingsMode === 'missing') return reply({ code: 'PGRST202', message: 'fixture RPC missing' }, 404)
      if (ratingsMode === 'failure') return reply({ message: 'fixture query error' }, 503)
      if (ratingsMode === 'empty') return reply([])
      return reply(rows.filter((row) => row.created_by === ids[who]).map((row) => ({ food_id: row.id, rating: who === 'b' ? 2 : 4, created_at: row.created_at, food_name: row.deleted_at ? null : row.name, food_location: row.deleted_at ? null : row.location, food_image_url: null })))
    }
    if (url.pathname === '/rest/v1/rpc/set_own_food_deleted') {
      const input = request.postDataJSON()
      const row = rows.find((row) => row.id === input.p_food_id && row.created_by === ids[who])
      if (!row) return reply({ code: '42501' }, 403)
      row.deleted_at = input.p_deleted ? '2026-10-17T01:00:00Z' : null
      row.updated_at = '2026-10-17T01:00:00Z'
      return reply(row.id)
    }
    return reply({ message: 'Unexpected fixture endpoint: ' + url.pathname }, 400)
  })
  const assert = (ok, message) => { if (!ok) throw new Error(message); checks.push(message) }
  const hasText = async (text) => (await page.locator('main').innerText()).includes(text)
  const visible = (text) => page.getByText(text, { exact: true }).waitFor({ state: 'visible' })
  async function screenshot(path) {
    await page.locator('main').focus()
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  }
  async function useSession(who, path = '/account') {
    // A static same-origin document avoids an old app's anonymous bootstrap racing
    // the next fixture identity. No real account or application auth store is added.
    await page.goto(base + '/src/data/foods.example.json')
    await page.evaluate(({ key, value }) => value ? localStorage.setItem(key, JSON.stringify(value)) : localStorage.removeItem(key), { key: storageKey, value: who ? session(who) : null })
    await page.goto(base + path)
  }
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await useSession(null, '/account?source=browser#my-ratings')
    await visible('登录后查看你的内容')
    assert(!await hasText('browser-a@zju.edu.cn'), 'guest cannot see email or personal records')
    await page.getByRole('link', { name: '使用浙大邮箱登录' }).click()
    assert(decodeURIComponent(page.url().split('returnTo=')[1]) === '/account?source=browser#my-ratings', 'login return retains path query and hash')
    await page.getByLabel('已有邮箱账号登录').check()
    await page.getByLabel('浙大邮箱', { exact: true }).fill('browser-a@zju.edu.cn')
    await page.getByRole('button', { name: '发送验证码', exact: true }).click()
    await page.getByLabel('邮件验证码').fill('123456')
    await page.getByRole('button', { name: '验证并登录' }).click()
    await visible('账号概览')
    assert(page.url().endsWith('/account?source=browser#my-ratings'), 'verified login returns to intended page')
    assert(await hasText('browser-a@zju.edu.cn') && !await hasText('browser-b@zju.edu.cn'), 'account A sees only its email')
    assert(await page.locator('.account-record-entry').count() === 2 && await page.locator('.account-post,.account-rating').count() === 0, 'personal center offers separate record pages without expanded lists')
    await screenshot('scratch/personal-center-desktop.png')
    await page.reload()
    await visible('browser-a@zju.edu.cn')
    assert(await hasText('账号概览'), 'refresh restores verified session')
    await page.locator('.account-record-links').getByRole('link', { name: /我的发布/ }).click()
    const post = page.locator('#my-posts article').filter({ has: page.getByRole('heading', { name: 'A的测试菜品', exact: true }) })
    await post.waitFor()
    assert(!await hasText('B的测试菜品'), 'account A has no B posts')
    await post.getByRole('button', { name: '撤下', exact: true }).click()
    await post.getByRole('button', { name: '确认撤下', exact: true }).click()
    await post.getByText('已撤下', { exact: true }).waitFor()
    await page.locator('.account-section-nav').getByRole('link', { name: '我的评分', exact: true }).click()
    await page.locator('#my-ratings article').first().waitFor()
    assert(await page.locator('#my-ratings').getByRole('link', { name: '查看美食详情' }).count() === 0, 'withdrawn ratings retain score history without details or image')
    await page.locator('.account-section-nav').getByRole('link', { name: '我的发布', exact: true }).click()
    await post.getByRole('button', { name: '恢复发布', exact: true }).click()
    await post.getByText('已发布', { exact: true }).waitFor()
    assert(true, 'existing withdraw and restore RPC flow works from posts subpage')
    assert((await post.getByRole('link', { name: '编辑', exact: true }).getAttribute('href')).startsWith(`/food/${foodA}/edit?returnTo=`), 'edit reuses existing author editor and retains personal return')
    await page.locator('.account-section-nav').getByRole('link', { name: '我的评分', exact: true }).click()
    await visible('原菜品已撤下或不再可见')
    assert(await page.locator('#my-ratings').getByRole('link', { name: '查看美食详情' }).count() === 1, 'restored food becomes available on newly loaded ratings page')
    await page.locator('#my-ratings').getByRole('link', { name: '查看美食详情' }).click()
    await page.getByRole('heading', { name: 'A的测试菜品', exact: true, level: 1 }).waitFor()
    await page.getByRole('link', { name: '返回我的评分', exact: true }).click()
    await page.locator('#my-ratings article').first().waitFor()
    assert(true, 'rating opens corresponding food detail and returns to ratings subpage')
    for (const width of [1440, 1024, 901, 780, 390, 320]) {
      await page.setViewportSize({ width, height: 950 })
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no horizontal overflow at ${width}px`)
    }
    await screenshot('scratch/personal-center-mobile.png')
    logoutFailure = true
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: '退出失败' }).waitFor()
    assert(!await hasText('已成功退出'), 'failed logout does not claim success, even if the SDK clears its local session')
    logoutFailure = false
    await useSession('a')
    await visible('browser-a@zju.edu.cn')
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await visible('登录后查看你的内容')
    assert(!await hasText('browser-a@zju.edu.cn') && !await hasText('A的测试菜品'), 'logout clears private interface')
    await useSession('b', '/account/posts')
    await page.locator('#my-posts').getByRole('heading', { name: 'B的测试菜品' }).waitFor()
    assert(!await hasText('A的测试菜品') && !await hasText('browser-a@zju.edu.cn'), 'account B never sees A personal data')
    await useSession('a', '/account/posts')
    await page.locator('#my-posts a').filter({ hasText: '编辑' }).first().click()
    await page.locator('#publish-name').fill('A的未保存私人草稿')
    await page.locator('#publish-image').setInputFiles('scratch/personal-center-desktop.png')
    for (const event of ['TOKEN_REFRESHED', 'SIGNED_IN']) {
      const confirmation = page.waitForResponse((response) => response.url() === service + '/auth/v1/user')
      await page.evaluate(({ key, value, event }) => {
        const channel = new BroadcastChannel(key)
        channel.postMessage({ event, session: value })
        channel.close()
      }, { key: storageKey, value: session('a'), event })
      await confirmation
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      assert(await page.locator('#publish-name').inputValue() === 'A的未保存私人草稿' && await page.locator('#publish-image').evaluate((input) => input.files.length) === 1, `same-account ${event} retains unsaved text and local image after server verification`)
    }
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await page.getByRole('link', { name: '使用浙大邮箱登录', exact: true }).waitFor()
    assert(await page.locator('#publish-name').count() === 0 && !await hasText('A的未保存私人草稿'), 'logout unmounts author editor and clears unsaved private fields')
    setDelay()
    await useSession('a', '/account/ratings')
    await delayedStartedPromise
    await page.evaluate(({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value))
      const channel = new BroadcastChannel(key)
      channel.postMessage({ event: 'SIGNED_IN', session: value })
      channel.close()
    }, { key: storageKey, value: session('b') })
    await page.locator('#my-ratings').getByRole('heading', { name: 'B的测试菜品' }).waitFor()
    delayedRelease()
    await page.waitForTimeout(150)
    assert(!await hasText('A的测试菜品') && !await hasText('browser-a@zju.edu.cn'), 'live auth change to B rejects delayed A history without reloading the page')
    setDelay()
    await useSession('a', '/account/ratings')
    await delayedStartedPromise
    await visible('正在加载我的评分…')
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await visible('登录后查看我的评分')
    delayedRelease()
    await page.waitForTimeout(150)
    assert(!await hasText('A的测试菜品'), 'late response after logout cannot restore personal records')
    ratingsMode = 'missing'
    await useSession('a', '/account/ratings')
    await visible('我的评分尚待共享服务接入，请联系项目维护者完成增量迁移。')
    assert(!await hasText('还没有评分记录'), 'undeployed migration is a clear pending state, not empty history')
    ratingsMode = 'failure'
    postsMode = 'failure'
    await page.reload()
    await page.getByRole('button', { name: '重试我的评分' }).waitFor()
    ratingsMode = 'empty'
    await page.getByRole('button', { name: '重试我的评分' }).click()
    await visible('还没有评分记录')
    await page.locator('.account-section-nav').getByRole('link', { name: '我的发布', exact: true }).click()
    await page.getByRole('button', { name: '重试我的发布' }).waitFor()
    postsMode = 'empty'
    await page.getByRole('button', { name: '重试我的发布' }).click()
    await visible('还没有发布美食')
    assert(true, 'separate personal subpage failures retry into genuine empty states')
    authFailure = true
    await page.reload()
    await visible('暂时无法确认账号')
    assert(!await hasText('browser-a@zju.edu.cn'), 'auth error hides personal content')
    authFailure = false
    await page.getByRole('button', { name: '重试账号检查' }).first().click()
    await visible('还没有发布美食')
    assert(true, 'auth retry restores validated account on personal subpage')
    await useSession(null, '/guides')
    await page.getByRole('heading', { name: '校园办事指南', exact: true }).waitFor()
    await page.goto(base + '/sources')
    assert(!await hasText('登录后查看你的内容'), 'public guide and source routes remain ungated')
    assert(errors.length === 0, 'no uncaught browser errors: ' + errors.join('; '))
    return { checks, count: checks.length, fixtureOnly: true, screenshots: ['scratch/personal-center-desktop.png', 'scratch/personal-center-mobile.png'] }
  } catch (error) {
    throw new Error('Passed checks: ' + checks.join('; ') + '\nFailure: ' + error.message)
  }
}
