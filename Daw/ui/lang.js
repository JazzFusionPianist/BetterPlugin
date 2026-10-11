/* ── the language the program speaks ──
   English is how the room is written; Korean is said through the list in lang.ko.js. The kit asks here for every word
   it draws or measures (kit.js: inWords), so a word is put into the other language wherever it stands, and a word the
   list does not hold stays as it is written. A phrase with numbers in it is looked up with # in their places ('track #').
   Names people gave are never looked up (kit.js: asGiven).

   Which language: the settings (general, language) — the app says it before the page is drawn (window.__LANG) and tells
   every page when it changes ('dawLang'); a browser may say ?lang=ko.  LANG.now is 'en' or 'ko': anything that speaks
   differently by language (the order of a command, say) asks it here. */
const LANG = { now: 'en', lists: {}, seen: new Set(), collect: !!window.__LANG_COLLECT, heard: [] }
LANG.now = (() => { const q = new URLSearchParams(location.search).get('lang') || window.__LANG || 'en'; return q === 'ko' ? 'ko' : 'en' })()

const NUMBER = /\d+(?:[.,:]\d+)*/g
window.LANG_WORDS = s => {
  if (LANG.now === 'en' && !LANG.collect) return s
  const list = LANG.lists[LANG.now]
  if (list && list[s] != null && LANG.now !== 'en') return list[s]
  const nums = [], key = s.replace(NUMBER, m => { nums.push(m); return '#' })
  if (list && nums.length && list[key] != null && LANG.now !== 'en') { let i = 0; return list[key].replace(/#/g, () => nums[i++]) }
  if (LANG.collect && /[a-z]/.test(key) && LANG.seen.size < 5000) LANG.seen.add(key)       // (for making the list: what was written and is not in it)
  return s
}
/* another language from now on: everything is drawn again */
function setLang (l) {
  l = l === 'ko' ? 'ko' : 'en'
  if (l === LANG.now) return
  LANG.now = l
  document.documentElement.lang = l
  for (const f of LANG.heard) f(l)
  if (typeof dirtyAll === 'function') { if (typeof relayout === 'function') relayout(); dirtyAll() }
}
if (window.__JUCE__ && window.__JUCE__.backend) window.__JUCE__.backend.addEventListener('dawLang', d => { if (d && d.lang) setLang(d.lang) })
document.documentElement.lang = LANG.now
