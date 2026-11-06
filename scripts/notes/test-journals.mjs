#!/usr/bin/env node
// Integration test for P1-1 journals against the DEV server (scripts/notes/dev-env.sh, port 3100).
// Uses a throwaway test account that exists only in the dev database.
// Usage: node scripts/notes/test-journals.mjs   (exit 0 = all checks passed)
import assert from 'node:assert/strict';
import { api, login, localDate, shiftDate } from './test-lib.mjs';

const checks = [];
const check = async (name, fn) => {
  try {
    await fn();
    checks.push([name, 'ok']);
  } catch (e) {
    checks.push([name, `FAIL: ${e.message}`]);
  }
};

const session = await login();
const call = (path, body) => api(session, path, body);
const today = localDate();
const yesterday = shiftDate(today, -1);

let todayPage;
await check('open today creates a journal titled with the date', async () => {
  // make sure the test starts from a known state for today's date
  const prior = await call('/notes/journals/by-date', { date: today });
  for (const p of prior.items) await call('/notes/journals/set-date', { pageId: p.id, date: null });
  const r = await call('/notes/journals/open', { date: today, today });
  assert.equal(r.page.title, today);
  assert.equal(r.page.journalDate, today);
  assert.equal(r.created, true);
  todayPage = r.page;
});

await check('open today again returns the same page', async () => {
  const r = await call('/notes/journals/open', { date: today, today });
  assert.equal(r.created, false);
  assert.equal(r.page.id, todayPage.id);
});

await check('concurrent opens of a new date create one journal', async () => {
  const d = shiftDate(today, 40 + Math.floor(Math.random() * 300));
  const rs = await Promise.all([1, 2, 3].map(() => call('/notes/journals/open', { date: d, today })));
  assert.equal(new Set(rs.map((r) => r.page.id)).size, 1);
  const byDate = await call('/notes/journals/by-date', { date: d });
  assert.equal(byDate.items.length, 1);
});

await check('journal template fills date placeholders', async () => {
  const spaceId = todayPage.spaceId;
  const tpl = await call('/pages/create', {
    spaceId,
    title: 'Journal template (test)',
    format: 'markdown',
    content: '## Plan for {{date}}\n\nIt is {{weekday}}.',
  });
  await call('/notes/settings/update', { journalTemplatePageId: tpl.id });
  const d = shiftDate(today, -400 - Math.floor(Math.random() * 300));
  const r = await call('/notes/journals/open', { date: d, today });
  const page = await call('/pages/info', { pageId: r.page.id, format: 'markdown' });
  const body = typeof page.content === 'string' ? page.content : JSON.stringify(page.content);
  assert.match(body, new RegExp(`Plan for ${d}`));
  assert.doesNotMatch(body, /\{\{date\}\}/);
  await call('/notes/settings/update', { journalTemplatePageId: null });
});

await check('past journal gets that day as created date', async () => {
  const prior = await call('/notes/journals/by-date', { date: yesterday });
  for (const p of prior.items) await call('/notes/journals/set-date', { pageId: p.id, date: null });
  const r = await call('/notes/journals/open', { date: yesterday, today });
  assert.equal(new Date(r.page.createdAt).toISOString().slice(0, 10), yesterday);
});

await check('new untouched journal counts as empty and is filtered', async () => {
  const withEmpty = await call('/notes/journals/list', { includeEmpty: true, limit: 200 });
  const without = await call('/notes/journals/list', { includeEmpty: false, limit: 200 });
  assert.ok(withEmpty.items.some((i) => i.id === todayPage.id));
  assert.ok(!without.items.some((i) => i.id === todayPage.id));
});

await check('writing in a journal makes it non-empty', async () => {
  await call('/pages/update', {
    pageId: todayPage.id,
    content: 'Wrote something today.',
    format: 'markdown',
    operation: 'append',
  });
  // text_content is written by the collaboration persistence; give it a moment
  let found = false;
  for (let i = 0; i < 20 && !found; i++) {
    const list = await call('/notes/journals/list', { includeEmpty: false, limit: 200 });
    found = list.items.some((x) => x.id === todayPage.id);
    if (!found) await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(found, 'journal still empty after writing');
});

await check('month view marks days with journals', async () => {
  const m = await call('/notes/journals/month', { month: today.slice(0, 7) });
  assert.ok(m.days.some((d) => d.date === today && d.count === 1));
});

let normalPage;
await check('a normal page can be marked as a journal, causing a conflict', async () => {
  normalPage = await call('/pages/create', { spaceId: todayPage.spaceId, title: 'Imported note', format: 'markdown', content: 'Imported text.' });
  await call('/notes/journals/set-date', { pageId: normalPage.id, date: today });
  const info = await call('/notes/journals/info', { pageId: normalPage.id });
  assert.equal(info.journalDate, today);
  assert.equal(info.conflict, true);
  const m = await call('/notes/journals/month', { month: today.slice(0, 7) });
  assert.ok(m.days.find((d) => d.date === today).conflict);
});

await check('resolve conflict by merge keeps one journal and trashes the other', async () => {
  await call('/notes/journals/resolve', { date: today, keepPageId: todayPage.id, mode: 'merge' });
  const byDate = await call('/notes/journals/by-date', { date: today });
  assert.equal(byDate.items.length, 1);
  assert.equal(byDate.items[0].id, todayPage.id);
  const md = await call('/pages/info', { pageId: todayPage.id, format: 'markdown' });
  assert.match(String(md.content), /Imported text/);
});

await check('a journal can be turned back into a normal page', async () => {
  const p = await call('/pages/create', { spaceId: todayPage.spaceId, title: 'temp' });
  await call('/notes/journals/set-date', { pageId: p.id, date: shiftDate(today, 3) });
  await call('/notes/journals/set-date', { pageId: p.id, date: null });
  const info = await call('/notes/journals/info', { pageId: p.id });
  assert.equal(info.journalDate, null);
});

await check('day activity lists other pages edited today, not journals', async () => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const a = await call('/notes/journals/day-activity', { start: start.toISOString(), end: end.toISOString() });
  const ids = [...a.created, ...a.edited].map((x) => x.id);
  assert.ok(!ids.includes(todayPage.id));
});

await check('journals under the Journal page are ordered newest first', async () => {
  const base = shiftDate(today, -1000 - Math.floor(Math.random() * 500));
  const dates = [shiftDate(base, 2), shiftDate(base, 0), shiftDate(base, 1)];
  let parentId;
  for (const d of dates) {
    const r = await call('/notes/journals/open', { date: d, today });
    const info = await call('/pages/info', { pageId: r.page.id });
    parentId = info.parentPageId;
  }
  const res = await call('/pages/sidebar-pages', { spaceId: todayPage.spaceId, pageId: parentId, limit: 100 });
  const titles = (res.items ?? res).map((p) => p.title).filter((t) => dates.includes(t));
  assert.deepEqual(titles, [...dates].sort().reverse());
});

await check('invalid dates are rejected', async () => {
  await assert.rejects(call('/notes/journals/open', { date: '2026-02-30', today }));
});

let failed = 0;
for (const [name, result] of checks) {
  if (result !== 'ok') failed++;
  console.log(`${result === 'ok' ? 'PASS' : 'FAIL'}  ${name}${result === 'ok' ? '' : ` -> ${result}`}`);
}
console.log(`${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
