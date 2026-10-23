// Start `node tests/browser/fixture/server.mjs` first.
// `playwright-cli -s=mobile-navigation --raw run-code --filename=tests/browser/mobile-navigation.js`
// Local UI fixture only. A fresh touch context has no saved user sessions.
async (browserPage) => {
  const base = 'http://127.0.0.1:5182'
  const destination = 'scratch/mobile-release/'
  const context = await browserPage.context().browser().newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const results = []
  const blockedExternalRequests = []
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (url.startsWith(base + '/') || url.startsWith('data:')) return route.continue()
    blockedExternalRequests.push(url)
    return route.abort()
  })
  const check = (condition, label) => {
    results.push({ label, pass: Boolean(condition) })
    if (!condition) throw new Error(label)
  }
  try {
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(base + '/')
      await page.getByRole('heading', { name: /办事有方法/ }).waitFor()
      check(!(await page.locator('main').innerText()).includes('信息正在逐步整理和核验'), `home extra caveat removed ${width}`)
      check(await page.locator('header img.brand-wordmark').evaluate((image) => image.complete && image.naturalWidth > 0), `new logo loaded ${width}`)
      if (width === 390) await page.screenshot({ path: destination + 'home-390.png', fullPage: true, animations: 'disabled' })

      await page.locator('main a[href="/food"]').tap()
      await page.waitForURL(base + '/food')
      await page.getByRole('heading', { level: 1 }).waitFor()
      check(true, `home food tap ${width}`)
      await page.getByRole('link', { name: '返回首页', exact: true }).tap()
      await page.waitForURL(base + '/')
      await page.locator('main a[href="/sources"]').tap()
      await page.waitForURL(base + '/sources')
      check(true, `home sources tap ${width}`)

      await page.locator('.account-card').first().tap()
      await page.locator('.source-provenance').waitFor()
      check(!await page.locator('.source-provenance').evaluate((details) => details.open), `source evidence initially folded ${width}`)
      await page.locator('.source-provenance summary').tap()
      check(await page.locator('.source-provenance').evaluate((details) => details.open), `source evidence touch opens ${width}`)
      if (width === 390) await page.screenshot({ path: destination + 'source-390-expanded.png', fullPage: true, animations: 'disabled' })
      await page.locator('.source-provenance summary').press('Enter')
      check(!await page.locator('.source-provenance').evaluate((details) => details.open), `source evidence keyboard collapses ${width}`)
      if (width === 390) await page.screenshot({ path: destination + 'source-390.png', fullPage: true, animations: 'disabled' })
      await page.getByRole('link', { name: '返回信息源列表', exact: true }).first().tap()
      await page.waitForURL(base + '/sources')
      check(true, `source return ${width}`)

      await page.getByRole('button', { name: '打开导航菜单' }).tap()
      await page.getByRole('navigation', { name: '手机主导航', exact: true }).getByRole('link', { name: '个人中心', exact: true }).tap()
      await page.waitForURL(base + '/account')
      check(true, `mobile menu account tap ${width}`)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow ${width}`)

      // A real viewport-coordinate tap after explicit scrolling, without locator auto-scroll.
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto(base + '/')
      const foodText = page.getByText('进入美食点评', { exact: true })
      await foodText.waitFor()
      const beforeScroll = await foodText.boundingBox()
      if (!beforeScroll) throw new Error('Food entry text has no viewport bounds')
      await page.mouse.wheel(0, Math.max(0, beforeScroll.y - 320))
      await page.waitForFunction(() => {
        const element = document.querySelector('a.food-card .card-link')
        if (!element) return false
        const bounds = element.getBoundingClientRect()
        return bounds.top > 80 && bounds.bottom < innerHeight - 40 && element.closest('a').getAnimations({ subtree: true }).every((animation) => animation.playState === 'finished')
      })
      const foodBounds = await foodText.boundingBox()
      check(foodBounds && foodBounds.height >= 44, `home food entry has 44px touch height ${width}`)
      if (!foodBounds) throw new Error('Food entry text disappeared')
      await page.touchscreen.tap(foodBounds.x + foodBounds.width / 2, foodBounds.y + foodBounds.height / 2)
      await page.waitForURL(base + '/food')
      check(true, `home food text coordinate touch after explicit scroll ${width}`)
      await page.emulateMedia({ reducedMotion: 'reduce' })

      await page.goto(base + '/sources?kind=websites')
      const website = page.locator('.website-card').first()
      const externalLink = website.getByRole('link', { name: '打开网站', exact: true })
      const expectedUrl = await externalLink.getAttribute('href')
      const websiteBeforeScroll = await website.boundingBox()
      await page.mouse.wheel(0, Math.max(0, websiteBeforeScroll.y - 96))
      await page.waitForFunction(() => {
        const top = document.querySelector('.website-card').getBoundingClientRect().top
        return top >= 72 && top < 150
      })
      if (width === 390) await website.screenshot({ path: destination + 'website-card-390-default.png', animations: 'disabled' })
      if (width === 320) await website.screenshot({ path: destination + 'website-card-320-default.png', animations: 'disabled' })
      check(expectedUrl && /^https?:\/\//.test(expectedUrl) && await externalLink.getAttribute('target') === '_blank'
        && /\bnoopener\b/.test(await externalLink.getAttribute('rel')) && /\bnoreferrer\b/.test(await externalLink.getAttribute('rel')), `website retains actual external href and new-tab protections ${width}`)
      const blockedBefore = blockedExternalRequests.length
      const popupEvent = page.waitForEvent('popup')
      await externalLink.tap()
      const popup = await popupEvent
      await popup.waitForLoadState('domcontentloaded').catch(() => {})
      check(blockedExternalRequests.slice(blockedBefore).includes(expectedUrl), `website opens new tab with external request intercepted locally ${width}`)
      await popup.close()

      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__fixtureCopiedLink = text } } })
      })
      const copy = website.getByRole('button', { name: '复制链接', exact: true })
      await copy.tap()
      await website.getByRole('status').filter({ hasText: /^已复制$/ }).waitFor()
      check(await page.evaluate(() => window.__fixtureCopiedLink) === expectedUrl, `website copy success contains the actual href ${width}`)
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Local fixture denies clipboard') } } })
      })
      await copy.tap()
      await website.getByRole('status').filter({ hasText: '未能自动复制' }).waitFor()
      check(await website.locator('.guide-copy-fallback').innerText() === expectedUrl, `website copy failure provides exact manual fallback ${width}`)
      check(await website.locator('.website-guide-link').evaluate((link) => link.getBoundingClientRect().height >= 44), `website guide link has 44px touch height ${width}`)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `website action and fallback fit mobile width ${width}`)
      if (width === 390) {
        await page.screenshot({ path: destination + 'website-390-copy-fallback.png', fullPage: true, animations: 'disabled' })
        await website.screenshot({ path: destination + 'website-card-390-copy-fallback.png', animations: 'disabled' })
      }
      if (width === 320) await website.screenshot({ path: destination + 'website-card-320-copy-fallback.png', animations: 'disabled' })
    }
    return { fixtureOnly: true, checks: results.length, results }
  } finally {
    await context.close()
  }
}
