# OpenList `/@login` 页面结构分析

目标站点：`https://csr.srinternet.top/@login`
技术栈：OpenList + Hope UI + SolidJS 风格响应式运行时 + Vite 构建

---

## 1. 产物与加载链

| 资源 | 体积 | 职责 |
| --- | --- | --- |
| `assets/index-PvGPvlUv.js` | 22 KB | 入口：HopeProvider 主题配置、路由、`customize` 注入系统 |
| `assets/store-BxFvGRq4.js` | 494 KB | 全局状态、设置读取、Hope UI 运行时 |
| `assets/components-CV7_am9F.js` | 1.3 MB | 组件库 |
| `assets/login-Ddo4qDlV.js` | 5.7 KB | Login 组件 |
| `assets/LoginBg-D8ASTGHx.js` | 2.5 KB | 登录页 SVG 波浪背景 |
| `assets/components-CvTlA6jk.css` | 18 KB | 组件样式 |
| `assets/index-CEjh6L5N.css` | 884 B | 滚动条等全局样式 |

`<head>` 内存在站点自注入的 `<style>` 与 `<script>`（背景图层 + 主题切换按钮）。

---

## 2. 加载生命周期

```
HTML 解析
  └─ head 内联脚本 boot()
       ├─ ensureBgLayer()        创建 #ol-bg-layer
       ├─ restoreTheme()         读 localStorage.openlist-custom-theme，缺省 dark
       └─ ensureSwitchButton()   创建 #custom-theme-toggle，MutationObserver 保活
Vite module 加载 index-PvGPvlUv.js
  └─ HopeProvider(initialColorMode:'system')  → 落 .hope-ui-light/.hope-ui-dark
  └─ Router 匹配 /@login → 动态 import login-Ddo4qDlV.js
       └─ Login 组件挂载 → LoginBg 挂载（fixed 全屏 + 两个 SVG blob）
  └─ mt()（仅执行一次）→ ft() 拉取自定义 CSS，替换 "customize head"/"customize body" 注释锚点
```

登录卡片在 Vite chunk 加载后出现，早于自定义头部脚本的执行完成。

---

## 3. `/@login` DOM 层级

```
html[lang=en][translate=no]
├─ head
│  ├─ style                     # 站点既有注入（背景变量、毛玻璃、主题按钮）
│  ├─ script                    # window.OPENLIST_CONFIG = { main_color:'#7C3AED', ... }
│  └─ script[type=module]       # Vite 入口 + modulepreload
└─ body
   ├─ div#ol-bg-layer           # position:fixed; inset:0; z-index:-1; 背景随主题切换
   ├─ div#root                  # 应用挂载点，背景被强制 transparent
   │  └─ (HopeProvider 根元素，携带 .hope-ui-light | .hope-ui-dark)
   │     └─ Router → /@login
   │        └─ div  [zIndex:'$docked', w:'$full', h:'100vh']   ← 登录页全屏容器
   │           ├─ div  [rounded:'$xl', p:'24px', w:{"@initial":'90%',"@sm":'364px'}]  ← 登录卡片
   │           │  ├─ div  [Flex, alignItems:center, justifyContent:space-around]
   │           │  │  ├─ img  [Image, boxSize:'$12', src=settings.logo]
   │           │  │  └─ span [Text, color:'$info9', fontSize:'$2xl']  "登录到 <site_title>"
   │           │  ├─ div  [Show when=!otpMode]
   │           │  │  ├─ input[name=username]
   │           │  │  ├─ input[name=password][type=password]
   │           │  │  └─ div  [Flex, fontSize:'$sm', color:'$neutral10']
   │           │  │     ├─ label > input[type=checkbox]  remember-pwd
   │           │  │     └─ a[target=_blank]  login.forget_url
   │           │  ├─ input#totp[name=otp]  （OTP 模式，6 位数字自动提交）
   │           │  ├─ div  [ButtonGroup, w:'$full', spacing:'$2']
   │           │  │  ├─ button  清除
   │           │  │  └─ button  登录（onClick → POST /auth/login/hash）
   │           │  ├─ label > input[type=checkbox]  LDAP（when ldap_login_enabled）
   │           │  ├─ button  游客进入（colorScheme:accent）
   │           │  └─ div  [Flex, mt:'$2', justifyContent:space-evenly, color:'$neutral10']
   │           │     ├─ svg ×3（SSO 图标位）
   │           │     └─ button（WebAuthn，when webauthn_login_enabled）
   │           └─ LoginBg 组件
   ├─ button#custom-theme-toggle   # position:fixed; bottom:30px; left:30px; 44px 圆形毛玻璃
   └─ script[nomodule] + script    # Vite legacy 入口与 preload 注入
```

登录态守卫：`g=()=>['/@manage','/@login','/@init'].some(e=>path.startsWith(e))`，头部导航仅在 `I()&&Be()&&!g()` 时渲染。`/@login` 本身没有头部元素。

---

## 4. 选择器清单

### 4.1 稳定钩子

| 选择器 | 说明 |
| --- | --- |
| `#root` | 应用挂载点 |
| `#ol-bg-layer` | 既有背景图层，`z-index:-1` |
| `#custom-theme-toggle` | 既有主题按钮 |
| `.hope-ui-light` / `.hope-ui-dark` | 主题状态类，落在运行时元素上 |
| `input[name=username]` / `input[name=password]` / `input#totp` | 登录表单 |
| `header`、`.header-left`、`.obj-box`、`.body > .nav`、`pre`、`.hope-icon-button` | 管理页结构，登录页不存在 |

### 4.2 运行时哈希类

`.hope-c-PJLV-ijgzmFG-css` 等由 Hope UI 构建时生成，版本变化即失效。例外：`.hope-select__option`、`.hope-notification__list` 等 BEM 风格类名在 `index-CEjh6L5N.css` 中稳定存在。

### 4.3 主题修饰类名组合

```css
.hope-ui-light  --hope-colors-background  /* 被既有脚本置为 transparent !important */
.hope-ui-dark   --hope-colors-background  /* 同上 */
.hope-ui-dark ::-webkit-scrollbar-*       /* 见 index-CEjh6L5N.css */
```

---

## 5. 主题切换机制

1. **初始**：`gt = { initialColorMode:'system', lightTheme:{ colors:{ background:'#f7f8fa' } } }`，跟随系统。
2. **运行时**：Hope UI 在 `document.body` 上追加 `.hope-ui-light` 或 `.hope-ui-dark`，源码为 `as(e){let t=document.body;t.classList.add(is(e)),t.classList.remove(...)}`。
3. **变量切换**：`colorMode` 信号变化触发 `ve(()=>{c(l()?n:t),as(l())})`，同时重渲染 `#root` 子树。
4. **站点覆写**：既有脚本把 `.hope-ui-light, .hope-ui-dark` 的 `--hope-colors-background` 置为 `transparent !important`，并把 `html, body, #root, .App` 背景强制透明。
5. **持久化**：`localStorage["openlist-custom-theme"] = "light" | "dark"`，缺省 `dark`。
6. **切换入口**：`#custom-theme-toggle` 点击 → 遍历主题元素替换类名 → 写 localStorage → `updateButtonIcon()`。
7. **保活**：`MutationObserver(document.body, {childList:true})` 在被移除后重建背景层与按钮。

---

## 6. 设计 Token

| 类别 | 值 | 来源 |
| --- | --- | --- |
| 主色 | `#7C3AED` | `window.OPENLIST_CONFIG.main_color` |
| 浅色背景 | `#f7f8fa` | `gt.lightTheme.colors.background` |
| 语义色 token | `$info9`（标题）、`$neutral10`（辅助文本）、`$info8`（Input 聚焦边框）、`accent`（游客按钮） | Hope UI token |
| 圆角 | 卡片 `$xl`；Button/Input `$lg` | 组件 baseStyle |
| 卡片 | `p:'24px'`、`spacing:'$4'`、`w:{"@initial":"90%","@sm":"364px"}` | Login 组件 |
| 按钮动效 | `_active:{transform:'scale(.95)',transition:'0.2s'}`、`_focus:{boxShadow:'unset'}` | Button baseStyle |
| 背景渐变 | 默认 `#28aff0 → #120fc4`；深色 `#a9c6ff → #062b74` | LoginBg |
| 层级 | 容器 `zIndex:'$docked'`、背景 `zIndex:'$hide'`、进度条 `$banner`、头部 `$sticky` | 组件 props |

---

## 7. 注入通道

**后台「自定义头部」字段**：`index-PvGPvlUv.js` 内置 `rt()`（TreeWalker 查找注释节点）+ `ct()`（template 解析替换）注入系统，锚点为 `<!-- customize head -->` / `<!-- customize body -->`，脚本超时 15 s 后继续执行后续逻辑。

---

## 8. 已处理的技术风险

| 风险 | 表现 | 处理方式 |
| --- | --- | --- |
| 主题切换重渲染子树 | JS 挂载的 `.ol-lbg-hidden` 被抹掉，波浪重现 | `:has()` 静态规则第一帧生效 + 250ms 轮询兜底 |
| 壁纸层被原图覆盖 | 模糊壁纸画在未模糊原图之下 | 插在 `#ol-bg-layer` 之后，利用 DOM 顺序 |
| 模糊边缘透出 | 屏幕四边虚化黑边 | `transform: scale(1.06)` 外扩 |
| 壁纸层常驻误伤主界面 | 主界面 SVG 背景被隐藏 | `:has()` 选择器挂 `[data-ol-login="1"]` 标记 |
| SPA 路由累积监听 | 反复跳转后变卡 | `routerHooked` 标志 + `pagehide` 解绑 |
| 重复注入 | 双背景层 | `__OL_LOGIN_BG_BOOTED__` 标志 |
| Hope UI 哈希类名失效 | 主界面玻璃拟态失效 | 登录页部分改用稳定钩子；主界面部分保留并在注释标注 |

---

## 9. 相关文件

| 文件 | 说明 |
| --- | --- |
| [`custom/login-background.html`](custom/login-background.html) | 美化脚本，整段粘贴进自定义头部 |
| [`tests/`](tests/) | 结构 / 渲染 / 性能 / README / 私有属性 五套验证脚本 |
