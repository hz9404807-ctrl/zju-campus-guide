// Local UI regression only: actual App/routes, isolated in-memory account service.
// Run against tests/browser/fixture/server.mjs. Never navigates to external sites.
async (page) => {
  const base = 'http://127.0.0.1:5182'
  const checks = []
  const errors = []
  const external = []
  const positions = []
  const assert = (condition, label) => { if (!condition) throw new Error(label); checks.push(label) }
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!request.url().startsWith(base + '/') && !request.url().startsWith('data:')) external.push(request.url()) })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  async function settled() {
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }
  async function noOverflow(label) {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label)
  }
  async function visit(path) {
    await page.goto(base + path)
    await page.locator('main h1').waitFor()
    await settled()
  }
  async function anchorCheck(id, keyboard, width) {
    const nav = page.getByRole('navigation', { name: '本页内容', exact: true })
    const link = nav.locator(`a[href$="#${id}"]`)
    if (keyboard) { await link.focus(); await page.keyboard.press('Enter') }
    else await link.click()
    await page.waitForFunction(expected => location.hash === `#${expected}` && document.activeElement?.id === expected, id)
    await settled()
    const box = await page.evaluate(expected => {
      const heading = document.getElementById(expected).getBoundingClientRect()
      const nav = document.querySelector('.guide-contents').getBoundingClientRect()
      const header = document.querySelector('.site-header').getBoundingClientRect()
      return { id: expected, top: heading.top, bottom: heading.bottom, navBottom: nav.bottom, headerBottom: header.bottom, viewport: innerHeight }
    }, id)
    positions.push({ width, ...box })
    assert(box.top >= Math.max(box.navBottom, box.headerBottom) - 2 && box.bottom < box.viewport, `${width}: ${keyboard ? 'keyboard' : 'tap'} ${id} focuses visible heading below sticky navigation`)
  }
  async function repeatAnchorCheck(id, link, source, width) {
    await link.click()
    await page.waitForFunction(expected => location.hash === `#${expected}` && document.activeElement?.id === expected, id)
    await settled()
    const sameUrl = page.url()
    // A user can keep reading after following a section link, leaving its hash intact.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
    await settled()
    assert(page.url() === sameUrl && await page.locator(`#${id}`).evaluate(node => node.getBoundingClientRect().bottom < 0), `${width}: ${source} repeat scenario scrolls away without changing the current anchor URL`)
    await link.click()
    await page.waitForFunction(expected => document.activeElement?.id === expected, id, { timeout: 6000 })
    await settled()
    const box = await page.evaluate(expected => {
      const target = document.getElementById(expected).getBoundingClientRect()
      return { top: target.top, bottom: target.bottom, headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom, navBottom: document.querySelector('.guide-contents').getBoundingClientRect().bottom, viewport: innerHeight }
    }, id)
    positions.push({ width, id, repeatedFrom: source, ...box })
    assert(page.url() === sameUrl && box.top >= Math.max(box.headerBottom, box.navBottom) - 2 && box.bottom < box.viewport, `${width}: repeated ${source} tap on the unchanged anchor restores heading focus below sticky navigation`)
  }

  for (const width of [320, 375, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    const label = `${width}px`
    const params = '?q=%E6%A0%A1%E5%9B%AD%E5%8D%A1&category=%E6%A0%A1%E5%9B%AD%E5%8D%A1&page=1'
    await visit('/guides' + params)
    const card = page.locator('.guide-result-card').filter({ has: page.getByRole('heading', { name: '校园卡丢了，怎么挂失和补办？', exact: true }) })
    const internal = card.getByRole('link', { name: '查看指南', exact: true })
    const outbound = card.locator('a.guide-outbound-link')
    assert(await page.getByLabel('你想办什么事？', { exact: true }).inputValue() === '校园卡' && await page.getByLabel('按类别查找', { exact: true }).inputValue() === '校园卡', `${label}: search and category are reflected by actual controls`)
    assert((await outbound.innerText()).includes('官方参考') && (await outbound.innerText()).includes('itc.zju.edu.cn') && await outbound.getAttribute('target') === '_blank', `${label}: separate reference identifies destination and new-window behavior`)
    const expectedExternal = await outbound.getAttribute('href')
    const listUrl = page.url()
    // Capture the real hit target and prevent external navigation before any request.
    await page.evaluate(() => {
      window.__guideOutboundHit = null
      document.addEventListener('click', event => {
        const link = event.target.closest?.('a.guide-outbound-link')
        if (link) { event.preventDefault(); window.__guideOutboundHit = link.getAttribute('href') }
      }, { capture: true, once: true })
    })
    await outbound.click()
    assert(await page.evaluate(() => window.__guideOutboundHit) === expectedExternal && page.url() === listUrl, `${label}: external target receives its own tap without activating the guide-card overlay`)
    await internal.click()
    await page.waitForURL('**/guides/campus-card-replacement?**')
    await settled()
    assert(await page.locator('main h1').innerText() === '校园卡丢了，怎么挂失和补办？', `${label}: view-guide target enters the local procedure`)
    await page.locator('.guide-bottom-back').click()
    await page.waitForURL('**/guides?**')
    await settled()
    assert(await page.evaluate(() => { const p = new URL(location.href).searchParams; return p.get('q') === '校园卡' && p.get('category') === '校园卡' && p.get('page') === '1' }), `${label}: detail return retains query, category and explicit page`)

    await visit('/guides?page=2')
    const secondPageCard = page.locator('.guide-result-card').first()
    const secondPageTitle = await secondPageCard.locator('h3').innerText()
    await secondPageCard.getByRole('link', { name: '查看指南', exact: true }).click()
    await page.locator('.guide-detail-page').waitFor()
    await page.locator('.breadcrumb').click()
    await settled()
    assert(await page.evaluate(() => location.pathname === '/guides' && new URL(location.href).searchParams.get('page') === '2') && await page.locator('.guide-result-card').first().locator('h3').innerText() === secondPageTitle, `${label}: returning from an actual second-page result keeps the same page and first result`)

    await visit('/guides/campus-card-replacement' + params)
    const summary = page.locator('.guide-task-summary')
    assert(await summary.locator(':scope > div').count() === 3 && (await summary.innerText()).includes('3项') && (await summary.innerText()).includes('4项') && (await summary.innerText()).includes('7个已收录服务点'), `${label}: campus-card overview accurately counts materials, steps and all collected service points`)
    assert(await page.locator('.guide-material-list').first().locator(':scope > li').count() === 3, `${label}: the three materials are present in the procedure`)
    assert(await page.locator('.guide-step-list > li').count() === 4, `${label}: the four ordered procedure steps are present`)
    assert(await summary.locator('a[href$="#guide-materials-heading"]').count() === 1 && await summary.locator('a[href$="#guide-steps-heading"]').count() === 1 && await summary.locator('a[href$="#guide-windows-heading"]').count() === 1, `${label}: each summary entry leads to its matching section`)
    const nav = page.getByRole('navigation', { name: '本页内容', exact: true })
    await page.locator('#guide-steps-heading').evaluate(node => node.scrollIntoView())
    await settled()
    const sticky = await page.evaluate(() => ({ nav: document.querySelector('.guide-contents').getBoundingClientRect().top, header: document.querySelector('.site-header').getBoundingClientRect().bottom, position: getComputedStyle(document.querySelector('.guide-contents')).position }))
    assert(sticky.position === 'sticky' && Math.abs(sticky.nav - sticky.header) <= 2, `${label}: section navigation sticks directly below the actual header`)
    const scrolling = await nav.locator('ul').evaluate(node => { node.scrollLeft = node.scrollWidth; return { width: node.clientWidth, full: node.scrollWidth, left: node.scrollLeft } })
    assert(width >= 900 || scrolling.full > scrolling.width && scrolling.left > 0, `${label}: phone section choices can scroll inside their own navigation row`)
    await noOverflow(`${label}: horizontally scrolling the section menu does not widen the document`)
    assert((await Promise.all((await nav.getByRole('link').all()).map(link => link.boundingBox()))).every(box => box && box.height >= 44), `${label}: section links keep 44px touch targets`)
    for (const [id, keyboard] of [['guide-materials-heading', false], ['guide-steps-heading', true], ['guide-windows-heading', false], ['guide-references-heading', true]]) await anchorCheck(id, keyboard, width)
    if (width === 390 || width === 1440) await page.screenshot({ path: `scratch/guide-journey/card-reference-${width}.png`, fullPage: false })
    await repeatAnchorCheck('guide-materials-heading', nav.locator('a[href$="#guide-materials-heading"]'), 'section menu', width)
    await repeatAnchorCheck('guide-materials-heading', summary.locator('a[href$="#guide-materials-heading"]'), 'task overview', width)
    if (width === 390 || width === 1440) await page.screenshot({ path: `scratch/guide-journey/repeated-anchor-${width}.png`, fullPage: false })

    await visit('/guides/campus-097')
    assert(await page.locator('.guide-task-summary > div').count() === 1 && (await page.locator('.guide-task-summary').innerText()).includes('5种，先选择适用方式') && await page.locator('#guide-materials-heading, #guide-steps-heading, #guide-windows-heading').count() === 0, `${label}: transcript overview asks for an applicable route and does not mix procedural content`)
    await page.getByRole('button', { name: '研究生成绩单', exact: true }).click()
    await settled()
    assert(await page.evaluate(() => new URL(location.href).searchParams.get('route')) === 'graduate' && await page.getByRole('button', { name: '研究生成绩单', exact: true }).getAttribute('aria-pressed') === 'true' && (await page.locator('.guide-route-scope').innerText()).includes('在校或已毕业研究生'), `${label}: selecting graduate transcripts updates route, selected state and audience`)
    assert(await page.locator('.guide-material-list').first().locator(':scope > li').count() === 1 && !(await page.locator('.guide-material-list').first().innerText()).includes('本科') && await page.locator('.guide-step-list > li').count() === 4 && await page.locator('.guide-windows').count() === 0, `${label}: graduate materials and steps do not inherit the undergraduate seal window`)
    await page.getByRole('button', { name: '本科生出国盖章/密封', exact: true }).click()
    await settled()
    assert(await page.locator('.guide-material-list').first().locator(':scope > li').count() === 4 && await page.locator('.guide-window-card').count() === 1 && await page.getByRole('button', { name: '本科生出国盖章/密封', exact: true }).getAttribute('aria-pressed') === 'true', `${label}: switching to the undergraduate seal route replaces materials and window correctly`)
    await page.getByRole('button', { name: '查看全部办理方式', exact: true }).click()
    await settled()
    assert(await page.getByRole('button', { name: '查看全部办理方式', exact: true }).getAttribute('aria-pressed') === 'true' && await page.locator('.guide-method-list > li').count() === 5 && await page.locator('#guide-materials-heading, #guide-steps-heading, #guide-windows-heading').count() === 0, `${label}: all-routes selection restores five independent summaries and clears route-specific sections`)
    await noOverflow(`${label}: transcript route controls fit the document`)

    for (const id of ['campus-111', 'campus-112']) {
      await visit('/guides/' + id)
      const context = page.locator('.guide-window-context')
      await context.waitFor()
      const text = await context.innerText()
      const precedes = await context.evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector('.guide-window-list')) & Node.DOCUMENT_POSITION_FOLLOWING))
      assert(text.includes('海宁校区及独立核算单位不在此表范围内') && text.includes('预约单/系统确认承办点') && precedes, `${label}: ${id} preserves the financial service-point scope above the window list`)
      await noOverflow(`${label}: ${id} long financial scope and locations do not overflow`)
      if (id === 'campus-111' && (width === 320 || width === 1440)) { await context.scrollIntoViewIfNeeded(); await page.screenshot({ path: `scratch/guide-journey/finance-scope-${width}.png`, fullPage: false }) }
    }
  }
  assert(errors.length === 0, 'no uncaught browser errors across all guide journeys')
  assert(external.length === 0, 'all browser requests remained on the isolated local service')
  return { passed: checks.length, checks, anchorPositions: positions, errors, externalRequests: external }
}
