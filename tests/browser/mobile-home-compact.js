// Local fixture only. The toolbar stays visible as evidence of isolated test data.
async page => {
  const base = 'http://127.0.0.1:5182'
  const checks = [], desktop = [], phone = [], errors = []
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label) }
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  async function home(width, height) {
    await page.setViewportSize({ width, height })
    await page.goto(base + '/')
    await page.locator('.home-page .source-banner').waitFor()
    await page.waitForFunction(() => document.querySelector('.brand-wordmark')?.complete)
  }
  for (const width of [1280, 1440]) {
    await home(width, 1000)
    const geometry = await page.locator('.home-page .hero,.home-page .module-card,.home-page .source-banner').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect(), css = getComputedStyle(node)
      return { className: node.className, x: rect.x, y: rect.y, width: rect.width, height: rect.height, fontSize: css.fontSize, padding: css.padding, background: css.backgroundColor }
    }))
    const x = width === 1280 ? 80 : 160
    check(geometry[0].x === x && geometry[0].y === 195.59375 && geometry[0].width === 1120 && geometry[0].height === 534.59375 && geometry[0].padding === '88px 48px 42px', `${width}: desktop hero matches the recorded pre-change layout`)
    check(geometry[1].x === x && geometry[1].y === 811.1875 && geometry[1].width === 548 && geometry[1].height === 333.8125 && geometry[1].padding === '28px', `${width}: desktop guide card matches baseline`)
    check(geometry[2].x === x + 572 && geometry[2].y === 811.1875 && geometry[2].width === 548 && geometry[2].height === 333.8125 && geometry[2].padding === '28px', `${width}: desktop food card matches baseline`)
    check(geometry[3].x === x && geometry[3].y === 1169 && geometry[3].width === 1120 && geometry[3].height === 105.890625 && geometry[3].padding === '24px 28px', `${width}: desktop information-source entrance matches baseline`)
    check(await page.locator('.home-page .hero-description').isVisible() && await page.locator('.home-page .card-tags').first().isVisible(), `${width}: desktop supporting copy and tags remain visible`)
    await page.screenshot({ path: `scratch/mobile-home-compact/after-${width}.png`, fullPage: true })
    desktop.push({ width, geometry })
  }
  const touch = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  page = await touch.newPage()
  page.on('pageerror', error => errors.push(error.message))
  try { for (const width of [320, 375, 390]) {
    await home(width, 844)
    const title = (await page.locator('#home-title').innerText()).replace(/\s/g, '')
    check(title === '办事有方法，信息有方向，生活有去处。', `${width}: complete slogan remains visible`)
    const entrances = page.locator('.home-page .module-card,.home-page .source-banner')
    const boxes = await entrances.evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return { y: rect.y, bottom: rect.bottom, height: rect.height } }))
    check(boxes.length === 3 && boxes.every(box => box.y > 0 && box.bottom <= 844), `${width}: all three service entrances fit the first 844px viewport, including fixture toolbar`)
    check(boxes.every(box => box.height >= 44), `${width}: service cards retain touch targets above 44px`)
    check(await page.locator('.hero-action').evaluate(node => node.getBoundingClientRect().height >= 44), `${width}: hero action remains 44px`)
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: no horizontal overflow`)
    const heroHeight = await page.locator('.home-page .hero').evaluate(node => node.getBoundingClientRect().height)
    check(heroHeight <= 220, `${width}: opening cover is compact`)
    await page.screenshot({ path: `scratch/mobile-home-compact/home-${width}.png`, fullPage: false })
    await page.locator('.home-page .guide-card').focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(url => url.pathname === '/guides')
    check(await page.getByRole('heading', { name: '校园办事指南', exact: true }).isVisible(), `${width}: keyboard opens guide entrance`)
    await home(width, 844)
    await page.locator('.home-page .food-card').tap()
    await page.waitForURL(url => url.pathname === '/food')
    await page.locator('.food-list-page').waitFor()
    check(await page.locator('.food-list-page').isVisible(), `${width}: touch opens food entrance`)
    await home(width, 844)
    await page.locator('.home-page .source-banner').tap()
    await page.waitForURL(url => url.pathname === '/sources')
    await page.getByRole('heading', { name: '校园信息源导航', exact: true }).waitFor()
    check(await page.locator('.source-page').count() > 0 || await page.getByRole('heading', { name: '校园信息源导航', exact: true }).isVisible(), `${width}: touch opens information-source entrance`)
    phone.push({ width, heroHeight, entrances: boxes })
  } } finally { await touch.close() }
  check(errors.length === 0, 'no uncaught application errors')
  return { checks: checks.length, results: checks, desktop, phone, errors, fixtureOnly: true }
}
