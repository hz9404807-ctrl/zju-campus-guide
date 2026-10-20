// Isolated UI regression: dev server 127.0.0.1:5176 with the fixture env in docs.
// playwright-cli -s=campus-features run-code --filename=tests/browser/campus-discovery.js
// All remote HTTP requests are intercepted. These are simulated service checks,
// not proof that favorites migrations or cross-device persistence are live.
async (page) => {
  const base = 'http://127.0.0.1:5176'
  const service = 'https://personal-center-test.invalid'
  const storageKey = 'sb-personal-center-test-auth-token'
  const ids = { a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222', guest: '33333333-3333-4333-8333-333333333333' }
  const foodIds = { normal: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', unknown: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', hidden: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', zero: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', edge: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', high: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }
  const longLocation = '测试校区东区食堂二层靠近南侧出口的测试窗口（仅浏览器隔离数据）'
  const now = Math.floor(Date.now() / 1000)
  const tokens = await page.evaluate(({ ids, now }) => {
    const part = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    return Object.fromEntries(Object.entries(ids).map(([key, sub]) => [key, `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub, aud: 'authenticated', role: 'authenticated', exp: now + 3600 })}.fixture`]))
  }, { ids, now })
  const checks = [], screenshots = [], errors = [], unexpected = [], rpcCalls = []
  const user = (who) => ({ id: ids[who], aud: 'authenticated', role: 'authenticated', email: who === 'guest' ? '' : `browser-${who}@zju.edu.cn`, is_anonymous: who === 'guest', email_confirmed_at: who === 'guest' ? undefined : '2026-10-20T00:00:00Z', app_metadata: { provider: who === 'guest' ? 'anonymous' : 'email', providers: [who === 'guest' ? 'anonymous' : 'email'] }, user_metadata: {}, created_at: '2026-10-20T00:00:00Z' })
  const session = (who) => ({ access_token: tokens[who], refresh_token: 'fixture-refresh-' + who, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: user(who) })
  const whoFor = (request) => Object.keys(ids).find((who) => request.headers().authorization === 'Bearer ' + tokens[who]) ?? 'guest'
  const foods = [
    { id: foodIds.unknown, name: '测试未标价菜品', price: null, average_rating: null, rating_count: 0 },
    { id: foodIds.high, name: '测试二十元菜品', price: 20, average_rating: 4.5, rating_count: 20, location: '测试第二食堂' },
    { id: foodIds.normal, name: '测试十元边界菜品', price: 10, average_rating: 4.5, rating_count: 2 },
    { id: foodIds.zero, name: '测试真实零元菜品', price: 0, average_rating: 5, rating_count: 1 },
    { id: foodIds.edge, name: '测试十元零一分菜品', price: 10.01, category: '面类', average_rating: 4.5, rating_count: 20 },
  ].map((row) => ({ location: longLocation, area: 'campus', category: '饭类', description: '仅用于隔离浏览器验证，不代表真实美食。', tags: [], image_url: null, created_by: ids.a, updated_at: '2026-10-20T00:00:00Z', created_at: '2026-10-20T00:00:00Z', deleted_at: null, ...row }))
  const favorites = { a: new Map(), b: new Map(), guest: new Map() }
  const favorite = (target_kind, target_id, context = {}) => ({ target_kind, target_id, context, created_at: '2026-10-20T00:00:00Z' })
  const key = (kind, id) => `${kind}:${id}`
  let foodReads = 0, saveCalls = 0, removeCalls = 0
  let listMode = 'normal', writeMode = 'normal', foodMode = 'normal'
  let delayListOwner = '', delayedStarted, delayedRelease, delayedListPromise
  let delaySave = false, saveStarted, saveRelease, delayedSavePromise
  const assert = (ok, message) => { if (!ok) throw Error(message); checks.push(message) }
  const text = () => page.locator('main').innerText()
  const visible = (value) => page.getByText(value, { exact: true }).waitFor({ state: 'visible' })
  const cardNames = () => page.locator('.food-grid .food-item-card h2').allTextContents()
  async function expectCards(expected, message) {
    await page.waitForFunction(expected => Array.from(document.querySelectorAll('.food-grid .food-item-card h2')).map(element => element.textContent).join('|') === expected.join('|'), expected)
    assert((await cardNames()).join('|') === expected.join('|'), message)
  }
  const favoriteButton = () => page.locator('.favorite-control > button.favorite-button').first()
  page.on('pageerror', error => errors.push(error.message))
  await page.context().unroute('**/*')
  await page.context().route('**/*', async (route) => {
    const request = route.request(), full = request.url()
    if (full === base || full.startsWith(base + '/')) return route.continue()
    if (!full.startsWith(service + '/')) { unexpected.push(full.split('?')[0]); return route.abort() }
    const relative = full.slice(service.length), pathname = relative.split('?')[0]
    const query = Object.fromEntries((relative.split('?')[1] ?? '').split('&').filter(Boolean).map(field => field.split('=').map(decodeURIComponent)))
    const who = whoFor(request), input = request.postData() ? request.postDataJSON() : {}
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (pathname === '/auth/v1/user') return reply(user(who))
    if (pathname === '/auth/v1/signup') return reply(session('guest'))
    if (pathname === '/auth/v1/otp') return reply({})
    if (pathname === '/auth/v1/verify') return reply(session('a'))
    if (pathname === '/auth/v1/logout') return route.fulfill({ status: 204 })
    if (pathname === '/rest/v1/food_summaries') {
      const owner = query.created_by?.replace('eq.', ''), id = query.id?.replace('eq.', '')
      if (!owner && !id) { foodReads += 1; if (foodMode === 'failure') return reply({ code: 'XX000', message: 'fixture unavailable' }, 400) }
      const result = foods.filter(food => (!owner || food.created_by === owner) && (!id || food.id === id) && !food.deleted_at)
      return reply(id ? result[0] ?? null : result)
    }
    if (pathname === '/rest/v1/ratings') return reply(null)
    if (pathname === '/rest/v1/rpc/list_my_food_ratings') return reply([])
    if (pathname.startsWith('/rest/v1/rpc/')) rpcCalls.push({ pathname, who, input })
    if (pathname === '/rest/v1/rpc/list_my_campus_favorites') {
      const snapshot = [...favorites[who].values()].map(item => ({ ...item, context: { ...item.context } }))
      if (who === delayListOwner) { delayListOwner = ''; delayedStarted(); await new Promise(resolve => { delayedRelease = resolve }) }
      if (listMode === 'missing') return reply({ code: 'PGRST202', message: 'fixture RPC not deployed' }, 404)
      if (listMode === 'failure') return reply({ code: 'XX000', message: 'fixture read failure' }, 400)
      return reply(snapshot)
    }
    if (pathname === '/rest/v1/rpc/save_my_campus_favorite') {
      saveCalls += 1
      if (delaySave) { delaySave = false; saveStarted(); await new Promise(resolve => { saveRelease = resolve }) }
      if (writeMode === 'failure') return reply({ code: 'XX000', message: 'fixture write failure' }, 400)
      if (who === 'guest') return reply({ code: '42501' }, 403)
      if (input.p_target_kind === 'food' && !foods.some(food => food.id === input.p_target_id && !food.deleted_at)) return reply({ code: 'P0002' }, 400)
      favorites[who].set(key(input.p_target_kind, input.p_target_id), favorite(input.p_target_kind, input.p_target_id, input.p_context))
      return reply(null)
    }
    if (pathname === '/rest/v1/rpc/remove_my_campus_favorite') {
      removeCalls += 1
      if (who === 'guest') return reply({ code: '42501' }, 403)
      favorites[who].delete(key(input.p_target_kind, input.p_target_id))
      return reply(null)
    }
    unexpected.push(pathname)
    return reply({ message: 'Unexpected fixture endpoint' }, 400)
  })
  async function useSession(who, path = '/account') {
    await page.goto(base + '/src/data/foods.example.json')
    await page.evaluate(({ key, value }) => { localStorage.clear(); sessionStorage.clear(); if (value) localStorage.setItem(key, JSON.stringify(value)) }, { key: storageKey, value: who ? session(who) : null })
    await page.goto(base + path)
  }
  async function switchSession(who) {
    await page.evaluate(({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value))
      const channel = new BroadcastChannel(key); channel.postMessage({ event: 'SIGNED_IN', session: value }); channel.close()
    }, { key: storageKey, value: session(who) })
  }
  async function capture(name, width) {
    await page.setViewportSize({ width, height: width > 800 ? 1000 : 900 })
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }) })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no horizontal overflow at ${width}px`)
    const path = `scratch/campus-${name}-${width}.png`
    await page.screenshot({ path, fullPage: true, animations: 'disabled' }); screenshots.push(path)
  }
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await useSession(null, '/')
    const search = page.locator('#home-query')
    await search.waitFor()
    await search.dispatchEvent('compositionstart')
    await search.fill('chengji')
    assert(page.url() === base + '/', 'home IME composition does not update URL with pinyin')
    await search.fill('成绩单')
    assert(page.url() === base + '/', 'home IME intermediate Chinese text is still local')
    await search.dispatchEvent('compositionend', { data: '成绩单' })
    await page.locator('.unified-results section').first().waitFor()
    assert(await page.locator('.unified-results section').first().getAttribute('aria-label') === '办事指南搜索结果', 'unified results put actionable guides before official entries and accounts')
    const firstGuide = page.locator('.unified-results section').first().locator('li a').first()
    assert((await firstGuide.getAttribute('href')).startsWith('/guides/campus-097?'), '成绩单 prioritizes the transcript guide')
    await firstGuide.click()
    await page.getByRole('heading', { name: '成绩单怎样打印、盖章或密封？', exact: true, level: 1 }).waitFor()
    await page.getByRole('link', { name: '返回首页搜索', exact: true }).click()
    await search.waitFor()
    assert(await search.inputValue() === '成绩单' && page.url().includes('q=') && page.url().endsWith('#home-search'), 'guide returns to original home search and anchor')
    await page.getByRole('button', { name: '清空搜索', exact: true }).click()
    assert(await search.inputValue() === '' && !page.url().includes('q='), 'clear search removes the query and returns to suggestions')
    assert(await search.evaluate(element => element === document.activeElement), 'clear search restores keyboard focus')
    await search.fill('不存在xyz999')
    await page.getByText('没有找到匹配内容，请换一个关键词。', { exact: true }).waitFor()
    assert(await page.locator('.unified-results section').count() === 0, 'unknown search shows no inaccurate exact results')
    await search.fill('成绩单')
    await page.locator('.unified-results section').first().waitFor()
    for (const width of [320, 375, 390, 1440]) await capture('search', width)
    await page.setViewportSize({ width: 320, height: 900 })
    const menu = page.getByRole('button', { name: '打开导航菜单', exact: true })
    await menu.focus(); await page.keyboard.press('Enter')
    await page.getByRole('navigation', { name: '手机主导航' }).waitFor()
    await page.keyboard.press('Escape')
    assert(await page.getByRole('navigation', { name: '手机主导航' }).count() === 0 && await menu.evaluate(element => element === document.activeElement), 'mobile navigation supports keyboard open, Escape and focus restoration')

    await useSession('a', '/food?area=campus')
    await page.locator('.food-grid .food-item-card').first().waitFor()
    assert((await text()).includes('价格待补充'), 'unknown price is explicitly labeled on a food card')
    const initialReads = foodReads
    const sort = page.getByRole('combobox', { name: '排列方式', exact: true })
    await sort.selectOption('price-asc')
    await expectCards(['测试真实零元菜品', '测试十元边界菜品', '测试十元零一分菜品', '测试二十元菜品', '测试未标价菜品'], 'ascending prices preserve real zero and put unknown last')
    await sort.selectOption('price-desc')
    await expectCards(['测试二十元菜品', '测试十元零一分菜品', '测试十元边界菜品', '测试真实零元菜品', '测试未标价菜品'], 'descending prices also put unknown last')
    await sort.selectOption('rating-desc')
    await expectCards(['测试真实零元菜品', '测试十元零一分菜品', '测试二十元菜品', '测试十元边界菜品', '测试未标价菜品'], 'rating sort uses real mean, count, stable ID and unrated last')
    assert((await text()).includes('评分较少，供参考') && (await text()).includes('同分时评分人数多的在前'), 'small rating samples and score sort meaning are visible')
    await page.getByRole('textbox', { name: '最低预算（元）', exact: true }).fill('0')
    await page.getByRole('textbox', { name: '最高预算（元）', exact: true }).fill('10')
    await expectCards(['测试真实零元菜品', '测试十元边界菜品'], 'inclusive 0–10 budget excludes unknown and 10.01')
    await page.getByRole('combobox', { name: '菜品分类', exact: true }).selectOption('饭类')
    await page.getByRole('combobox', { name: '食堂 / 窗口', exact: true }).selectOption(longLocation)
    await sort.selectOption('price-desc')
    await expectCards(['测试十元边界菜品', '测试真实零元菜品'], 'category, long location, budget and order combine in one result list')
    assert(foodReads === initialReads, 'changing all food filters and sorting does not refetch the list')
    const sharedPath = await page.evaluate(() => location.pathname + location.search)
    const detail = page.locator('.food-grid .food-item-card').first()
    const href = await detail.getAttribute('href')
    assert(href.includes('minPrice=0') && href.includes('maxPrice=10') && href.includes('sort=price-desc') && href.includes('category='), 'detail link carries the full combined filter state')
    await detail.click()
    await page.getByRole('heading', { name: '测试十元边界菜品', exact: true, level: 1 }).waitFor()
    await page.getByRole('link', { name: '返回美食列表', exact: true }).click()
    await page.locator('.food-grid .food-item-card').first().waitFor()
    assert(await page.evaluate(() => location.pathname + location.search) === sharedPath, 'detail return retains exact combined URL filters')
    await page.goto(base + sharedPath)
    await page.locator('.food-grid .food-item-card').first().waitFor()
    await expectCards(['测试十元边界菜品', '测试真实零元菜品'], 'opening a shared combined-filter URL restores the same results')
    await page.getByRole('textbox', { name: '最高预算（元）', exact: true }).fill('-1')
    await page.getByRole('heading', { name: '请检查预算范围', exact: true }).waitFor()
    assert(await page.locator('.food-grid .food-item-card').count() === 0, 'invalid budget has explicit validation and no misleading unfiltered results')
    await page.getByRole('textbox', { name: '最高预算（元）', exact: true }).fill('0')
    await expectCards(['测试真实零元菜品'], 'exact zero budget remains a valid boundary')
    await page.getByRole('textbox', { name: '最低预算（元）', exact: true }).fill('99')
    await page.getByRole('heading', { name: '请检查预算范围', exact: true }).waitFor()
    assert((await text()).includes('最低预算不能高于最高预算'), 'reversed budget is explained')
    await page.getByRole('textbox', { name: '最高预算（元）', exact: true }).fill('100')
    await page.getByRole('heading', { name: '没有找到符合条件的菜品', exact: true }).waitFor()
    assert(true, 'valid budget with no matches shows an honest empty state')
    await page.getByRole('button', { name: '清除筛选，查看全部', exact: true }).click()
    await page.locator('.food-grid .food-item-card').first().waitFor()
    foodMode = 'failure'
    await page.getByRole('button', { name: '刷新列表', exact: true }).click()
    await page.getByRole('heading', { name: '暂时无法加载', exact: true }).waitFor()
    assert((await cardNames()).length === 5, 'failed refresh preserves the previously loaded food cards')
    foodMode = 'normal'
    await page.getByRole('button', { name: '重新加载', exact: true }).click()
    await page.getByRole('heading', { name: '暂时无法加载', exact: true }).waitFor({ state: 'hidden' })
    assert((await cardNames()).length === 5, 'food retry restores the loaded list')
    for (const width of [320, 375, 390, 1440]) await capture('food', width)

    await useSession('a', '/guides/campus-097?route=seal&campus=%E7%B4%AB%E9%87%91%E6%B8%AF&q=%E6%88%91%E7%9A%84%E7%A7%81%E4%BA%BA%E6%A3%80%E7%B4%A2&token=fixture-must-not-persist')
    await favoriteButton().waitFor()
    await favoriteButton().waitFor({ state: 'visible' })
    await page.getByRole('button', { name: '收藏', exact: true }).waitFor()
    await page.waitForFunction(() => !document.querySelector('.favorite-button').disabled)
    writeMode = 'failure'
    const saveBefore = saveCalls
    await favoriteButton().click()
    await page.getByRole('alert').filter({ hasText: '收藏操作未完成' }).waitFor()
    assert(await favoriteButton().getAttribute('aria-pressed') === 'false' && favorites.a.size === 0, 'failed favorite write never shows saved state or adds a record')
    assert(saveCalls === saveBefore + 1, 'failed write makes one request')
    writeMode = 'normal'; delaySave = true
    delayedSavePromise = new Promise(resolve => { saveStarted = resolve })
    const writesBeforeRetry = saveCalls
    await favoriteButton().click()
    await delayedSavePromise
    assert(await favoriteButton().isDisabled(), 'favorite remains disabled while its write is pending')
    await favoriteButton().evaluate(button => { button.click(); button.click() })
    saveRelease()
    await page.getByRole('button', { name: '已收藏，点击取消', exact: true }).waitFor()
    assert(saveCalls === writesBeforeRetry + 1 && favorites.a.size === 1, 'repeated clicks during a pending save produce one write and one favorite')
    const savedGuide = favorites.a.get(key('guide', 'campus-097'))
    assert(savedGuide.context.route === 'seal' && savedGuide.context.campus === '紫金港' && Object.keys(savedGuide.context).length === 2, 'favorite stores only a valid route and campus, excluding private query and arbitrary URL data')
    await page.reload()
    await page.getByRole('button', { name: '已收藏，点击取消', exact: true }).waitFor()
    assert(true, 'saved favorite state reloads from the service fixture, not component memory')
    await favoriteButton().click()
    await page.getByRole('button', { name: '收藏', exact: true }).waitFor()
    assert(favorites.a.size === 0 && removeCalls === 1, 'cancel favorite removes the service record and updates the button')

    favorites.a.set(key('guide', 'campus-097'), favorite('guide', 'campus-097', { route: 'retired-route', campus: '不存在校区' }))
    favorites.a.set(key('food', foodIds.normal), favorite('food', foodIds.normal))
    favorites.a.set(key('food', foodIds.hidden), favorite('food', foodIds.hidden))
    favorites.a.set(key('website', 'website-does-not-exist'), favorite('website', 'website-does-not-exist'))
    favorites.b.set(key('guide', 'campus-002'), favorite('guide', 'campus-002'))
    await useSession('a', '/account#my-favorites')
    await visible('browser-a@zju.edu.cn')
    await page.locator('#my-favorites .favorite-list > li').filter({ hasText: '测试十元边界菜品' }).waitFor()
    const favoriteSection = page.locator('#my-favorites')
    const expiredGuide = favoriteSection.locator('li').filter({ hasText: '成绩单怎样打印' })
    assert(await expiredGuide.getByRole('link', { name: '打开收藏内容', exact: true }).getAttribute('href') === '/guides/campus-097', 'stale guide route and campus fall back to current guide without invalid selections')
    assert((await expiredGuide.innerText()).includes('原办理位置已调整'), 'invalid favorite context explains the fallback')
    const unavailable = favoriteSection.locator('li').filter({ hasText: '原内容已撤下或不再可用' })
    assert(await unavailable.count() === 2 && await unavailable.locator('a').count() === 0, 'withdrawn food and nonexistent official entry have no restricted detail links')
    assert(await unavailable.getByRole('button', { name: '移除收藏', exact: true }).count() === 2, 'unavailable targets remain removable')
    await expiredGuide.getByRole('link', { name: '打开收藏内容', exact: true }).click()
    await page.getByRole('button', { name: '查看全部办理方式', exact: true }).waitFor()
    assert(await page.getByRole('button', { name: '查看全部办理方式', exact: true }).getAttribute('aria-pressed') === 'true', 'invalid stored route opens the guide overview with no incorrect selected route')
    await page.goto(base + '/account#my-favorites')
    await page.locator('#my-favorites .favorite-list > li').filter({ hasText: '测试十元边界菜品' }).waitFor()
    for (const width of [320, 375, 390, 1440]) await capture('account', width)
    assert(rpcCalls.filter(call => call.pathname.endsWith('/list_my_campus_favorites')).every(call => Object.keys(call.input).length === 0), 'favorite listing RPC has no caller-supplied owner argument')
    assert(rpcCalls.filter(call => /(?:save|remove)_my_campus_favorite$/.test(call.pathname)).every(call => !Object.keys(call.input).some(name => /owner|user/.test(name))), 'favorite writes send only target/context and no owner argument')

    listMode = 'failure'
    await page.reload()
    await page.getByRole('button', { name: '重试我的收藏', exact: true }).waitFor()
    assert(await page.locator('#my-favorites .favorite-list > li').count() === 0, 'failed favorites query does not reuse stale private entries')
    listMode = 'normal'
    await page.getByRole('button', { name: '重试我的收藏', exact: true }).click()
    await page.locator('#my-favorites .favorite-list > li').first().waitFor()
    assert(await page.locator('#my-favorites .favorite-list > li').count() === 4, 'favorite read retry restores only current account records')
    listMode = 'missing'
    await page.reload()
    await page.getByText('收藏尚待共享服务接入，请联系项目维护者完成收藏增量迁移。', { exact: true }).waitFor()
    assert(!(await favoriteSection.innerText()).includes('还没有收藏'), 'undeployed favorite RPC is pending integration, not a fake empty success')
    listMode = 'normal'

    delayListOwner = 'a'
    delayedListPromise = new Promise(resolve => { delayedStarted = resolve })
    await useSession('a')
    await delayedListPromise
    await visible('browser-a@zju.edu.cn')
    await switchSession('b')
    await visible('browser-b@zju.edu.cn')
    await page.locator('#my-favorites .favorite-list > li').filter({ hasText: '怎样用手机上的电子校园卡消费和认证' }).waitFor()
    delayedRelease()
    await page.waitForTimeout(200)
    assert(!(await favoriteSection.innerText()).includes('测试十元边界菜品') && !(await favoriteSection.innerText()).includes('成绩单怎样打印') && await favoriteSection.locator('.favorite-list > li').count() === 1, 'switching A to B rejects delayed A favorite response and exposes only B records')
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await visible('登录后查看你的内容')
    assert(!(await text()).includes('browser-b@zju.edu.cn') && await page.locator('#my-favorites').count() === 0, 'logout clears the email and private favorite interface')

    await useSession(null, '/guides/campus-097?route=print#guide-route-heading')
    await page.getByRole('button', { name: '收藏', exact: true }).waitFor()
    await favoriteButton().click()
    const login = page.getByRole('link', { name: '登录浙大邮箱后收藏，完成后返回这里', exact: true })
    await login.waitFor()
    const loginHref = await login.getAttribute('href')
    assert(decodeURIComponent(loginHref.split('returnTo=')[1]) === '/guides/campus-097?route=print#guide-route-heading', 'guest favorite login link keeps original guide route and hash')
    await login.click()
    await page.getByLabel('已有邮箱账号登录').check()
    await page.getByLabel('浙大邮箱', { exact: true }).fill('browser-a@zju.edu.cn')
    await page.getByRole('button', { name: '发送验证码', exact: true }).click()
    await page.getByLabel('邮件验证码').fill('123456')
    await page.getByRole('button', { name: '验证并登录', exact: true }).click()
    await page.getByRole('heading', { name: '成绩单怎样打印、盖章或密封？', exact: true, level: 1 }).waitFor()
    assert(page.url() === base + '/guides/campus-097?route=print#guide-route-heading', 'verified login from favorite returns to original public guide, query and hash')
    await page.getByRole('button', { name: '更新收藏的办理位置', exact: true }).waitFor()
    await page.getByRole('button', { name: '更新收藏的办理位置', exact: true }).click()
    await visible('收藏位置已更新')
    assert(favorites.a.get(key('guide', 'campus-097')).context.route === 'print', 'returning user can update the saved valid guide route')
    assert(unexpected.length === 0, 'no fixture request escaped to a real external service: ' + unexpected.join(', '))
    assert(errors.length === 0, 'no uncaught browser errors: ' + errors.join('; '))
    return { checks, checkCount: checks.length, screenshots, fixtureOnly: true, actualCloudVerified: false, databasePermissionsVerifiedHere: false }
  } catch (error) {
    throw Error(`Passed ${checks.length} checks: ${checks.join('; ')}\nFailure: ${error.message}`)
  }
}
