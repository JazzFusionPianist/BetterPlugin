// The server-side date resolution of parse-schedule: what the text names is
// what the calendar gets. Run: node --experimental-strip-types --test tests/schedule-dates.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDates, settleDates, splitAnchor, todayIn, calendarTable } from '../supabase/functions/parse-schedule/dates.ts'

const TODAY = { y: 2026, m: 10, d: 5 }   // a Monday
const r = (text, anchor = null) => resolveDates(text, TODAY, anchor)
const first = (text, anchor = null) => r(text, anchor).dates[0]
const none = (text, anchor = null) => assert.deepEqual(r(text, anchor).dates, [], text)

test('today in the user\'s timezone, not UTC', () => {
  assert.deepEqual(todayIn('2026-10-04T16:30:00Z', 'Asia/Seoul'), { y: 2026, m: 10, d: 5 })
  assert.deepEqual(todayIn('2026-10-04T16:30:00Z', 'America/New_York'), { y: 2026, m: 10, d: 4 })
})

test('the reported bug: 10일 is the tenth, not ten days on', () => {
  assert.equal(first('10일 5시 합주'), '2026-10-10')
  assert.equal(first('10일 5시'), '2026-10-10')
  assert.equal(first('10일에 합주'), '2026-10-10')
  assert.equal(first('15일 저녁 7시 공연'), '2026-10-15')
  assert.equal(first('5일 3시'), '2026-10-05')          // today counts
  assert.equal(first('3일 3시'), '2026-11-03')          // gone this month: next month's
  assert.equal(first('31일 파티'), '2026-10-31')
  assert.equal(r('10일 5시 합주').text, '10일(2026-10-10) 5시 합주')
})

test('with a day open in the calendar', () => {
  const s = splitAnchor('on 2026-10-05: 10일 5시')
  assert.deepEqual(s.anchor, TODAY); assert.equal(s.text, '10일 5시')
  assert.equal(first('10일 5시', TODAY), '2026-10-10')
  // the calendar is on november: a bare day belongs to the open month
  assert.equal(first('10일 5시', { y: 2026, m: 11, d: 3 }), '2026-11-10')
  assert.equal(first('2일 합주', { y: 2026, m: 11, d: 20 }), '2026-11-02')
  assert.equal(first('1월 5일 녹음', { y: 2026, m: 12, d: 20 }), '2027-01-05')
})

test('a count of days is not a day of the month', () => {
  assert.equal(first('10일 뒤 합주'), '2026-10-15')
  assert.equal(first('3일 후 미팅'), '2026-10-08')
  assert.equal(first('2주 뒤 공연'), '2026-10-19')
  assert.equal(r('10일 뒤 합주').dates.length, 1)
  none('3일 동안 녹음'); none('2일차 리허설'); none('5일간 투어'); none('3일 연속 공연')
  assert.equal(first('in 3 days rehearsal'), '2026-10-08')
})

test('month and day', () => {
  assert.equal(first('10월 10일 5시'), '2026-10-10')
  assert.equal(first('11월 3일 공연'), '2026-11-03')
  assert.equal(first('1월 5일 녹음'), '2027-01-05')      // long gone this year
  assert.equal(first('9월 20일 회고'), '2026-09-20')      // two weeks ago: still this year
  assert.equal(first('2027년 3월 1일 발매'), '2027-03-01')
  assert.equal(first('2026-12-24 공연'), '2026-12-24')
  assert.equal(first('10/15 합주'), '2026-10-15')
  assert.equal(first('다음 달 3일 미팅'), '2026-11-03')
  assert.equal(first('이번 달 20일'), '2026-10-20')
  assert.equal(r('10월 10일 5시').dates.length, 1)        // not tagged twice
  none('2월 30일')                                         // no such day
})

test('a musician\'s numbers are not dates', () => {
  none('6/8 곡 연습'); none('4/4 박자로'); none('3/4 왈츠 합주')
  none('2nd verse 다시'); none('1st take 좋음'); none('5시 30분 합주')
  assert.equal(first('on the 10th at 5'), '2026-10-10')
})

test('weekdays and relative words', () => {
  assert.equal(first('금요일 7시 합주'), '2026-10-09')
  assert.equal(first('월요일 회의'), '2026-10-05')         // today is monday
  assert.equal(first('다음 주 토요일 공연'), '2026-10-17')
  assert.equal(first('담주 수요일'), '2026-10-14')
  assert.equal(first('이번 주 일요일'), '2026-10-11')
  assert.equal(first('내일 3시 회의'), '2026-10-06')
  assert.equal(first('모레 점심'), '2026-10-07')
  assert.equal(first('내일모레 점심'), '2026-10-07')
  assert.equal(r('내일모레 점심').dates.length, 1)
  assert.equal(first('글피 저녁'), '2026-10-08')
  assert.equal(first('rehearsal next friday 7pm'), '2026-10-16')
  assert.equal(first('tomorrow 3pm'), '2026-10-06')
  assert.equal(first('Oct 10 show'), '2026-10-10')
  assert.equal(first('10th of November gig'), '2026-11-10')
  assert.deepEqual(r('월요일 합주, 금요일 공연').dates, ['2026-10-05', '2026-10-09'])
})

test('the model\'s dates are held to the text', () => {
  const fix = (text, events, anchor = null) => settleDates(events, r(text, anchor), TODAY, anchor).map(e => e.date)
  // one named date: it wins, whatever the model said
  assert.deepEqual(fix('10일 5시 합주', [{ title: '합주', date: '2026-10-15' }]), ['2026-10-10'])
  assert.deepEqual(fix('10일 5시 합주, 7시 저녁', [{ date: '2026-10-15' }, { date: '2026-10-10' }]), ['2026-10-10', '2026-10-10'])
  // no date named: the open day, else today
  assert.deepEqual(fix('5시 합주', [{ date: '2026-10-09' }], { y: 2026, m: 10, d: 20 }), ['2026-10-20'])
  assert.deepEqual(fix('5시 합주', [{ date: '2026-10-09' }]), ['2026-10-05'])
  // several named, as many as events: paired in order when the sets differ
  assert.deepEqual(fix('월요일 합주, 금요일 공연', [{ date: '2026-10-05' }, { date: '2026-10-10' }]), ['2026-10-05', '2026-10-09'])
  assert.deepEqual(fix('월요일 합주, 금요일 공연', [{ date: '2026-10-09' }, { date: '2026-10-05' }]), ['2026-10-09', '2026-10-05'])   // the model reordered: its own
  // a date we could not resolve stays the model's
  assert.deepEqual(fix('주말에 공연', [{ date: '2026-10-10' }]), ['2026-10-10'])
  assert.deepEqual(fix('10일 합주, 그 다음날 공연', [{ date: '2026-10-10' }, { date: '2026-10-11' }]), ['2026-10-10', '2026-10-11'])
  assert.deepEqual(fix('추석에 가족모임', [{ date: '2026-09-25' }]), ['2026-09-25'])
  // nonsense from the model falls back
  assert.deepEqual(fix('주말에 공연', [{ date: 'saturday' }]), ['2026-10-05'])
})

test('the table has no "in N days" row to misread', () => {
  const t = calendarTable(TODAY)
  assert.equal(t.todayLine, '2026-10-05 (Monday)')
  assert.ok(!/in \d+ days/.test(t.table))
  assert.equal(t.table.split('\n').length, 21)
})
