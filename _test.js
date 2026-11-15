// 逻辑冒烟测试：用最小 DOM 桩在 Node 里跑 index.html 里的脚本
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(
  fs.existsSync('index.html') ? 'index.html' : 'knowledge/index.html',
  'utf8'
);
const i = html.lastIndexOf('<script>');
const j = html.lastIndexOf('</script>');
const code = html.slice(i + 8, j);

// ---- DOM 桩 ----
const els = {};
function makeEl(id) {
  return {
    id, innerHTML: '', textContent: '', value: '', style: {},
    classList: { add(){}, remove(){}, toggle(){} },
    dataset: {}, focus(){}, click(){}, appendChild(){}, removeChild(){},
    insertAdjacentHTML(){},
  };
}
global.document = {
  getElementById(id) {
    if (!els[id]) els[id] = makeEl(id);
    return els[id];
  },
  querySelectorAll() { return []; },
  createElement() { return makeEl('tmp'); },
  body: makeEl('body'),
};
global.window = { scrollTo(){}, localStorage: null };
const store = new Map();
global.localStorage = {
  setItem(k, v) { store.set(k, String(v)); },
  getItem(k) { return store.has(k) ? store.get(k) : null; },
  removeItem(k) { store.delete(k); },
};
global.setInterval = () => 0;
global.setTimeout = (fn) => 0;
global.clearTimeout = () => {};
global.confirm = () => true;
global.Blob = class { constructor(a) { this.a = a; } };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL(){} };
global.FileReader = class { readAsText(){} };

// ---- 断言，追加到同一作用域内执行 ----
const tests = `
(function(){
  const R = [];
  const ok = (name, cond, extra) => R.push((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  <-- ' + (extra||'')));

  // 1. 数据结构
  ok('DAILY 条数不少于 24', DAILY.length >= 24, 'got ' + DAILY.length);
  let bad = [];
  DAILY.forEach((d, n) => {
    if (!d.track || !d.title || !d.hook) bad.push(n + ':missing-basic');
    if (!Array.isArray(d.reads) || d.reads.length !== 3) bad.push(n + ':reads');
    if (!Array.isArray(d.quiz) || d.quiz.length !== 3) bad.push(n + ':quiz');
    if (!d.link) bad.push(n + ':link');
  });
  ok('每条内容字段完整', bad.length === 0, bad.join(','));

  const tracks = [...new Set(DAILY.map(d => d.track))];
  ok('主题覆盖 4 类', tracks.length === 4, tracks.join('/'));
  ok('同日主题连续不重复', (function(){
    for (let k = 0; k < DAILY.length - 1; k++) if (DAILY[k].track === DAILY[k+1].track && DAILY[k].track === DAILY[k+2] && DAILY[k+2]) return false;
    return true;
  })());

  // 2. 今日渲染
  renderToday();
  const body = document.getElementById('todayBody').innerHTML;
  ok('今日渲染出标题', body.includes('<h1>'));
  ok('今日有三段', body.includes('输入（挑一个') && body.includes('自测（合上材料') && body.includes('连线'));
  ok('日期已填充', document.getElementById('hdDate').textContent.includes('周'));

  // 3. 初始卡片
  const seeds = load();
  ok('初始 5 张卡', seeds.length === 5, 'got ' + seeds.length);
  ok('初始卡都带解释', seeds.every(c => c.e && c.t));
  ok('初始卡默认明天到期', seeds.every(c => c.due > Date.now()));

  // 4. 复习：全部到期
  let list = load();
  list.forEach(c => c.due = Date.now() - 1000);
  save(list);
  restartReview();
  let rv = document.getElementById('reviewBody').innerHTML;
  ok('到期后进入复习队列', rv.includes('1 / 5'), rv.slice(0, 120));

  // 5. 评分推进：连点 5 次「讲得出来」
  for (let n = 0; n < 5; n++) grade(true);
  rv = document.getElementById('reviewBody').innerHTML;
  ok('5 张过完后显示结束', rv.includes('过完了'), rv.slice(0, 120));
  list = load();
  ok('5 张都升到 stage 1', list.every(c => c.stage === 1), JSON.stringify(list.map(c => c.stage)));
  ok('间隔推到约 1 天后', list.every(c => c.due - Date.now() > 20 * 3600 * 1000));
  ok('越界不崩', (function(){ grade(true); grade(false); return true; })());

  // 6. 打回逻辑
  list = load();
  list.forEach(c => c.due = Date.now() - 1000);
  list[0].stage = 3;
  save(list);
  restartReview();
  grade(false);
  const first = load().find(c => c.stage === 0 && c.due < Date.now() + 2 * 86400000);
  ok('讲不出来打回 stage 0 且一天内再考', !!first, JSON.stringify(load().map(c => [c.stage, Math.round((c.due - Date.now())/3600000)])));

  // 7. 新增卡片
  const before = load().length;
  document.getElementById('f-t').value = '测试概念';
  document.getElementById('f-e').value = '这是我自己写的一句解释';
  document.getElementById('f-x').value = '例子';
  document.getElementById('f-r').value = '连到 X';
  saveCard();
  ok('新增卡片成功', load().length === before + 1, 'before ' + before);
  ok('新卡明天到期', load()[0].due > Date.now() + 20 * 3600 * 1000);

  // 8. 空标题不落库
  const n0 = load().length;
  document.getElementById('f-t').value = '';
  document.getElementById('f-e').value = 'x';
  saveCard();
  ok('空概念名被拒绝', load().length === n0);

  // 9. 转义
  ok('HTML 被转义', esc('<script>&"') === '&lt;script&gt;&amp;&quot;');

  global.__R = R;
})();
`;

vm.runInThisContext(code + '\n' + tests, { filename: 'app.js' });
const R = globalThis.__R || [];
console.log(R.join('\n'));
const fails = R.filter(r => r.startsWith('FAIL'));
console.log('\n' + (R.length - fails.length) + '/' + R.length + ' passed');
process.exit(fails.length ? 1 : 0);
