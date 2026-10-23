import assert from 'node:assert/strict'
import test from 'node:test'
import { personalFoodUrl, personalPublishUrl, personalRecordReturn, personalRecordsPageSize } from '../src/lib/personalRecords.ts'
import { safeFoodReturn } from '../src/lib/foodAuth.ts'

test('个人记录使用每页六条，详情携带经过白名单的返回页', () => {
  assert.equal(personalRecordsPageSize, 6)
  for (const path of ['/account/posts', '/account/ratings', '/food/mine']) {
    const to = personalFoodUrl('food-id', `${path}?page=2&token=private#private`)
    const url = new URL(to, 'https://local.invalid')
    assert.equal(url.searchParams.get('returnTo'), `${path}?page=2`)
    assert.equal(personalRecordReturn(url.searchParams).url, `${path}?page=2`)
    assert.equal(new URL(personalPublishUrl(`${path}?page=2&token=private#private`), 'https://local.invalid').searchParams.get('returnTo'), `${path}?page=2`)
  }
  assert.equal(personalRecordReturn(new URLSearchParams({ returnTo: '/account/ratings?page=3' })).label, '返回我的评分')
})

test('返回链接拒绝外站、路径穿透和非记录路由', () => {
  for (const value of ['https://outside.invalid/account/posts', '//outside.invalid/account/posts', '/\\outside.invalid/account/posts', '/account/posts/extra', '/account/ratings/../posts/extra', '/food', '/account', '/account/posts\n?page=2']) {
    assert.equal(personalRecordReturn(new URLSearchParams({ returnTo: value })), null, value)
    assert.equal(personalFoodUrl('food-id', value), '/food/food-id')
    assert.equal(personalPublishUrl(value), '/food/new')
  }
})

test('个人页码只保留安全正整数，其他参数和嵌套返回不会沿用', () => {
  for (const page of ['0', '-1', '1.5', '02', '1e2', '9007199254740992', '9'.repeat(400)]) {
    assert.equal(personalRecordReturn(new URLSearchParams({ returnTo: `/account/posts?page=${page}&returnTo=https://outside.invalid` })).url, '/account/posts')
  }
  assert.equal(personalFoodUrl('food-id', '/account/posts?page=2', true), '/food/food-id/edit?returnTo=%2Faccount%2Fposts%3Fpage%3D2')
})

test('登录续接允许两个个人子页，但不泛化开放整个account路径', () => {
  for (const route of ['/account/posts?page=2', '/account/ratings?page=3']) assert.equal(safeFoodReturn(route), route)
  for (const route of ['/account/other', '/account/posts/extra', 'https://outside.invalid/account/posts']) assert.equal(safeFoodReturn(route), '/food')
})
