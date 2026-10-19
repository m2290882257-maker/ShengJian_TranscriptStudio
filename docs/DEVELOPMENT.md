# 开发与验证

## 结构

| 路径 | 职责 |
|---|---|
| `server.mjs` | 本地 HTTP、上传、音轨提取、任务、聊天与导出 |
| `public/` | 左栏配置、搜索、价格、播放器、编辑器、时间戳与聊天 |
| `lib/providers.mjs` | 固定服务商地址、REST、无凭据网络错误提示 |
| `lib/timestamps.mjs` | CSV 解析、分段时间和文稿时间标记 |
| `lib/downloads.mjs` | 文件名规范化、固定目录、排他写入、同名编号 |
| `lib/docx.mjs` | 无依赖 ZIP / OOXML 生成 |
| `tests/app.test.mjs` | 合成音频、模拟上游的本地集成测试 |
| `assets/` | SVG、PNG、多尺寸 ICO |
| `launch.ps1` / `open-app.ps1` | 启动、复用服务、应用窗口和错误提示 |
| `create-shortcut.ps1` | 根据本机路径生成图标入口 |

## 运行

Node.js 22+，以及 PATH / `FFMPEG_PATH` 中的 FFmpeg，或 `setup-audio.ps1` 安装的 imageio-ffmpeg 0.6.0。没有 npm 运行时依赖，音频工具安装文件不提交仓库。

```powershell
node server.mjs
node --check server.mjs
node --check public/app.js
node --test tests/*.test.mjs
```

默认 `127.0.0.1:3210`。开发时可用 `PORT` 改端口，Windows 启动脚本固定为 3210。`APP_SESSION_TOKEN` 仅供重启保留本地会话，不是服务商 Key。

## 处理流程与接口

上传流写入临时目录 → FFmpeg 单声道 16 kHz / 64 kbps AAC → 所选间隔切段与 CSV → 逐段转写 → 分段状态和文字 → 可选聊天 → 保存 Markdown / Word。

| 接口 | 内容 |
|---|---|
| `GET /api/config` | 本地令牌和服务商预设，不返回 Key |
| `GET /api/network` | 不带 Key 的上游探测 |
| `POST /api/transcribe` | 二进制文件，使用 `x-provider`、`x-api-key`、`x-model`、`x-filename`、`x-chunk-seconds` |
| `GET /api/jobs/:id` | 分段、状态、文字 |
| `POST /api/chat` | 当前文字、聊天记录、模型 |
| `POST /api/export` | `text`、`format`、可选 `filename` / `saveOnly`；先写入固定目录 |

除 config 外需要 `x-app-token`；检查 Host 和 Origin，不开放跨站访问。`saveOnly:true` 返回保存路径；旧客户端获取文件字节时也会写入本地。上游失败不自动重试，保留此前完成内容。没有持久任务队列或断点恢复。

## 验证记录

- 真实 FFmpeg 转换 601 秒合成录音，校验两段、末段和编码填充；边界容差 150 毫秒。
- 验证失败、空结果、非法区间、模型名称传递和聊天上下文。
- Markdown / Word 保留中文及时间标记；DOCX ZIP CRC 和 XML 验证。
- 排他写入、中文名称、路径片段过滤、同名编号、磁盘文件读回、跨站请求限制。
- 合成音频界面测试：65 秒产生两段，第二段点击后播放器约定位到 60.032 秒。

自动测试不验证真实账户额度、地区、模型上下线和识别准确率。真实录音、文稿和 Key 不作为仓库测试夹具。
