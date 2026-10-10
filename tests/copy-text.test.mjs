import test from 'node:test'
import assert from 'node:assert/strict'
import { copyText } from '../src/lib/copyText.ts'

test('复制成功只传输用户点击的文字', async () => {
  const values = []
  await copyText('紫金港办理窗口地址', async (value) => { values.push(value) })
  assert.deepEqual(values, ['紫金港办理窗口地址'])
})

test('浏览器拒绝或不支持复制时，返回失败供界面显示手动复制', async () => {
  await assert.rejects(copyText('地址'), /unavailable/)
  await assert.rejects(copyText('地址', async () => { throw new Error('denied') }), /denied/)
})

test('不响应的剪贴板请求能结束等待，允许再次复制', async () => {
  await assert.rejects(copyText('地址', () => new Promise(() => {}), 20), /timed out/)
  await copyText('再次复制', async () => {})
})
