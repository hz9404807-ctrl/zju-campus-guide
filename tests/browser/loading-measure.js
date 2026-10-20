// Same Chromium session, 390x844, CPU x4, 150ms RTT / 1.6Mbit down / 750Kbit up.
// Run with MEASURE_URL replaced in a scratch copy; fixtures never touch production writes.
async (page) => {
  const target = 'http://127.0.0.1:5177/'
  await page.bringToFront()
  const cdp = await page.context().newCDPSession(page)
  await page.setViewportSize({width:390,height:844})
  await page.emulateMedia({reducedMotion:'reduce'})
  await cdp.send('Network.enable')
  await cdp.send('Network.setBlockedURLs',{urls:['*/auth/v1/signup*']})
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750})
  await page.addInitScript(() => {
    window.__lcp=0
    new PerformanceObserver(list=>{for(const e of list.getEntries())window.__lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true})
  })
  const measurements=[]
  for(let run=1;run<=3;run++) {
    await cdp.send('Network.clearBrowserCache')
    for(const cache of ['cold','warm']) {
      await page.goto(target,{waitUntil:'networkidle',timeout:60000})
      await page.locator('#home-title').waitFor()
      await page.waitForFunction(()=>performance.getEntriesByName('first-contentful-paint').length>0)
      await page.waitForTimeout(500)
      measurements.push(await page.evaluate(({run,cache})=>({run,cache,url:location.href,
        fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,lcp:window.__lcp,
        dom:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
        transfer:performance.getEntriesByType('resource').reduce((n,e)=>n+e.transferSize,0),
        js:performance.getEntriesByType('resource').filter(e=>/\.js(?:\?|$)/.test(e.name)).map(e=>({name:e.name.split('/').pop(),transfer:e.transferSize,encoded:e.encodedBodySize})),
        overflow:document.documentElement.scrollWidth>innerWidth}),{run,cache}))
    }
  }
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1})
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})
  await cdp.detach()
  return {target,measurements}
}
