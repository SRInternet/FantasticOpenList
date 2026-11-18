// 结构校验：custom/login-background.html（对应用户修复后的单层 filter + scale 架构）
const fs = require('fs');
const html = fs.readFileSync('custom/login-background.html', 'utf8');

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);

if (scripts.length !== 2) { console.log('FAIL  script blocks = ' + scripts.length + ' (expect 2)'); process.exit(1); }
if (styles.length !== 2) { console.log('FAIL  style blocks = ' + styles.length + ' (expect 2)'); process.exit(1); }

const [origScript, newScript] = scripts;
const [origStyle, newStyle] = styles;
fs.writeFileSync('.tmp/final-a.js', origScript);
fs.writeFileSync('.tmp/final-b.js', newScript);

for (const [i, css] of styles.entries()) {
  let d = 0;
  for (const c of css) { if (c === '{') d++; if (c === '}') d--; }
  console.log((d === 0 ? 'PASS' : 'FAIL') + `  style#${i + 1} brace balance = ${d}`);
}

// 原有代码零改动验证（第 204 行之前）
const origChecks = [
  ['原有 #ol-bg-layer 规则保留', origStyle.includes('#ol-bg-layer {')],
  ['原有主题按钮样式保留', origStyle.includes('button#custom-theme-toggle')],
  ['原有毛玻璃 obj-box 规则保留', origStyle.includes('.obj-box')],
  ['原有 #custom-theme-toggle 脚本保留', origScript.includes('custom-theme-toggle')],
  ['原有 localStorage key 保留', origScript.includes('openlist-custom-theme')],
  ['原有 MutationObserver 保活保留', origScript.includes('observer.observe(document.body')],
  ['原有脚本未被注入新逻辑', !origScript.includes('ol-login-bg') && !origScript.includes('ol-lbg-hidden')]
];

// 新增段检查（对齐用户修复后的架构）
const checks = [
  ['隐藏规则 display:none !important', newStyle.includes('display: none !important')],
  ['壁纸层 z-index:-1', newStyle.includes('z-index: -1')],
  ['blur 变量驱动 filter', newStyle.includes('filter: blur(var(--ol-lbg-blur))')],
  ['scale 补偿模糊边缘', newStyle.includes('transform: scale(1.06)')],
  ['暗角伪元素渐变', newStyle.includes('radial-gradient')],
  ['暗角变量接入', newStyle.includes('var(--ol-lbg-overlay)')],
  ['深浅主题切换 .hope-ui-light', newStyle.includes('.hope-ui-light #ol-login-bg')],
  ['深浅主题切换 .hope-ui-dark', newStyle.includes('.hope-ui-dark #ol-login-bg')],
  ['prefers-reduced-motion 兜底', newStyle.includes('prefers-reduced-motion')],
  [':has 兜底受 data-ol-login 约束', /body:has\(#ol-login-bg\[data-ol-login="1"\]\)/.test(newStyle)],
  ['@supports selector 保护', newStyle.includes('@supports selector(:has(*))')],
  ['壁纸层插在 #ol-bg-layer 之后', newScript.includes('host.insertBefore(layer, oldBg.nextSibling)')],
  ['插入位置幂等保护', newScript.includes('layer.previousElementSibling !== oldBg')],
  ['离开路由还原补丁（removePatches）', newScript.includes('function removePatches()') && newScript.includes('removePatches();')],
  ['teardown 保留供调试', newScript.includes('function teardown()')],
  ['主题监听同时观察 childList', newScript.includes('childList: true')],
  ['主题重建触发 guard()', /childList[\s\S]{0,160}guard\(\)/.test(newScript)],
  ['轮询 250ms', newScript.includes('setInterval(guard, 250)')],
  ['路由 hook 去重', newScript.includes('routerHooked')],
  ['popstate/hashchange 解绑', newScript.includes('removeEventListener("popstate"') && newScript.includes('removeEventListener("hashchange"')],
  ['防重复注入', newScript.includes('__OL_LOGIN_BG_BOOTED__')],
  ['LoginBg 结构化定位（含 svg 无表单）', newScript.includes('querySelector("svg")')],
  ['input[name=username] 定位', newScript.includes('input[name=username]')],
  ['无 console.log 残留', !newScript.includes('console.log')],
  ['新增段无哈希类名依赖', !/hope-c-[A-Za-z0-9]{4}/.test(newScript + newStyle)],
  ['未新建主题按钮', !newScript.includes('custom-theme-toggle')],
  ['未覆写 #ol-bg-layer 样式', !newStyle.match(/#ol-bg-layer\s*\{/) && !newScript.includes('ol-bg-layer.style')]
];

let ok = true;
for (const [n, p] of checks) { if (!p) ok = false; console.log((p ? 'PASS' : 'FAIL') + '  ' + n); }
for (const [n, p] of origChecks) { if (!p) ok = false; console.log((p ? 'PASS' : 'FAIL') + '  ' + n); }
console.log(ok ? 'ALL PASS' : 'HAS FAILURES');
process.exit(ok ? 0 : 1);
