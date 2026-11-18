// 性能回归验证：确认 blur/暗角修复未重新引入卡顿
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
const PORT = 8801;

const html = fs.readFileSync('custom/login-background.html', 'utf8');
const tail = html.split('\n').slice(203).join('\n');
const style = tail.match(/<style id="ol-login-bg-style">([\s\S]*?)<\/style>/)[1];
const script = tail.match(/<script>([\s\S]*?)<\/script>/)[1];

let page = fs.readFileSync(path.join(ROOT, 'verify-blur.html'), 'utf8');
page = page.replace(
  '<!-- ========== 被测代码：custom/login-background.html 中第 204 行之后的两个区块 ========== -->\n<!-- 下面两个区块由验证脚本自动注入，此处仅占位 -->',
  '<style id="ol-login-bg-style">' + style + '</style>\n<script>\n' + script + '\n</script>'
);

// 性能采样：longtask 计数 + 强制重排探测（确定性指标，不依赖 rAF 连续运行）
page = page.replace('</body>', `<script>
(function () {
  var longTasks = 0;
  try {
    new PerformanceObserver(function (list) {
      longTasks += list.getEntries().length;
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}

  // 反复读取 offsetTop 触发可能的强制同步布局，统计耗时
  var reflowCost = 0;
  var probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;height:1px';
  document.body.appendChild(probe);

  function measure() {
    var t0 = performance.now();
    for (var i = 0; i < 200; i++) {
      probe.style.top = (i % 50) + 'px';
      void probe.offsetTop; // 强制同步布局
    }
    reflowCost = performance.now() - t0;
    probe.remove();
  }

  setTimeout(function () {
    measure();
    var o = {
      longTasks: longTasks,
      reflowCostMs: Math.round(reflowCost * 100) / 100,
      domNodes: document.querySelectorAll('*').length,
      bodyChildren: document.body.children.length
    };
    document.body.setAttribute('data-perf', btoa(unescape(encodeURIComponent(JSON.stringify(o)))));
  }, 2500);
})();
<\/script></body>`);

fs.writeFileSync(path.join(ROOT, 'perf-run.html'), page, 'utf8');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});

server.listen(PORT, '127.0.0.1', async () => {
  const out = await new Promise(resolve => {
    execFile(EDGE, [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--virtual-time-budget=6000',
      '--user-data-dir=' + path.resolve('.tmp/edge-profile'),
      '--dump-dom', 'http://127.0.0.1:' + PORT + '/@login'
    ], { maxBuffer: 20 * 1024 * 1024 }, (e, so) => resolve(e ? '' : so));
  });
  server.close();
  const m = out.match(/data-perf="([^"]*)"/);
  if (!m) { console.log('NO_PERF'); process.exit(3); }
  const perf = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
  console.log(JSON.stringify(perf, null, 2));
  // 断言：
  // 1) 无 longtask（无超过 50ms 的主线程阻塞）
  // 2) 200 次强制布局总耗时应远低于 50ms（无布局抖动）
  // 3) DOM 节点数未因三层结构而膨胀
  const ok = perf.longTasks === 0 && perf.reflowCostMs < 50 && perf.domNodes < 60;
  console.log('longtask 数量: ' + perf.longTasks + ' (期望 0)');
  console.log('200 次强制布局耗时: ' + perf.reflowCostMs + 'ms (期望 < 50ms)');
  console.log('DOM 节点数: ' + perf.domNodes + ' (期望 < 60，伪元素不产生节点)');
  console.log(ok ? 'PERF PASS' : 'PERF FAIL');
  process.exit(ok ? 0 : 1);
});
