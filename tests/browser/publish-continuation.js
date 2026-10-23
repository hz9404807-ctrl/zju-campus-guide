// Real publisher component with the explicit localhost-only memory fixture.
// Start node tests/browser/fixture/server.mjs before running this with playwright-cli.
// This script does not submit to Supabase, send OTPs or create real accounts.
async (page) => {
  const base = 'http://127.0.0.1:5182'
  const browser = page.context().browser()
  const checks = []
  const failures = []
  const screenshots = []
  const errors = []
  const check = (ok, label) => (ok ? checks : failures).push(label)
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII='
  for (const width of [320, 375, 390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 844 }, isMobile: width < 600, hasTouch: width < 600 })
    context.setDefaultTimeout(10000)
    context.setDefaultNavigationTimeout(10000)
    const p = await context.newPage()
    p.on('pageerror', (error) => errors.push({ width, message: error.message }))
    const log = () => p.evaluate(() => import('/tests/browser/fixture/food-service.ts').then((m) => m.fixturePublishLog()))
    const gotoNew = async () => {
      await p.goto(`${base}/food/new?area=off_campus&q=${encodeURIComponent('保留搜索')}`)
      await p.locator('#publish-name:enabled').waitFor()
    }
    const fill = async (name) => {
      await p.locator('#publish-name').fill(name)
      await p.locator('#publish-location').fill('仅本机隔离测试地点')
      await p.locator('#publish-category').selectOption('面类')
      await p.locator('#publish-price').fill('15.50')
      await p.locator('#publish-description').fill('仅内存的测试说明')
      await p.locator('#publish-tags').fill('仅本机')
      await p.locator('#publish-image').evaluate((input, encoded) => {
        const file = new File([Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))], 'local-only.png', { type: 'image/png' })
        const selection = new DataTransfer()
        selection.items.add(file)
        input.files = selection.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }, png)
      await p.locator('label[for="publish-rating-4"]').click()
    }
    try {
      await gotoNew()
      await fill('本机发布失败后再试')
      await p.waitForFunction(() => { const image = document.querySelector('.food-publish-image-preview img'); return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 })
      check(true, `${width}: the selected local image actually loads as a preview`)
      await p.getByRole('checkbox', { name: '模拟写入失败' }).check()
      await p.getByRole('button', { name: '发布菜品', exact: true }).click()
      await p.locator('.food-publish-feedback').waitFor()
      const failedLog = await log()
      check(failedLog.attempts === 1 && failedLog.successes === 0 && await p.locator('.food-publish-success').count() === 0, `${width}: failed write never reports success`)
      check(await p.locator('#publish-name').inputValue() === '本机发布失败后再试' && await p.locator('#publish-image').evaluate((input) => input.files.length) === 1 && await p.locator('#publish-rating-4').isChecked(), `${width}: failed write retains text, local file and rating`)
      await p.getByRole('checkbox', { name: '模拟写入失败' }).uncheck()
      await p.getByRole('combobox', { name: '响应延迟' }).selectOption('2500')
      await p.locator('.food-publish-form').evaluate((form) => { form.requestSubmit(); form.requestSubmit() })
      check(await p.getByRole('button', { name: /上传图片并发布中/ }).isDisabled(), `${width}: pending write locks submit`)
      check(await p.locator('.food-publish-success').count() === 0, `${width}: success waits for completed write`)
      await p.getByRole('button', { name: '继续发布一道菜', exact: true }).waitFor()
      const savedLog = await log()
      check(savedLog.attempts === 2 && savedLog.successes === 1, `${width}: rapid repeated submit produces one successful write`)
      check(await p.locator('.food-publish-form').count() === 0 && await p.locator('.food-publish-success').evaluate((el) => el === document.activeElement), `${width}: saved draft is replaced by focused success panel`)
      const detail = p.getByRole('link', { name: '查看刚发布的菜品' })
      const detailUrl = await detail.evaluate((link) => { const url = new URL(link.href); return { pathname: url.pathname, area: url.searchParams.get('area'), query: url.searchParams.get('q') } })
      check(/^\/food\/[0-9a-f-]{36}$/.test(detailUrl.pathname) && detailUrl.area === 'off_campus' && detailUrl.query === '保留搜索', `${width}: detail link preserves the saved ID and browsing filters`)
      check(await p.getByRole('link', { name: '返回美食列表', exact: true }).getAttribute('href') === `/food?area=off_campus&q=${encodeURIComponent('保留搜索')}`, `${width}: list return preserves filters`)
      const shot = `scratch/saturday-publish/success-${width}.png`
      await p.screenshot({ path: shot, fullPage: true, animations: 'disabled' })
      screenshots.push(shot)
      const continueButton = p.getByRole('button', { name: '继续发布一道菜', exact: true })
      if (width < 600) await continueButton.tap(); else await continueButton.click()
      await p.locator('#publish-name:enabled').waitFor()
      const values = await p.locator('#publish-name,#publish-location,#publish-category,#publish-price,#publish-description,#publish-tags').evaluateAll((inputs) => inputs.map((input) => input.value))
      check(values.every((value) => value === '') && await p.locator('#publish-image').evaluate((input) => input.files.length) === 0 && await p.locator('#publish-rating-4').isChecked() === false && await p.locator('.food-publish-image-preview').count() === 0, `${width}: continue starts a blank draft without old image or rating`)
      check(await p.locator('#publish-area-off_campus').isChecked() && await p.locator('#publish-name').evaluate((el) => el === document.activeElement), `${width}: continue retains chosen area and focuses the new name`)
      check((await log()).successes === 1 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: continue does not submit again or create horizontal overflow`)
      await p.getByRole('combobox', { name: '响应延迟' }).selectOption('100')
      await p.getByRole('button', { name: '发布菜品', exact: true }).click()
      check((await log()).attempts === 2 && await p.locator('#publish-name-error').isVisible(), `${width}: the next draft requires fresh valid input`)
      await p.locator('#publish-name').fill('本机继续发布的新菜')
      await p.locator('#publish-location').fill('新填写的本机地点')
      await p.locator('label[for="publish-rating-2"]').click()
      await p.getByRole('button', { name: '发布菜品', exact: true }).click()
      await p.getByRole('button', { name: '继续发布一道菜', exact: true }).waitFor()
      const second = await log()
      check(second.successes === 2 && second.lastPublish.name === '本机继续发布的新菜' && second.lastPublish.rating === 2 && second.lastPublish.imageName === null, `${width}: a continued publish uses only the new dish, image and rating choices`)
      await p.getByRole('link', { name: '查看刚发布的菜品' }).click()
      await p.getByRole('heading', { name: '本机继续发布的新菜', exact: true }).waitFor()
      check(true, `${width}: the success detail action opens the newly saved dish`)
      await p.goto(`${base}/food/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/edit?area=campus&returnTo=${encodeURIComponent('/account/posts?page=2')}`)
      await p.locator('#publish-name:enabled').waitFor()
      check(await p.locator('.breadcrumb').getAttribute('href') === '/account/posts?page=2', `${width}: editing keeps the originating personal-list page`)
      await p.locator('#publish-name').fill('仅本机编辑保存')
      await p.locator('#publish-category').selectOption('面类')
      await p.getByRole('button', { name: '保存修改', exact: true }).click()
      await p.waitForURL(/\/food\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\?area=campus&returnTo=/)
      check(await p.getByRole('button', { name: '继续发布一道菜', exact: true }).count() === 0, `${width}: editing saves back to detail without a new-publish success action`)
      check((await log()).attempts === 0, `${width}: editing calls no publish operation`)
    } catch (error) { failures.push(`${width}: ${error.message}`) }
    finally { await context.close() }
  }
  check(errors.length === 0, 'no browser script errors')
  return { passed: checks.length, failed: failures.length, checks, failures, screenshots, errors, scope: 'local-only mock writes; no cloud or physical-device acceptance' }
}
