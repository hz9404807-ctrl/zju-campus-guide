// Local fixture only. Uses real routes/components and an in-memory account service.
// Run with the shared tests/browser/fixture/server.mjs on loopback port 5182.
async (page) => {
  const base = 'http://127.0.0.1:5182'
  const checks = []
  const positions = []
  const errors = []
  const external = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { if (!request.url().startsWith(base + '/') && !request.url().startsWith('data:')) external.push(request.url()) })
  const assert = (condition, label) => { if (!condition) throw new Error(label); checks.push(label) }
  const record = (kind) => page.locator(`#my-${kind} .account-item-list > li`).first()
  const main = () => page.locator('main')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    for (const kind of ['posts', 'ratings']) {
      await page.goto(`${base}/account/${kind}`)
      await record(kind).waitFor()
      const bar = page.locator('.food-account-bar-session')
      assert(await bar.getByText('浙大邮箱已登录', { exact: true }).isVisible() && await bar.getByRole('link').count() === 0, `${kind} ${width}: session strip retains verification without duplicate navigation`)
      assert(!(await main().innerText()).includes('fixture-a@zju.edu.cn'), `${kind} ${width}: records page does not expose private email`)
      const controls = await page.locator('.account-record-navigation a, .food-account-bar-session button, .account-section-heading > .button-link').all()
      assert((await Promise.all(controls.map((node) => node.boundingBox()))).every((box) => box && box.height >= 44), `${kind} ${width}: navigation, publish and logout targets remain at least 44px tall`)
      const nav = page.getByRole('navigation', { name: '个人内容', exact: true })
      assert(await nav.getByRole('link', { name: kind === 'posts' ? '我的发布' : '我的评分', exact: true }).getAttribute('aria-current') === 'page', `${kind} ${width}: active subpage is announced`)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${kind} ${width}: no horizontal overflow`)
      const top = await record(kind).evaluate((node) => node.getBoundingClientRect().top)
      positions.push({ width, kind, firstRecordTop: top })
      // Includes the visible local-fixture banner and, for posts, its evidence label.
      assert(top < (width === 320 ? 580 : 530), `${kind} ${width}: compact header brings first record into initial phone viewport`)
      await page.screenshot({ path: `scratch/records-header/after-${kind}-${width}.png`, fullPage: false })
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/account/posts`)
  await record('posts').waitFor()
  await page.getByRole('navigation', { name: '个人内容', exact: true }).getByRole('link', { name: '我的评分', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.waitForURL('**/account/ratings')
  await record('ratings').waitFor()
  assert(true, 'keyboard Enter switches to ratings subpage')
  await page.locator('.breadcrumb').focus()
  await page.keyboard.press('Enter')
  await page.waitForURL('**/account')
  await main().getByText('fixture-a@zju.edu.cn', { exact: true }).waitFor()
  assert(true, 'keyboard breadcrumb returns to full personal center')

  await page.goto(`${base}/account/posts`)
  await record('posts').waitFor()
  await page.getByLabel('模拟写入失败', { exact: true }).check()
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await page.locator('.food-account-bar-session [role="alert"]').getByText('本地测试：模拟保存失败，内容尚未保存。', { exact: false }).waitFor()
  assert(await record('posts').isVisible() && await page.getByRole('button', { name: '退出登录', exact: true }).isEnabled(), 'failed sign-out keeps records and displays a retryable error')
  await page.getByLabel('模拟写入失败', { exact: true }).uncheck()
  await page.getByLabel('响应延迟', { exact: true }).selectOption('2500')
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  assert(await page.getByRole('button', { name: '退出中…', exact: true }).isDisabled(), 'pending logout disables its button and announces busy state')
  await main().getByText('登录后查看我的发布', { exact: true }).waitFor()
  assert(await page.locator('.food-account-bar-session, #my-posts .account-post').count() === 0, 'logout clears personal records and removes session strip')
  await page.locator('.account-empty').getByRole('link', { name: /使用浙大邮箱登录/ }).click()
  assert(await page.evaluate(() => new URL(location.href).searchParams.get('returnTo')) === '/account/posts', 'guest login retains the requested personal subpage')

  await page.goto(`${base}/account/ratings`)
  await record('ratings').waitFor()
  await page.getByLabel('查询响应', { exact: true }).selectOption('failure')
  await page.getByRole('button', { name: '重试我的评分', exact: true }).waitFor()
  assert(await page.locator('#my-ratings .account-rating').count() === 0, 'failed record request clears old items and exposes retry')
  await page.getByRole('button', { name: '恢复响应以重试', exact: true }).click()
  await page.getByRole('button', { name: '重试我的评分', exact: true }).click()
  await record('ratings').waitFor()
  assert(true, 'record retry restores the current user data')
  await page.getByLabel('响应延迟', { exact: true }).selectOption('2500')
  await page.getByLabel('测试身份', { exact: true }).selectOption('b')
  await main().getByText('正在确认登录状态…', { exact: true }).waitFor()
  assert(await page.locator('.food-account-bar-session, #my-ratings .account-rating').count() === 0, 'account recheck has one loading state and no stale record or session strip')
  await main().getByText('B的本地测试菜品', { exact: true }).waitFor()
  assert(!(await main().innerText()).includes('A的'), 'switching identity replaces records without leaking the previous account')

  await page.goto(`${base}/food/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`)
  await page.locator('.food-account-links').getByRole('link', { name: '个人中心', exact: true }).waitFor()
  assert(await page.locator('.food-account-links').getByRole('link', { name: '我的发布', exact: true }).isVisible() && await page.locator('.food-account-bar-session').count() === 0, 'public food detail retains its existing full account navigation')
  assert(errors.length === 0, 'no uncaught browser errors: ' + errors.join('; '))
  assert(external.length === 0, 'no external requests from isolated fixture: ' + external.join('; '))
  return { fixtureOnly: true, count: checks.length, checks, positions }
}
