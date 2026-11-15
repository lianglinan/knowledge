// 逻辑冒烟测试：用最小 DOM 桩在 Node 里跑 data.js + index.html 的脚本
const fs = require('fs');
const vm = require('vm');

const base = fs.existsSync('index.html') ? '.' : 'knowledge';
const html = fs.readFileSync(base + '/index.html', 'utf8');
const data = fs.readFileSync(base + '/data.js', 'utf8');

const i = html.lastIndexOf('<script>');
const j = html.lastIndexOf('</script>');
const app = html.slice(i + 8, j);

// ---- DOM 桩 ----
const els = {};
function makeEl(id) {
  return {
    id, innerHTML: '', textContent: '', value: '', style: {},
    classList: { add(){}, remove(){}, toggle(){} },
    dataset: {}, focus(){}, click(){}, appendChild(){}, removeChild(){},
    insertAdjacentHTML(pos, h){ this.innerHTML += h; },
  };
}
global.document = {
  getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
  querySelectorAll() { return []; },
  createElement() { return makeEl('tmp'); },
  body: makeEl('body'),
};
global.window = { scrollTo(){} };
const store = new Map();
global.localStorage = {
  setItem(k, v) { store.set(k, String(v)); },
  getItem(k) { return store.has(k) ? store.get(k) : null; },
  removeItem(k) { store.delete(k); },
};
global.setInterval = () => 0;
global.setTimeout = () => 0;
global.clearTimeout = () => {};
global.confirm = () => true;
global.Blob = class {};
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL(){} };
global.FileReader = class { readAsText(){} };

const tests = `
(function(){
  const R = [];
  const ok = (name, cond, extra) => R.push((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  <-- ' + (extra||'')));
  const day = 20000;

  /* ---- 内容池 ---- */
  ok('领域数为 26', DKEYS.length === 26, DKEYS.length + ': ' + DKEYS.join('/'));

  let badField = [];
  DKEYS.forEach(k => {
    const items = dmeta(k).items;
    if (items.length < 6) badField.push(k + ':only ' + items.length);
    items.forEach((it, n) => {
      if (!it.t || !it.h) badField.push(k + '[' + n + ']:basic');
      if (!Array.isArray(it.r) || it.r.length !== 3) badField.push(k + '[' + n + ']:r');
      if (!Array.isArray(it.q) || it.q.length !== 3) badField.push(k + '[' + n + ']:q');
      if (!it.l) badField.push(k + '[' + n + ']:l');
    });
  });
  ok('每条字段完整（4 字段 + 3 输入 + 3 自测）', badField.length === 0, badField.slice(0,6).join(','));

  const total = DKEYS.reduce((s,k) => s + dmeta(k).items.length, 0);
  ok('总条目 >= 156', total >= 156, 'got ' + total);

  const titles = [];
  DKEYS.forEach(k => dmeta(k).items.forEach(it => titles.push(it.t)));
  const dupes = titles.filter((t,n) => titles.indexOf(t) !== n);
  ok('全局标题无重复', dupes.length === 0, dupes.join(' | '));

  DKEYS.forEach(k => {
    const t = dmeta(k).items.map(x => x.t);
    const d = t.filter((x,n) => t.indexOf(x) !== n);
    if (d.length) badField.push(k + ':dup');
  });
  ok('领域内标题无重复', !badField.includes(k => false) && badField.filter(x => x.endsWith(':dup')).length === 0, '');
  ok('每个领域都有配色', DKEYS.every(k => /^#[0-9a-f]{6}$/i.test(dmeta(k).color)));

  /* ---- 每日组合 ---- */
  const d1 = digestFor(day, 0, 'all');
  const d2 = digestFor(day, 0, 'all');
  ok('每天 8 条', d1.length === 8, 'got ' + d1.length);
  ok('同一天结果稳定', JSON.stringify(d1) === JSON.stringify(d2));
  ok('当天领域不重复', new Set(d1.map(x => x.domain)).size === 8);
  ok('次日组合不同', JSON.stringify(digestFor(day+1,0,'all')) !== JSON.stringify(d1));

  const seen = new Set();
  for (let n = 0; n < 30; n++) digestFor(day + n, 0, 'all').forEach(x => seen.add(x.domain));
  ok('30 天内覆盖全部领域', seen.size === DKEYS.length, seen.size + '/' + DKEYS.length);

  // 整池轮完之前不应出现重复条目
  const shown = [];
  const fullDays = Math.floor(total / 8);
  for (let n = 0; n < fullDays; n++) digestFor(day + n, 0, 'all').forEach(x => shown.push(x.item.t));
  const dupShown = shown.filter((t,n) => shown.indexOf(t) !== n);
  ok('轮完一遍前无重复（' + fullDays + ' 天）', dupShown.length === 0, dupShown.slice(0,3).join(' | '));

  const allShown = new Set();
  for (let n = 0; n < fullDays + 1; n++) digestFor(day + n, 0, 'all').forEach(x => allShown.add(x.item.t));
  ok('轮完后全部条目都出现过', allShown.size === total, allShown.size + '/' + total);

  ok('按领域筛选只返回该领域', (function(){
    const f = digestFor(day, 0, '金融');
    return f.length <= 1 && f.every(x => x.domain === '金融');
  })());
  ok('筛选到未排到的领域时返回空且不崩', digestFor(day, 0, '不存在的领域').length === 0);
  ok('换一批会改变组合', JSON.stringify(digestFor(day,1,'all')) !== JSON.stringify(d1));

  /* ---- 渲染 ---- */
  renderChips();
  ok('筛选条渲染出 ' + (DKEYS.length+1) + ' 个 chip', (document.getElementById('chips').innerHTML.match(/class="chip/g)||[]).length === DKEYS.length + 1);
  renderToday();
  const body = document.getElementById('todayBody').innerHTML;
  ok('今日渲染出 8 个条目', (body.match(/class="item /g)||[]).length === 8, 'got ' + (body.match(/class="item /g)||[]).length);
  ok('进度显示 已读 0 / 8', document.getElementById('hdCount').textContent === '已读 0 / 8', document.getElementById('hdCount').textContent);
  ok('进度条宽度为 0', document.getElementById('hbarFill').style.width === '0%');
  ok('折叠时不渲染题目', !body.includes('自测（合上材料再答）'));

  // 页面渲染的是「今天」，所以断言要用今天的组合，而不是上面固定 day 的组合
  const first = CURRENT[0].item.t;
  toggleItem(0);
  const body2 = document.getElementById('todayBody').innerHTML;
  ok('展开后渲染出输入与自测', body2.includes('自测（合上材料再答）') && body2.includes('输入（挑一个'));
  ok('展开状态可关闭', (function(){ toggleItem(0); return !document.getElementById('todayBody').innerHTML.includes('自测（合上材料再答）'); })());
  ok('事件用索引而非标题', document.getElementById('todayBody').innerHTML.includes('onclick="toggleItem(0)"'));
  ok('越界索引不崩', (function(){ toggleItem(99); markRead(99,false); return true; })());

  /* ---- 阅读进度 ---- */
  setRead(first, true);
  ok('已读写入今天的记录', readSet().has(first));
  ok('只记今天的日期', Object.keys(loadRead()).length === 1, Object.keys(loadRead()).join(','));
  renderToday();
  ok('进度变成 1 / 8', document.getElementById('hdCount').textContent === '已读 1 / 8', document.getElementById('hdCount').textContent);
  ok('进度条 12.5%', document.getElementById('hbarFill').style.width === '12.5%', document.getElementById('hbarFill').style.width);
  setRead(first, false);
  ok('撤销已读', !readSet().has(first));
  ok('未读数回到 8', (function(){ renderToday(); return document.getElementById('hdCount').textContent === '已读 0 / 8'; })());

  /* ---- 卡片 ---- */
  const seeds = loadCards();
  ok('初始 4 张卡', seeds.length === 4, 'got ' + seeds.length);
  ok('初始卡默认明天到期', seeds.every(c => c.due > Date.now()));

  let list = loadCards();
  list.forEach(c => c.due = Date.now() - 1000);
  saveCards(list);
  restartReview();
  ok('到期后进入复习队列', document.getElementById('reviewBody').innerHTML.includes('1 / 4'));

  for (let n = 0; n < 4; n++) grade(true);
  ok('4 张过完显示结束', document.getElementById('reviewBody').innerHTML.includes('过完了'));
  ok('间隔推到约 1 天后', loadCards().every(c => c.stage === 1 && c.due - Date.now() > 20*3600*1000));

  list = loadCards();
  list.forEach(c => c.due = Date.now() - 1000);
  list[0].stage = 3;
  saveCards(list);
  restartReview();
  grade(false);
  ok('讲不出来打回 stage 0', loadCards().some(c => c.stage === 0));

  document.getElementById('f-t').value = '测试概念';
  document.getElementById('f-e').value = '这是我自己写的一句解释';
  saveCard();
  ok('新增卡片成功', loadCards().length === 5);
  ok('新卡排在第一位', loadCards()[0].t === '测试概念');

  const n0 = loadCards().length;
  document.getElementById('f-t').value = '只有名字';
  document.getElementById('f-e').value = '';
  saveCard();
  ok('空解释被拒绝', loadCards().length === n0);

  /* ---- 其他 ---- */
  ok('HTML 转义', esc('<script>&"') === '&lt;script&gt;&amp;&quot;');
  renderCorpus();
  ok('内容规模统计正常', document.getElementById('corpusInfo').innerHTML.includes(DKEYS.length + ' 个领域'));

  global.__R = R;
})();
`;

vm.runInThisContext(data + '\n' + app + '\n' + tests, { filename: 'app.js' });
const R = globalThis.__R || [];
console.log(R.join('\n'));
const fails = R.filter(r => r.startsWith('FAIL'));
console.log('\n' + (R.length - fails.length) + '/' + R.length + ' passed');
process.exit(fails.length ? 1 : 0);
