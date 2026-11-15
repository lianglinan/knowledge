// 从 data.js 生成内容目录，避免手抄出错。
// 用法：node _gen_catalog.js
const vm = require('vm');
const fs = require('fs');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/data.js', 'utf8') + '\n;globalThis.__D = DOMAINS;', ctx);
const D = ctx.__D;
const keys = Object.keys(D);

const counts = keys.map(k => D[k].items.length);
const total = counts.reduce((a, b) => a + b, 0);
const out = [];

out.push('# 内容目录');
out.push('');
out.push('> 本文件由 `node _gen_catalog.js` 从 `data.js` 自动生成，**不要手改**。');
out.push('> 改了内容之后重新跑一次脚本即可。');
out.push('');
out.push('**' + keys.length + ' 个领域 · ' + total + ' 条 · 每天 8 条 · 轮完一遍 ' +
  (total / 8).toFixed(1) + ' 天**');
out.push('');
out.push('用途：加新条目之前先在这里搜一下关键词，避免和已有条目撞车。');
out.push('');

out.push('## 目录');
out.push('');
keys.forEach((k, i) => {
  out.push((i + 1) + '. [' + k + '](#' + encodeURIComponent(k) + ')' +
    '（' + D[k].items.length + ' 条）');
});
out.push('');

keys.forEach(k => {
  const items = D[k].items;
  out.push('## ' + k);
  out.push('');
  out.push('`' + D[k].color + '` · ' + items.length + ' 条');
  out.push('');
  out.push('| # | 标题 | 钩子 |');
  out.push('|---|---|---|');
  items.forEach((it, n) => {
    const h = String(it.h || '').replace(/\|/g, '\\|');
    out.push('| ' + (n + 1) + ' | ' + it.t + ' | ' + h + ' |');
  });
  out.push('');
});

fs.writeFileSync(__dirname + '/CONTENT.md', out.join('\n'), 'utf8');
console.log('已生成 CONTENT.md：' + keys.length + ' 个领域，' + total + ' 条');
