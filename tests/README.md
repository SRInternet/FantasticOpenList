# 测试脚本

五套验证脚本。

```bash
node tests/check-structure.js   # 结构校验：34 项
node tests/check-render.js      # 渲染校验：18 项，Edge 无头实测 getComputedStyle
node tests/check-perf.js        # 性能校验：longtask / 布局抖动 / DOM 节点数
node tests/check-readme.js      # README 一致性：锚点 / 章节 / 注释规范
node tests/check-secrets.js     # 私有属性检查：内部路径 / 编码路径 / Token
```

## 依赖

- Node.js 18+
- `check-render.js` 与 `check-perf.js` 需要本机 Edge 浏览器，通过 `EDGE_PATH` 环境变量指定 `msedge.exe` 路径：

```powershell
$env:EDGE_PATH = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
node tests/check-render.js
```

未设置 `EDGE_PATH` 时两个脚本直接退出并提示。

## 说明

- 脚本在 `.tmp/` 下生成中间文件（复现页、提取的 JS、浏览器配置目录），该目录已在 `.gitignore` 中忽略。
- `check-render.js` 与 `check-perf.js` 启动本地临时 HTTP 服务，端口 8799 / 8801，仅监听 127.0.0.1。
