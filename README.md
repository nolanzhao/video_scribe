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

> **遇到了“应用已损坏，无法打开”？**
> 这是因为 macOS 最新的 Gatekeeper 机制拦截了未经过 Apple 开发者签名的第三方开源应用。
> **解决方法：**
> 1. 将应用拖入 `应用程序 (Applications)` 文件夹。
> 2. 打开终端 (Terminal)，执行以下一键解除隔离命令（注意后面的空格和路径）：
>    ```bash
>    sudo xattr -r -d com.apple.quarantine /Applications/VideoScribe.app
>    ```
> 3. 输入开机密码后，即可正常打开。
### 系统要求

- macOS 14.0+（Apple Silicon M1/M2/M3 等）

### 环境依赖 & 模型

**开箱即用，无需配置：** 
首次启动时应用会自动静默下载所需的 **Whisper 语音模型** (约 1.5GB) 与 **FFmpeg 音视频处理组件**，下载后存储在 `~/Library/Application Support/com.videoscribe.app/`，之后无需重复下载。

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
