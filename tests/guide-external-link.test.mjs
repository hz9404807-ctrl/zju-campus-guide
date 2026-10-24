import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { guideExternalDestination, describeGuideExternalAction } from '../src/lib/guideExternalLink.ts'

const describe = (kind, url, label = '原始业务名称') => describeGuideExternalAction({ kind, url, label })

test('真实紧急联系电话和教师检索入口不会被称为直接办理', () => {
  const guides = JSON.parse(readFileSync(new URL('../src/data/guides.json', import.meta.url), 'utf8'))
  for (const id of ['campus-066', 'campus-079']) {
    const actions = guides.find(guide => guide.id === id).stepActions.filter(action => action.kind === 'service')
    assert.ok(actions.length > 0)
    for (const action of actions) {
      const result = describeGuideExternalAction(action)
      assert.equal(result.category, '官方入口')
      assert.equal(result.label, action.label)
    }
  }
})

test('已配置service的学校入口保留业务名称和原始链接，不推断具体办理能力', () => {
  const url = 'https://zdbk.zju.edu.cn/?task=transcript#entry'
  const result = describe('service', url, '打开本科教学平台')
  assert.equal(result.category, '官方入口')
  assert.equal(result.label, '打开本科教学平台')
  assert.equal(result.href, url)
  assert.equal(result.destination, 'zdbk.zju.edu.cn')
  assert.equal(result.newWindowText, '新窗口打开')
})

test('学校通知、服务说明等reference不会升级成直接办理', () => {
  assert.equal(describe('reference', 'https://itc.zju.edu.cn/xykwgr/list.htm').category, '官方参考')
  assert.equal(describe('reference', 'https://zju.edu.cn/').category, '官方参考')
  assert.equal(describe('reference', 'https://example.org/rules').category, '参考资料')
})

test('论坛始终作为论坛参考，第三方服务不显示官方', () => {
  assert.equal(describe('reference', 'https://www.cc98.org/topic/123').category, '论坛参考')
  assert.equal(describe('service', 'https://cc98.org/').category, '论坛参考')
  assert.equal(describe('service', 'https://sls.cdb.com.cn/').category, '外部服务')
})

test('官方域名使用完整边界，伪装名称不会取得官方标识', () => {
  for (const host of ['zju.edu.cn.evil.org', 'notzju.edu.cn', 'zju-edu.cn']) {
    assert.equal(describe('service', `https://${host}/`).category, '外部服务')
  }
  assert.equal(describe('service', 'https://ZDBK.ZJU.EDU.CN./').category, '官方入口')
})

test('拒绝脚本协议、相对路径、携带凭据及混淆URL', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//zju.edu.cn/', '/guides/x', '',
    'https://name:password@zju.edu.cn/', 'https://name@zju.edu.cn/', 'https:\\zju.edu.cn/',
    ' https://zju.edu.cn/', 'https://zju.edu.cn/\npath', 'https://zju.edu.cn/has space', 'not a url']) {
    assert.equal(guideExternalDestination(url), null, url)
  }
})

test('拒绝本机、内网及IP字面量，不把它们变成站外操作', () => {
  for (const host of ['localhost', 'app.localhost', 'app.local', 'app.internal', 'app.lan',
    '127.0.0.1', '10.0.0.1', '192.168.1.1', '169.254.169.254', '2130706433', '0x7f000001', '[::1]', '[2001:4860:4860::8888]']) {
    assert.equal(guideExternalDestination(`http://${host}/`), null, host)
  }
})

test('公开http链接和带端口路径仍按原样打开，显示精确目的地址', () => {
  const url = 'http://example.org:8080/notice?campus=%E7%B4%AB%E9%87%91%E6%B8%AF'
  const result = guideExternalDestination(url)
  assert.equal(result.href, url)
  assert.equal(result.destination, 'example.org:8080')
  assert.equal(result.university, false)
})

test('现有指南及路线外链均可以识别，保留采集URL及service/reference边界', () => {
  const guides = JSON.parse(readFileSync(new URL('../src/data/guides.json', import.meta.url), 'utf8'))
  for (const guide of guides) {
    const actions = [...(guide.stepActions ?? []), ...(guide.routes ?? []).flatMap((route) => route.stepActions)]
    for (const action of actions.filter((action) => action.kind !== 'windows')) {
      const result = describeGuideExternalAction(action)
      assert.ok(result, `${guide.id}: ${action.url}`)
      assert.equal(result.href, action.url)
      if (action.kind === 'reference') assert.notEqual(result.category, '官方入口')
    }
    for (const reference of guide.references) assert.ok(describe('reference', reference.url, reference.label), guide.id)
  }
})
