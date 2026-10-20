// Production preview, readonly configuration. No service or account writes.
async (page)=>{
  const base='http://127.0.0.1:5178'
  const checks=[],requests=[]
  const assert=(condition,message)=>{if(!condition)throw Error(message);checks.push(message)}
  page.on('request',request=>requests.push(request.url()))
  await page.bringToFront()
  await page.setViewportSize({width:390,height:844})
  await page.goto(base+'/')
  await page.locator('#home-query').waitFor()
  assert(!requests.some(url=>/GuidePages-|FoodPages-|service-windows-|useFoodAuth-|FoodAccountProvider-/.test(url)),'home does not request guides food service data or account code')
  const failure='**/assets/GuidePages-*.js'
  let blocked=0
  const block=route=>{blocked++;return route.abort('failed')}
  await page.context().route(failure,block)
  await page.getByRole('link',{name:'查找办事指南',exact:true}).click()
  await page.getByRole('heading',{name:'这个页面暂时没有加载成功'}).waitFor()
  const failedUrl=page.url()
  await page.waitForTimeout(500)
  assert(blocked===1 && page.url()===failedUrl,'failed lazy chunk shows recovery without automatic reload loop')
  await page.screenshot({path:'scratch/campus-chunk-failure-390.png',fullPage:true})
  await page.context().unroute(failure,block)
  await page.getByRole('button',{name:'重新加载当前页',exact:true}).click()
  await page.getByRole('heading',{name:'校园办事指南',level:1}).waitFor()
  assert(true,'manual reload recovers the same route after network recovery')
  await page.goto(base+'/guides/campus-card-replacement?campus=invalid#guide-step-0')
  await page.locator('#guide-step-0').waitFor()
  await page.waitForFunction(()=>document.activeElement?.id==='guide-step-0')
  assert(!page.url().includes('campus=invalid'),'invalid saved campus falls back to a real service point')
  assert(await page.locator('#guide-step-0').evaluate(el=>el.getBoundingClientRect().top>=0),'cold deep link anchor is visible after lazy mount')
  const campusButtons=page.getByRole('group',{name:'办理校区'}).getByRole('button')
  if(await campusButtons.count()>1){
    const next=await campusButtons.nth(1).innerText()
    await campusButtons.nth(1).click()
    assert(decodeURIComponent(page.url()).includes('campus='+next),'visible campus selection updates URL for saved context')
    await page.reload()
    await page.getByRole('group',{name:'办理校区'}).getByRole('button',{name:next,exact:true}).waitFor()
    assert(await page.getByRole('group',{name:'办理校区'}).getByRole('button',{name:next,exact:true}).getAttribute('aria-pressed')==='true','refresh honors campus in deep link')
  }
  await page.goto(base+'/sources?kind=websites')
  await page.getByRole('heading',{name:'校园信息源导航',level:1}).waitFor()
  await page.getByRole('button',{name:'收藏',exact:true}).first().click()
  await page.getByRole('link',{name:'登录浙大邮箱后收藏，完成后返回这里'}).click()
  await page.getByRole('heading',{name:/浙大邮箱/}).first().waitFor()
  assert(decodeURIComponent(page.url()).includes('/sources?kind=websites'),'public website favorite carries correct login return')
  for(const width of [320,375,390,1440]){
    await page.setViewportSize({width,height:950})
    await page.goto(base+'/sources')
    await page.locator('.account-preview img').first().waitFor()
    await page.waitForFunction(()=>[...document.querySelectorAll('.account-preview img')].slice(0,2).every(img=>img.complete && img.naturalWidth>0))
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`source preview no overflow ${width}px`)
    assert(await page.locator('.account-preview img').first().getAttribute('src').then(src=>src.endsWith('.webp')),'directory uses display copies while originals remain detail evidence')
    await page.screenshot({path:`scratch/campus-sources-${width}.png`,fullPage:true,animations:'disabled'})
  }
  await page.setViewportSize({width:375,height:844})
  await page.goto(base+'/')
  const toggle=page.getByRole('button',{name:'打开导航菜单',exact:true})
  await toggle.focus();await page.keyboard.press('Enter')
  await page.getByRole('navigation',{name:'手机主导航'}).waitFor()
  await page.keyboard.press('Escape')
  assert(await toggle.evaluate(el=>el===document.activeElement),'Escape closes mobile menu and restores keyboard focus')
  return {checks:checks.length,passed:checks}
}
