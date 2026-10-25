// Start the isolated fixture server; never submit the generated GitHub draft.
// playwright-cli -s=guide-feedback --raw run-code --filename=tests/browser/guide-feedback.js
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const browser = await context.newPage()
  const base = 'http://127.0.0.1:5182'
  const checks = []
  const errors = []
  const external = []
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label) }
  browser.on('pageerror', (error) => errors.push(error.message))
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (url.startsWith(base + '/')) return route.continue()
    external.push(url)
    return route.abort()
  })
  await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied for fallback test') } } }))
  const provenance = () => browser.locator('.guide-provenance')
  const openFeedback = async () => {
    const summary = browser.locator('.guide-feedback > summary')
    await summary.focus()
    await browser.keyboard.press('Enter')
    await browser.getByLabel('补充说明（选填）', { exact: true }).waitFor()
  }
  const draft = () => browser.locator('.guide-feedback-submit').evaluate((element) => {
    const url = new URL(element.href)
    return { origin: url.origin, pathname: url.pathname, keys: [...url.searchParams.keys()], body: url.searchParams.get('body'), target: element.target, rel: element.rel }
  })
  try {
    for (const width of [320, 375, 390, 1280]) {
      await browser.setViewportSize({ width, height: 900 })
      await browser.goto(base + '/guides/campus-card-replacement?q=MY_PRIVATE_QUERY&returnTo=%2Fsources%3Fq%3DPRIVATE_RETURN&studio_token=HOST_SECRET')
      await provenance().waitFor()
      const record = await provenance().innerText()
      check(record.trim() === '发现信息有误？反馈给项目组', `${width}: collapsed section contains only the requested feedback entry`)
      check(await provenance().locator('time,dl,.guide-provenance-heading,.guide-provenance-scope').count() === 0, `${width}: collection metadata and verification explanations are removed from this area`)
      await browser.getByRole('navigation', { name: '本页内容', exact: true }).getByRole('link', { name: '信息反馈', exact: true }).click()
      await browser.waitForFunction(() => document.activeElement?.id === 'guide-provenance-heading')
      check(await browser.locator('.guide-feedback > summary').evaluate(element => element.getBoundingClientRect().top >= document.querySelector('.guide-contents').getBoundingClientRect().bottom - 1), `${width}: contents link focuses the visible feedback entry below the sticky navigation`)
      await openFeedback()
      check((await browser.locator('.guide-feedback-privacy').innerText()).includes('需登录 GitHub，提交后内容公开'), `${width}: public submission and GitHub sign-in are explained before input`)
      await browser.getByLabel('遇到了什么问题？', { exact: true }).selectOption('missing')
      await browser.getByLabel('补充说明（选填）', { exact: true }).fill('窗口所在楼栋需要补充。')
      const link = await draft()
      check(link.origin === 'https://github.com' && link.pathname === '/hz9404807-ctrl/zju-campus-guide/issues/new' && link.keys.join(',') === 'title,body', `${width}: feedback destination remains the fixed repository draft`)
      check(link.body.includes('缺少办理信息') && link.body.includes('窗口所在楼栋需要补充。'), `${width}: selected issue type and actual description reach the draft`)
      check(!/MY_PRIVATE_QUERY|PRIVATE_RETURN|HOST_SECRET|returnTo|studio_token|q=/.test(link.body), `${width}: private search and host parameters are absent`)
      check(link.target === '_blank' && link.rel.includes('noopener') && link.rel.includes('noreferrer'), `${width}: new-window link does not expose opener or referrer`)
      const touch = await browser.locator('.guide-feedback summary,.guide-feedback select,.guide-feedback button,.guide-feedback-submit').evaluateAll((elements) => elements.every((element) => element.getBoundingClientRect().height >= 44))
      check(touch, `${width}: feedback controls keep 44px touch areas`)
      await browser.getByRole('button', { name: '复制反馈内容', exact: true }).click()
      await browser.locator('.guide-feedback .guide-copy-fallback').waitFor()
      check((await browser.locator('.guide-feedback .guide-copy-fallback').innerText()) === link.body, `${width}: denied clipboard exposes the complete feedback for manual copying`)
      check(await browser.getByLabel('补充说明（选填）', { exact: true }).getAttribute('maxlength') === '500', `${width}: description has a visible bounded limit`)
      check(await browser.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: open feedback does not overflow the screen`)
      if (width === 390 || width === 1280) {
        await browser.evaluate(() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
          const target = document.querySelector('.guide-provenance')
          const header = document.querySelector('.site-header')
          const navigation = document.querySelector('.guide-contents')
          const offset = Math.max(header?.getBoundingClientRect().bottom ?? 0, navigation?.getBoundingClientRect().bottom ?? 0)
          window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - offset - 12, behavior: 'instant' })
        })
        await browser.screenshot({ path: `scratch/guide-feedback-${width}.png`, animations: 'disabled' })
      }
    }
    await browser.goto(base + '/guides/campus-009?route=seat&q=MY_PRIVATE_QUERY')
    await provenance().waitFor()
    await openFeedback()
    await browser.getByLabel('补充说明（选填）', { exact: true }).fill('本路线反馈草稿。')
    check((await draft()).body.includes('页面：/guides/campus-009?route=seat'), 'known route ID is carried in the feedback target')
    await browser.locator('.guide-route-choices button').nth(2).click()
    await browser.waitForFunction(() => !document.querySelector('.guide-feedback').open)
    await openFeedback()
    check(await browser.getByLabel('补充说明（选填）', { exact: true }).inputValue() === '', 'changing the procedure resets the old-route feedback draft')
    check((await draft()).body.includes('页面：/guides/campus-009?route=space'), 'changed procedure uses the current known route')
    await browser.goto(base + '/guides/campus-004')
    await provenance().waitFor()
    check((await provenance().innerText()).trim() === '发现信息有误？反馈给项目组', 'guide without review metadata also keeps only the feedback entry')
    check(errors.length === 0, 'no browser runtime errors')
    check(external.length === 0, 'no issue was submitted and no external request was made')
    return { passed: checks.length, checks, errors, external, screenshots: ['scratch/guide-feedback-390.png', 'scratch/guide-feedback-1280.png'] }
  } finally {
    await context.close()
  }
}
