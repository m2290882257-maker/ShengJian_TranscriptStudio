# 声笺 · Transcript Studio

Windows 本地录音转写工作台。上传音频或带音轨的视频，生成带分段时间戳的文字，预览编辑后保存为 Markdown 或 Word。支持 SiliconFlow / OpenAI API，以及文稿问答、要点和会议纪要整理。

## 一键打开

当前电脑：双击项目根目录的 **声笺.lnk** 图标。也可以双击 `start-app.cmd`。

首次从 GitHub 下载或克隆后：

1. 准备 Node.js 22+；本机 Codex 自带的 Node 也可由启动器自动识别。
2. 准备 FFmpeg：已有 `ffmpeg` 命令或 `FFMPEG_PATH` 可跳过；否则准备 Python 3，运行 `powershell -ExecutionPolicy Bypass -File .\setup-audio.ps1`，下载音频工具。
3. 双击 `create-shortcut.cmd`，在项目目录生成图标快捷方式。需要桌面入口可运行 `create-shortcut.cmd -Desktop`。
4. 双击图标。启动器自动启动或复用本地服务，优先打开 Edge / Chrome 独立窗口，否则打开默认浏览器。

快捷方式包含本机路径，不上传 GitHub；移动文件夹后请重新生成。应用地址：<http://127.0.0.1:3210>。这不是独立 EXE，运行时仍需要 Node.js、FFmpeg 和浏览器。

## 使用流程

1. 左栏选择服务商，填写对应 API Key。Key 仅用于当前页面会话，也支持服务端 `SILICONFLOW_API_KEY` / `OPENAI_API_KEY` 环境变量。
2. 从可搜索下拉列表选择模型，或输入完整 API 模型名并按 Enter 加入自定义列表。模型名称和选择在本机保存，Key 不保存。
3. 上传 MP3、M4A、MP4、WAV、WEBM、FLAC 等文件，选择时间戳间隔，开始转写。本地文件上限 1 GiB；视频只识别音轨。
4. 检查预览中的总时长、段数、处理覆盖与异常段。点击时间段定位原录音，再点击播放器播放。
5. 编辑文字，或用聊天生成要点、会议纪要。聊天回复需点击“采用为预览文字”才会替换编辑器。
6. 点击 Markdown / Word，将当前编辑器内容保存到**项目根目录的 download 文件夹**。本机为 `D:\Codex_Projects\sikiconflow\download`。沿用录音名称，重名自动编号，不覆盖。

先保存需要的内容再关闭或刷新。旧页面不会自动加载新代码，新版会显示保存文件的完整路径。

## 当前功能

| 功能 | 当前行为 |
|---|---|
| 音视频转写 | FFmpeg 提取音轨、标准化、分段并顺序请求 API |
| 时间戳听检 | 30 秒、1 分钟（默认）、5 分钟、10 分钟；标出失败、未处理和空结果 |
| 模型与价格 | 左栏搜索切换、自定义；价格按用户截图静态录入，非实时查询 |
| 编辑与恢复 | 文字编辑、简易 Markdown 预览、复制、恢复原始转写 |
| 文稿问答 | 参考当前文字回答，支持要点及会议纪要提示 |
| 本地导出 | UTF-8 Markdown、真正 OOXML Word，保留当前文稿中的时间标记 |
| Windows 入口 | 项目快捷方式、可选桌面快捷方式、独立浏览器窗口 |

SiliconFlow 预置语音 `XingChenAGI/XingChenASR-V3.2-Ultra`，聊天 `XingChenAGI/Xing4.0-29B` 和 `deepseek-ai/DeepSeek-V4.1-Flash`。OpenAI 预置 `gpt-transcribe`、`gpt-4o-transcribe`、`gpt-4o-mini-transcribe` 和 `gpt-4.1-mini`。实际模型权限、区域和费用以服务商账户为准。

## 测试与边界

```powershell
node --test tests/*.test.mjs
```

先准备 FFmpeg，无须安装 npm 运行时依赖。测试使用真实 FFmpeg、合成音频和模拟 API，不消耗用户额度。验证覆盖分段边界、末段、失败和空结果、聊天上下文、带时间标记导出、真实文件写入、中文文件名和同名编号。

时间戳为分段范围，不是逐句对齐；100% 处理覆盖不能证明没有漏字。用户使用中已产生真实转写及本地导出，但识别准确率仍需样本听检，不能用模拟测试代替。

不提供说话人区分、逐词时间戳、SRT/VTT、批量队列、失败段单独重试或文稿自动保存。任务在服务内存中保留约 30 分钟，服务退出即丢失。原录音片段会发送给所选 API，聊天发送当前文字与聊天记录。更短分段增加请求次数。

API Key、录音、download、运行缓存、FFmpeg 安装文件和本机快捷方式不进入仓库。

## 文档

- [使用与故障排查](docs/USER_GUIDE.md)
- [开发与验证](docs/DEVELOPMENT.md)
- [开发状态与后续计划](docs/STATUS.md)
- [更新记录](CHANGELOG.md)
- [两种 API 方案评估](方案评估与实施计划.md)
