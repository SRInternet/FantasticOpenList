// 私有属性检查：确保脚本与文档中不含私有路径、站点域名、内部目录名等
// 用法: node tests/check-secrets.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 参与发布的文件
const files = [
  'custom/login-background.html',
  'README.md',
  '.gitignore',
  'docs/login-page-analysis.md',
  'tests/check-structure.js',
  'tests/check-render.js',
  'tests/check-perf.js',
  'tests/check-readme.js',
  'tests/check-secrets.js',
  'tests/README.md'
];

// 私有特征：内部目录、编码路径、本地绝对路径、Token 样式串
// 说明：站点域名与 Edge 默认安装路径不在其列，
//       前者是分析文档的必要信息，后者是测试脚本的标准默认值
const patterns = [
  { name: 'OpenList 内部存储路径 /d/', re: /\/d\/[A-Za-z]/ },
  { name: 'URL 编码中文路径', re: /%E[0-9A-F]{2}/i },
  { name: '用户名目录', re: /\/Users\/[A-Za-z]/ },
  { name: 'API Token 样式', re: /(api[_-]?key|token|secret|password)\s*[:=]\s*["'][A-Za-z0-9]{16,}/i }
];

let ok = true;
const hits = [];

for (const rel of files) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.log('SKIP  ' + rel + ' (不存在)');
    continue;
  }
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const p of patterns) {
      if (p.re.test(line)) {
        hits.push(rel + ':' + (i + 1) + '  [' + p.name + ']  ' + line.trim().slice(0, 80));
        ok = false;
      }
    }
  });
}

if (hits.length) {
  console.log('FAIL 发现 ' + hits.length + ' 处私有特征:');
  for (const h of hits) console.log('  ' + h);
} else {
  console.log('PASS 未发现私有特征（' + files.length + ' 个文件）');
}

// .tmp 必须被忽略
const gi = fs.existsSync(path.join(ROOT, '.gitignore'))
  ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8')
  : '';
const ignored = /^\.tmp\/?$/m.test(gi);
console.log(ignored ? 'PASS .tmp/ 已在 .gitignore 中' : 'FAIL .tmp/ 未被 .gitignore 忽略');
if (!ignored) ok = false;

process.exit(ok ? 0 : 1);
