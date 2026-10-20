import assert from 'node:assert/strict'
import test from 'node:test'
import { campusPreferenceKey, readCampusPreference, resolveGuideCampus, saveCampusPreference } from '../src/lib/campusPreference.ts'

const campuses = ['紫金港', '玉泉', '之江']
test('校区偏好跨事项保存；当前事项无该校区时仍保留明确选择', () => {
  const data = new Map()
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  assert.equal(readCampusPreference(storage, campuses, '紫金港'), '紫金港')
  assert.equal(saveCampusPreference(storage, '之江'), true)
  assert.equal(readCampusPreference(storage, campuses, '玉泉'), '之江')
  assert.equal(saveCampusPreference(storage, ''), true)
  assert.equal(readCampusPreference(storage, campuses, '玉泉'), '')
  data.set(campusPreferenceKey, '损坏的数据')
  assert.equal(readCampusPreference(storage, campuses, '紫金港'), '紫金港')
})
test('存储被禁用或不可用时不阻止用户查看窗口', () => {
  const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.equal(readCampusPreference(blocked, campuses, '玉泉'), '玉泉')
  assert.equal(saveCampusPreference(blocked, '之江'), false)
  assert.equal(readCampusPreference(null, campuses, '紫金港'), '紫金港')
  assert.equal(saveCampusPreference(null, '之江'), false)
})
test('收藏链接的有效校区覆盖当前浏览器偏好，后退切换链接立即生效', () => {
  assert.equal(resolveGuideCampus('玉泉', campuses, '紫金港'), '玉泉')
  assert.equal(resolveGuideCampus('紫金港', campuses, '玉泉'), '紫金港')
})
test('失效校区回到本条路线可用服务点，不能保留错误选中状态', () => {
  assert.equal(resolveGuideCampus('失效校区', ['玉泉'], '紫金港'), '玉泉')
  assert.equal(resolveGuideCampus('之江', ['紫金港', '玉泉'], '玉泉'), '玉泉')
  assert.equal(resolveGuideCampus(null, ['玉泉'], ''), '玉泉')
  assert.equal(resolveGuideCampus('紫金港', [], '紫金港'), '')
})
