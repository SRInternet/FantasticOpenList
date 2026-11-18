// README 与代码一致性校验
const fs = require('fs');
const html = fs.readFileSync('custom/login-background.html', 'utf8');
// 去掉末尾换行再计数，避免编辑器追加的空行导致偏差
const htmlLines = html.replace(/\n$/, '').split('\n');
const md = fs.readFileSync('README.md', 'utf8');

// 1. 提取 README 中所有锚点行号
const anchors = [...md.matchAll(/custom\/login-background\.html#L(\d+)/g)].map(m => parseInt(m[1], 10));
const uniq = [...new Set(anchors)].sort((a, b) => a - b);

// 2. 每个锚点所在行必须是注释或分区起始（非空、非纯代码）
const bad = [];
for (const n of uniq) {
  const line = (htmlLines[n - 1] || '').trim();
  if (!line.startsWith('/*') && !line.startsWith('<!--') && !line.startsWith(':root') && !line.startsWith('#ol-login-bg') && !line.startsWith('.ol-lbg-hidden')) {
    bad.push(n + ' -> ' + line.slice(0, 60));
  }
}
console.log('锚点数量: ' + uniq.length);
console.log(bad.length ? 'FAIL 以下锚点未命中分区起始:\n' + bad.join('\n') : 'PASS 所有锚点均命中分区起始');

// 3. 总行数一致
const total = htmlLines.length;
const mTotal = md.match(/(?:共\s*)?(\d+)\s*行/);
console.log((mTotal && parseInt(mTotal[1], 10) === total ? 'PASS' : 'FAIL') + ' README 声明总行数 ' + (mTotal ? mTotal[1] : '?') + ' vs 实际 ' + total);
if (!mTotal || parseInt(mTotal[1], 10) !== total) ok = false;

// 4. 分区数量一致
const cssSections = (html.match(/\/\* ={5,}[^*]*={5,} \*\//g) || []).length;
const jsSubSections = (html.match(/\/\* -{5,}[^*-]*-{5,} \*\//g) || []).length;
console.log('CSS 级分区注释: ' + cssSections + '，JS 子分区注释: ' + jsSubSections);

// 5. 注释规范：无过程性描述、无目的/原因表述
const forbidden = [
  /之前有\s*bug/i, /修复了.*bug/i, /踩坑记录/i, /临时/i, /TODO/i, /FIXME/i, /XXX/i, /debugger/,
  /确保/i, /避免/i, /防止/i, /从而/i, /以便/i, /使得/i, /因此/i, /因为/i, /原因是/i, /目的在于/i
];
const hits = [];
for (const [i, l] of htmlLines.entries()) {
  const t = l.trim();
  if (!t.startsWith('/*') && !t.startsWith('*') && !t.startsWith('<!--')) continue;
  for (const f of forbidden) if (f.test(t)) hits.push((i + 1) + ': ' + t.slice(0, 70));
}
console.log(hits.length ? 'FAIL 注释含过程性或目的性表述:\n' + hits.join('\n') : 'PASS 注释仅客观描述');
if (hits.length) ok = false;

// 6. 无 console.log
console.log(html.includes('console.log') ? 'FAIL 存在 console.log' : 'PASS 无 console.log');

// 7. README 必备章节
const sections = ['## 使用方法', '## 简要原理解析', '## 常见问题', '## 代码快速跳转'];
const missing = sections.filter(s => !md.includes(s));
console.log(missing.length ? 'FAIL README 缺章节: ' + missing.join(', ') : 'PASS README 四章齐备');

// 8. 教学性 / 说教性语言检查
const teach = [/我们可以/, /接下来让我们/, /让我们/, /请注意/, /需要 ensure/i, /为了避免/i, /以确保/i, /从而确保/i, /为了防止/i];
const teachHits = [];
md.split('\n').forEach((l, i) => {
  for (const t of teach) if (t.test(l)) teachHits.push((i + 1) + ': ' + l.trim().slice(0, 70));
});
console.log(teachHits.length ? 'FAIL README 含教学性语言:\n' + teachHits.join('\n') : 'PASS README 无教学性语言');
if (teachHits.length) ok = false;
