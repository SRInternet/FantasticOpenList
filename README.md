# FantasticOpenList

FantasticOpenList 是 OpenList 登录页美化方案：一段可直接粘贴的自定义头部脚本，将默认蓝色波浪背景替换为自定义深浅色壁纸，附带模糊与暗角遮罩。零侵入式，不修改服务端、不替换前端资源、不改动登录逻辑。

## 环境要求

- OpenList，需后台「自定义头部」功能
- 支持 `:has()` 的浏览器：Chrome 105+ / Edge 105+ / Safari 15.4+ / Firefox 121+
- 不支持 `:has()` 时，波浪隐藏退化为 JS 类名挂载

## 文件

| 文件 | 说明 |
| --- | --- |
| [`custom/login-background.html`](custom/login-background.html) | 美化脚本，整段粘贴进自定义头部 |
| [`docs/login-page-analysis.md`](docs/login-page-analysis.md) | `/@login` 页面结构与主题机制分析 |
| [`tests/`](tests/) | 四套验证脚本 |

## 使用方法

1. 打开 [`custom/login-background.html`](custom/login-background.html)，复制全部内容。
2. 进入 OpenList 后台 → 设置 → 自定义头部。
3. 粘贴并保存。
4. 修改壁纸地址，搜索 `--ol-lbg-light` 与 `--ol-lbg-dark`：

```css
:root {
  --ol-lbg-light: url("/d/你的目录/light.png");   /* 浅色壁纸 */
  --ol-lbg-dark:  url("/d/你的目录/dark.png");    /* 深色壁纸 */
  --ol-lbg-blur: 5px;      /* 壁纸模糊度，0 为不模糊 */
  --ol-lbg-overlay: 0.35;  /* 暗角深度，0 ~ 1 */
}
```

主界面背景对应 `--ol-bg-light` 与 `--ol-bg-dark`。任一壁纸留空 `url("")` 时，该主题透出 OpenList 默认背景。

壁纸尺寸建议 1920×1080 起步，文件 1 MB 以内。

## 简要原理解析

### 与 OpenList 的协同

| 上游机制 | 脚本用法 |
| --- | --- |
| Hope UI 主题类 `.hope-ui-light` / `.hope-ui-dark` | CSS 选择器前缀，实现深浅色壁纸切换 |
| 站点 `#ol-bg-layer`（`z-index: -1`） | 壁纸层的 DOM 参照点 |
| `data-*` 属性 | 状态传递，替代 JS 内联样式 |

### 层级

壁纸层 `#ol-login-bg` 与 `#ol-bg-layer` 同为 `z-index: -1`，DOM 顺序决定绘制层级。壁纸层插在 `#ol-bg-layer` 之后（`host.insertBefore(layer, oldBg.nextSibling)`），画在未模糊的原图之上。插入前比对 `layer.previousElementSibling !== oldBg`，位置正确则不移动。

### 模糊

`filter: blur(var(--ol-lbg-blur))` 作用在壁纸层自身，`transform: scale(1.06)` 将壁纸外扩 6%，模糊区域落在视口之外。`filter` 会创建合成层，模糊半径越大每帧像素采样成本越高；默认值 5px。

### 暗角

暗角为 `#ol-login-bg::after` 的 `radial-gradient`，中心 `rgba(0,0,0,0) 35%` 至边缘 `rgba(0,0,0,var(--ol-lbg-overlay))`。使用伪元素：零 DOM 节点，与壁纸层共享 `opacity` 过渡，渐变中心区域完全透明。

### 生命周期

- **主题切换**：Hope UI 的 `colorMode` 变化重渲染 `#root` 子树，JS 挂载的类名被抹掉。除 250ms 轮询外，`:has()` 静态规则在重建后的第一帧隐藏波浪。
- **壁纸层常驻**：壁纸层不销毁，避免切换主题时透出默认背景。`:has()` 选择器挂 `data-ol-login="1"` 标记而非元素 ID，离开登录页时 `removePatches()` 移除该标记，规则失效。
- **路由切换**：`history.pushState/replaceState` 由 `routerHooked` 标志保证只包装一次；`pagehide` 时 `unhookRouter()` 解绑监听与轮询。

## 常见问题

### 自定义头部内容被转义

后台保存后标签变为 `<style>`，脚本不执行。

规避：保存后在浏览器查看页面源码，确认 `<style id="ol-login-bg-style">` 是真实标签。若被转义，改用「自定义 body」字段。

### CSS 不生效

设置了 `background` 但无效果。

规避：需要强制生效的规则加 `!important`。脚本中 `.ol-lbg-hidden` 与 `.ol-lbg-transparent` 均带 `!important`。

### 脚本执行时找不到登录表单

补丁未挂载。

规避：Vite 按路由动态 import，Login 组件是异步 chunk。脚本用三重保障：`onReady()` 等 DOMContentLoaded → `watchLogin()` 的 MutationObserver → 250ms 轮询。

### 暗角影响表单可读性

开启暗角后输入框文字对比度下降。

规避：渐变起点在 `35%`，中心区域完全透明，仅边缘变暗。调大 `--ol-lbg-overlay` 不影响居中的登录卡片。仍觉得暗时降低该值或更换更浅的壁纸。

### 模糊后屏幕四边有黑边

规避：确认 `transform: scale(1.06)` 与 `filter: blur()` 同时存在。

### 主题切换时闪现蓝色波浪

规避：`:has()` 静态规则在子树重建后的第一帧隐藏波浪，不等 JS。自定义该选择器时保留 `[data-ol-login="1"]` 属性约束。

### 主界面 SVG 图标消失

规避：`:has()` 选择器必须带 `[data-ol-login="1"]`。壁纸层常驻，写成 `body:has(#ol-login-bg)` 会永久命中并误伤主界面。

### SPA 反复跳转后变卡

规避：`routerHooked` 标志保证 history 只包装一次，`unhookRouter()` 在 `pagehide` 统一清理。不要在 `apply()` 内添加事件监听。

### Hope UI 哈希类名失效

主界面玻璃拟态中的 `.hope-c-PJLV-ijgzmFG-css` 由 Hope UI 构建时生成，OpenList 版本变化后失效，需重新获取类名。登录页美化部分不使用哈希类名，定位基于 `input[name=username]`、`#root`、`#ol-bg-layer`、`:has(> div > svg)`。

## 代码快速跳转

所有逻辑内联在 [`custom/login-background.html`](custom/login-background.html)（625 行）。

### 站点原生部分（L1 – L207）

| 分区 | 起始行 |
| --- | --- |
| 基础变量与背景修正 | [L2](custom/login-background.html#L2) |
| 独立背景层 | [L13](custom/login-background.html#L13) |
| 玻璃拟态 | [L39](custom/login-background.html#L39) |
| 左下角日夜切换按钮 | [L97](custom/login-background.html#L97) |
| 主界面背景层保活 | [L132](custom/login-background.html#L132) |
| 日夜切换状态管理 | [L142](custom/login-background.html#L142) |
| 左下角切换按钮逻辑 | [L169](custom/login-background.html#L169) |
| 主题恢复与启动 | [L190](custom/login-background.html#L190) |

### 登录页美化部分（L210 – L625）

| 分区 | 起始行 |
| --- | --- |
| 登录页壁纸配置 | [L213](custom/login-background.html#L213) |
| 原版 LoginBg 波浪隐藏 | [L226](custom/login-background.html#L226) |
| 登录卡片容器透明化 | [L238](custom/login-background.html#L238) |
| 登录页壁纸层 | [L244](custom/login-background.html#L244) |
| 暗角遮罩 | [L265](custom/login-background.html#L265) |
| 深浅色壁纸切换 | [L284](custom/login-background.html#L284) |
| 减弱动效偏好 | [L295](custom/login-background.html#L295) |
| 常量与状态 | [L313](custom/login-background.html#L313) |
| 工具函数 | [L327](custom/login-background.html#L327) |
| DOM 定位 | [L363](custom/login-background.html#L363) |
| 壁纸层生命周期 | [L411](custom/login-background.html#L411) |
| 补丁挂载 / 还原 | [L465](custom/login-background.html#L465) |
| 观察者 | [L522](custom/login-background.html#L522) |
| 路由感知 | [L563](custom/login-background.html#L563) |
| 启动 | [L610](custom/login-background.html#L610) |

> GitHub 锚点格式为 `#L245`；VS Code 中可用 `Ctrl+G` 输入行号直达。

## 验证

```bash
node tests/check-structure.js   # 结构校验：34 项
node tests/check-render.js      # 渲染校验：18 项，Edge 无头实测 getComputedStyle
node tests/check-perf.js        # 性能校验：longtask / 布局抖动 / DOM 节点数
node tests/check-readme.js      # README 一致性：锚点 / 章节 / 注释规范
node tests/check-secrets.js     # 私有属性检查：内部路径 / 编码路径 / Token
```

`check-render.js` 与 `check-perf.js` 需要本机 Edge 浏览器，通过 `EDGE_PATH` 环境变量指定 `msedge.exe` 路径，未设置时退出并提示。详见 [`tests/README.md`](tests/README.md)。

## 调试接口

```js
OL_LOGIN_BG.apply()     // 重新挂载补丁
OL_LOGIN_BG.teardown()  // 移除壁纸层与补丁
```
