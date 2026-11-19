# AI改错别字

一个快速修正错别字的纯前端小工具。支持 OpenAI 兼容的 Chat Completions 接口。用户填写接口 URL、模型名称和自己的 API Key，上方输入原文，下方对照并逐处采纳修改。

## 打开

推荐使用本地静态文件服务（需要 Node.js 18+）：

```sh
cd /Users/littlefean/Desktop/Projects/typo-fix
npm start
```

打开 http://127.0.0.1:4173 。无需 `npm install`，无需构建。该服务仅提供静态文件，不接收 Key 或转发 API 请求。端口被占用时可执行 `PORT=4174 npm start`。

页面不使用模块加载器，也可以尝试直接在普通浏览器中打开 `index.html`。本次自动化浏览器不允许导航到 `file://`，所以直接打开文件的方式未做浏览器验证；已验证的是上面的本地 HTTP 方式。

## 使用

1. 点击「API 设置」，填写 API Key、接口 URL（Base URL）和模型名称（Model），保存后生效，并在刷新或重新打开页面时自动恢复。无需鉴权的本地服务可以留空 Key；「清除配置」可删除保存的 API 设置。
2. 输入原文，选择「只改错别字」或「基础校对」，点击「AI 自动纠错」（快捷键 ⌘/Ctrl + Enter）。
3. 在左右对比中点击高亮文字，逐处采纳或撤回；也可以采纳整行或全部修改。
4. 在「最终文本」查看仅包含已采纳修改的结果，然后复制，或放回输入区继续编辑。

未采纳的建议不会进入最终文本。输入原文发生变化时，旧审阅结果会失效，避免把旧修改应用到新文本。添加或删除换行的修改作为一个修改块处理。示例预览是明确标注的本地演示，不发送 API 请求。

右上角的「颜色模式」可选择「跟随系统」「浅色模式」「深色模式」，默认跟随系统。跟随系统时会随系统外观实时切换；手动选择浅色或深色后不受系统影响。选择保存在浏览器本地，刷新后继续生效；若浏览器禁用本地存储，则仅在当前页面生效。此设置不会影响原文、审阅结果或 API 设置。

## API 与数据

- 浏览器直接请求配置的 OpenAI 兼容 Chat Completions 接口，没有后端或代理。支持 HTTP / HTTPS，页面的 CSP 允许连接自定义服务。
- 接口 URL 可填写基础地址（例如 `https://api.openai.com/v1`）或完整的 `/chat/completions` 地址。基础地址会自动补上 `/chat/completions`；不会重复添加，也不会自动猜测 `/v1`。保留自定义路径、端口和查询参数。
- 初始值保留 `https://api.deepseek.com` 和 `deepseek-flash`，两者均可自由修改。模型名称使用服务商提供的准确 ID，支持包含 `/`、`:` 等字符的模型名。
- 请求仅包含通用的 `model`、`messages`、`stream: false`，不强制传入 `thinking`、`response_format`、`temperature` 或 token 上限，以适配各接口及模型的参数差异。思考模式与输出上限使用服务商默认值。
- 提示词要求返回包含 `corrected_text` 的 JSON 对象，前端据此计算 diff；也接受完整包裹在 Markdown 代码围栏中的 JSON。无效或截断的结果会报错，保留原文。
- Key 非空时使用 `Authorization: Bearer …`；留空时不发送鉴权头。需要其他鉴权方式或不支持 Chat Completions 的接口不在当前兼容范围内。
- API Key、接口 URL 和模型名称在点击「保存设置」后写入当前站点的 `localStorage`（键名 `typo-fix.api-settings`，JSON 明文），刷新或重新打开同一浏览器中的同一站点时自动恢复。「清除配置」只删除 API 设置，保留颜色模式偏好。请将密钥填在 API Key 字段中。
- 浏览器无法写入本地存储时会明确提示，配置仍可在当前页面使用；损坏或无效的已保存配置会被忽略，可以重新填写并保存。清除浏览器站点数据也会删除配置。
- 原文和结果不持久保存。点击纠错后，原文和 Key 会提交给配置的服务，按该服务的账户与计费规则处理。
- 所有脚本在本地提供，无 CDN、分析服务或外部字体。输出以纯文本渲染，不执行用户输入或模型返回的 HTML。
- 单次最多 12,000 个 UTF-16 代码单元（常见中文字符计 1，部分 emoji 计 2 或更多），90 秒超时，可主动取消。浏览器取消只停止等待，不能保证服务端已经停止处理或计费。
- 模型可能误改，建议审阅后采纳。跨域访问取决于服务商的 CORS 配置；接口需允许当前网页来源及 `Content-Type` / `Authorization` 请求头。HTTPS 页面访问 HTTP 服务还可能受浏览器混合内容或本地网络权限限制。

## 项目文件

- `index.html` / `styles.css`：界面与响应式样式。
- `theme.js` / `theme.css`：颜色模式切换、系统外观监听、本地偏好与深色样式。
- `app.js`：设置、请求状态、审阅与采纳交互。
- `api.js`：提示词、自定义接口地址校验、OpenAI 兼容请求与响应校验。
- `core.js`：基于原文快照的差异与结果合成。
- `vendor/`：本地 jsdiff 9.0.0 浏览器发行版及 BSD-3-Clause 许可证。
- `scripts/serve.cjs`：可选的本地静态预览服务。
- `tests/`：差异合成、不同行结构、Unicode、API 错误与取消的自动化测试。

```sh
npm test
npm run check
```

部署到静态托管时，只需上传 `index.html`、`styles.css`、`theme.css`、`theme.js`、`app.js`、`core.js`、`api.js`、`favicon.svg` 及 `vendor/`。本项目未配置线上部署。

## 验证记录

2026-11-19（配置持久保存更新）：`npm run check` 的语法检查及 34 项自动化测试通过。Chrome 验证了保存后刷新、关闭标签页后重开、重启浏览器均自动恢复 API Key / URL / 模型，恢复后的配置可直接发起模拟纠错请求；同时验证了空 Key、取消未保存修改、清除配置保留主题偏好、无效存储数据与存储权限被禁用时的处理。仅 API 配置持久保存，原文未写入本地存储。

2026-11-19（OpenAI 兼容接口更新）：`npm run check` 的语法检查及 34 项自动化测试通过。使用 Chrome 和本地模拟接口验证了自定义 URL / 模型、跨域预检与请求、无 Key 请求、设置保存与取消、刷新清除、纠错结果采纳，以及浅色、深色、390 / 320 像素窄屏设置窗口；无浏览器控制台错误。本次未使用真实服务商 Key，未进行各服务商的线上调用验证。

2026-11-19：29 项自动化测试通过；在浏览器中使用真实 DeepSeek 官方 API 完成一次校对，75 字示例约 2.9 秒返回 3 处建议。逐处采纳、逐行采纳、全部采纳、撤回、复制、继续编辑与缺少 Key 时的设置提示均已验证。浏览器未发现警告或错误。测试 Key 已清除，未写入任何项目文件。界面截图位于 `docs/preview.jpg`。

接口参考：[OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)、[DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)。
