# VideoScribe

本地离线的视频转文本工具。基于 [whisper.cpp](https://github.com/ggerganov/whisper.cpp) + [Tauri](https://tauri.app)，支持中英文语音识别，所有数据完全在本地处理。

## 功能

- 🎬 支持 MP4 / MKV / AVI / MOV 等常见视频格式
- 🗣️ 支持中文、英文及自动语言检测
- ⚡ 实时转录 — 边转录边显示文本，边写入文件
- 💾 自动保存 SRT 字幕 + TXT 文本到视频所在目录
- 📂 转录完成后一键在 Finder 中打开文件
- 🌗 支持浅色 / 深色主题切换
- 🔒 完全离线，无需联网，数据不上传

## 安装

### 下载安装包

前往 [Releases](https://github.com/nolanzhao/video_scribe/releases) 下载最新版本的 `.dmg` 文件（仅支持 Apple Silicon Mac）。

> 首次打开时 macOS 可能提示"无法验证开发者"，请右键点击应用 → 打开 → 确认打开。

### 系统要求

- macOS 14.0+（Apple Silicon）
- [FFmpeg](https://ffmpeg.org/)（音频提取需要）

```bash
brew install ffmpeg
```

### 语音模型

首次启动时会自动下载 Whisper Large V3 Turbo 模型（约 1.5 GB），下载后存储在 `~/Library/Application Support/com.videoscribe.app/`，之后无需重复下载。

## 从源码构建

```bash
# 安装依赖
brew install cmake ffmpeg

# 克隆仓库
git clone https://github.com/nolanzhao/video_scribe.git
cd video_scribe

# 安装前端依赖
npm install

# 开发模式
npx tauri dev

# 打包 (Apple Silicon)
npx tauri build --target aarch64-apple-darwin
```

构建产物位于 `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/`

## 技术栈

- **后端**: Rust + [Tauri 2](https://tauri.app) + [whisper-rs](https://github.com/tazz4843/whisper-rs)
- **前端**: Vanilla JS + CSS（毛玻璃双主题）
- **推理**: whisper.cpp（Apple Accelerate 加速）

## License

[MIT](LICENSE)
