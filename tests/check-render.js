// 本地静态服务 + 探测：让页面以 http://127.0.0.1:PORT/@login 真实路径运行
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.resolve('.tmp');
// Edge 浏览器路径：必须通过 EDGE_PATH 环境变量提供
const EDGE = process.env.EDGE_PATH;
if (!EDGE) {
  console.log('FAIL 未设置 EDGE_PATH 环境变量');
  console.log('  例：$env:EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"');
  process.exit(2);
}
const PORT = 8799;

// 读取被测片段
const html = fs.readFileSync('custom/login-background.html', 'utf8');
const tail = html.split('\n').slice(203).join('\n');
const style = tail.match(/<style id="ol-login-bg-style">([\s\S]*?)<\/style>/)[1];
const script = tail.match(/<script>([\s\S]*?)<\/script>/)[1];

let page = fs.readFileSync(path.join(ROOT, 'verify-blur.html'), 'utf8');
page = page.replace(
  '<!-- ========== 被测代码：custom/login-background.html 中第 204 行之后的两个区块 ========== -->\n<!-- 下面两个区块由验证脚本自动注入，此处仅占位 -->',
  '<style id="ol-login-bg-style">' + style + '</style>\n<script>\n' + script + '\n</script>'
);
// 复现页注入测试壁纸：被测脚本默认留空，此处单独提供 URL 以验证「填了 URL 才生效」分支
// 用 html:root 提升特异性，避免被被测脚本的 :root{--ol-lbg-*:url("")} 覆盖
page = page.replace(
  '</head>',
  '<style>html:root{--ol-lbg-light:url("/test-light.png");--ol-lbg-dark:url("/test-dark.png")}</style></head>'
);

// 采样脚本：把多时点状态写回 data-probe
page = page.replace('</body>', `<script>
(function () {
  var samples = [];
  function snap(tag) {
    var layer = document.getElementById('ol-login-bg');
    var o = { t: tag };
    if (layer) {
      var cs = getComputedStyle(layer);
      var af = getComputedStyle(layer, '::after');
      o.exists = true;
      o.active = layer.getAttribute('data-ol-active') || '';
      o.theme = layer.getAttribute('data-ol-theme') || '';
      o.loginMark = layer.getAttribute('data-ol-login') || '';
      // 单层架构：filter 与 background-image 都在 #ol-login-bg 自身
      o.layerFilter = cs.filter;
      o.layerTransform = cs.transform;
      o.layerBg = (cs.backgroundImage || '').slice(0, 40);
      o.afterVis = af.visibility;
      o.afterBg = (af.backgroundImage || '').slice(0, 90);
    } else { o.exists = false; }
    var lbg = document.querySelector('.loginbg');
    o.lbgDisplay = lbg ? getComputedStyle(lbg).display : 'missing';
    samples.push(o);
    // base64 传输，规避 --dump-dom 的引号转义问题
    document.body.setAttribute('data-probe', btoa(unescape(encodeURIComponent(JSON.stringify(samples)))));
  }
  snap('init');
  [200, 500, 900, 1400].forEach(function (ms, i) {
    setTimeout(function () { snap('t' + ms); }, ms);
  });
  // 模拟原生主题切换：改 body 类（真实站点由此触发 #root 子树重建）
  setTimeout(function () {
    document.body.classList.remove('hope-ui-light');
    document.body.classList.add('hope-ui-dark');
    snap('dark-immediate');
  }, 1800);
  // 轮询兜底（250ms）后应已补齐
  setTimeout(function () { snap('dark-settled'); }, 2200);
  setTimeout(function () {
    document.body.classList.remove('hope-ui-dark');
    document.body.classList.add('hope-ui-light');
    snap('light-immediate');
  }, 2600);
  setTimeout(function () { snap('light-settled'); }, 3000);
  setTimeout(function () { snap('final'); }, 3400);
})();
<\/script></body>`);

fs.writeFileSync(path.join(ROOT, 'verify-run.html'), page, 'utf8');

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  if (p === '/' || p === '/@login' || p === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page);
  } else {
    res.writeHead(404); res.end('nf');
  }
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log('serving on ' + PORT);
  const url = 'http://127.0.0.1:' + PORT + '/@login';
  const out = await new Promise(resolve => {
    execFile(EDGE, [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--virtual-time-budget=3500',
      '--user-data-dir=' + path.resolve('.tmp/edge-profile'),
      '--dump-dom', url
    ], { maxBuffer: 20 * 1024 * 1024 }, (e, so) => resolve(e ? '' : so));
  });
  server.close();
  const m = out.match(/data-probe="([^"]*)"/);
  if (!m) { console.log('NO_PROBE'); process.exit(3); }
  // base64 解码
  let samples;
  try {
    const b64 = m[1].replace(/"/g, '"').replace(/&/g, '&');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    samples = JSON.parse(json);
  } catch (e) { console.log('PARSE_FAIL ' + m[1].slice(0, 300)); process.exit(4); }
  for (const s of samples) console.log(JSON.stringify(s));
  // 断言
  const last = samples[samples.length - 1];
  const darkSettled = samples.find(s => s.t === 'dark-settled');
  const darkNow = samples.find(s => s.t === 'dark-immediate');
  const lightSettled = samples.find(s => s.t === 'light-settled');
  let ok = true;
  // 只断言结构性属性（filter / transform / gradient / active 态），
  // 这些不受 opacity transition 数值影响，可稳定验证
  const checks = [
    ['壁纸层已创建', last.exists === true],
    ['登录页标记 data-ol-login=1', last.loginMark === '1'],
    ['初始激活态为 1', last.active === '1'],
    ['模糊 filter=blur(5px) 生效', /blur\(5px\)/.test(last.layerFilter || '')],
    ['scale(1.06) 边缘补偿生效', /matrix\(1\.06/.test(last.layerTransform || '')],
    ['壁纸 URL 已挂载', /url\(/.test(last.layerBg || '')],
    ['暗角层可见（::after visibility）', last.afterVis === 'visible'],
    ['暗角含 rgba(0,0,0,0.35)', /rgba\(0,\s*0,\s*0,\s*0\.35\)/.test(last.afterBg || '')],
    ['切深色后即时挂载壁纸层', darkNow && darkNow.exists === true],
    ['深色稳定后仍激活', darkSettled && darkSettled.active === '1'],
    ['深色稳定后模糊保持', darkSettled && /blur\(5px\)/.test(darkSettled.layerFilter || '')],
    ['深色稳定后 scale 保持', darkSettled && /matrix\(1\.06/.test(darkSettled.layerTransform || '')],
    ['深色稳定后暗角层可见', darkSettled && darkSettled.afterVis === 'visible'],
    ['深色稳定后壁纸 URL 已挂载', darkSettled && /url\(/.test(darkSettled.layerBg || '')],
    ['浅色恢复后激活', lightSettled && lightSettled.active === '1'],
    ['浅色恢复后暗角层可见', lightSettled && lightSettled.afterVis === 'visible'],
    ['浅色恢复后壁纸 URL 已挂载', lightSettled && /url\(/.test(lightSettled.layerBg || '')],
    ['波浪层被隐藏', last.lbgDisplay === 'none']
  ];
  for (const [n, p] of checks) { if (!p) ok = false; console.log((p ? 'PASS' : 'FAIL') + '  ' + n); }
  console.log(ok ? 'ALL PASS' : 'HAS FAILURES');
  process.exit(ok ? 0 : 1);
});
