use serde::Serialize;
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Emitter};

use crate::audio;
use crate::model_manager;
use crate::transcriber;

/// Check model status — also searches common local whisper cache directories.
#[tauri::command]
pub fn check_model_status() -> model_manager::ModelInfo {
    if let Some(existing) = model_manager::find_existing_model() {
        let size_mb = std::fs::metadata(&existing)
            .map(|m| m.len() as f64 / (1024.0 * 1024.0))
            .unwrap_or(0.0);
        return model_manager::ModelInfo {
            exists: true,
            path: existing.to_string_lossy().to_string(),
            size_mb,
            name: "Whisper Large V3 Turbo".to_string(),
        };
    }
    model_manager::check_model()
}

/// Download the whisper model.
#[tauri::command]
pub async fn download_model(app: AppHandle) -> Result<String, String> {
    model_manager::download_model(&app).await
}

/// Download the FFmpeg binary.
#[tauri::command]
pub async fn download_ffmpeg(app: AppHandle) -> Result<String, String> {
    model_manager::download_ffmpeg(&app).await
}

/// Check if FFmpeg is available.
#[tauri::command]
pub fn check_ffmpeg() -> bool {
    audio::is_ffmpeg_available()
}

/// Transcribe result sent back to frontend.
#[derive(Debug, Serialize)]
pub struct TranscribeResult {
    pub segments: Vec<transcriber::Segment>,
    pub srt_path: String,
    pub txt_path: String,
    pub duration: f64,
}

/// Main transcription command — extracts audio then runs whisper with real-time streaming.
#[tauri::command]
pub async fn transcribe_video(
    app: AppHandle,
    video_path: String,
    language: Option<String>,
) -> Result<TranscribeResult, String> {
    if !Path::new(&video_path).exists() {
        return Err(format!("Video file not found: {video_path}"));
    }
    if !audio::is_supported_video(&video_path) {
        return Err("Unsupported video format".to_string());
    }

    // Find model
    let model_path = model_manager::find_existing_model()
        .ok_or("Whisper model not found. Please download the model first.")?;

    // Get video duration
    let duration = audio::get_video_duration(&video_path).unwrap_or(0.0);

    // Compute output file paths (same directory as video)
    let video_stem = Path::new(&video_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("transcription");
    let video_dir = Path::new(&video_path)
        .parent()
        .unwrap_or_else(|| Path::new("."));
    let srt_path = video_dir.join(format!("{video_stem}.srt"));
    let txt_path = video_dir.join(format!("{video_stem}.txt"));
    let srt_path_str = srt_path.to_string_lossy().to_string();
    let txt_path_str = txt_path.to_string_lossy().to_string();

    // Create temp WAV file
    let temp_dir = std::env::temp_dir().join("videoscribe");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {e}"))?;
    let wav_path = temp_dir.join("audio.wav");
    let wav_path_str = wav_path.to_string_lossy().to_string();

    // Extract audio
    let _ = app.emit(
        "transcribe-progress",
        transcriber::TranscribeProgress {
            stage: "extracting".to_string(),
            progress: 0.0,
            message: "正在从视频中提取音频...".to_string(),
            segment: None,
        },
    );

    let video_path_for_extract = video_path.clone();
    let wav_path_for_extract = wav_path_str.clone();
    tokio::task::spawn_blocking(move || {
        audio::extract_audio(&video_path_for_extract, &wav_path_for_extract)
    })
    .await
    .map_err(|e| format!("Audio extraction task failed: {e}"))??;

    // Run streaming transcription in a blocking thread
    let model_path_str = model_path.to_string_lossy().to_string();
    let lang = language.clone();
    let app_clone = app.clone();
    let srt_for_transcribe = srt_path_str.clone();
    let txt_for_transcribe = txt_path_str.clone();

    let segments = tokio::task::spawn_blocking(move || {
        transcriber::transcribe_streaming(
            &app_clone,
            &model_path_str,
            &wav_path_str,
            &srt_for_transcribe,
            &txt_for_transcribe,
            lang.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("Transcription task panicked: {e}"))??;

    // Clean up temp WAV
    let _ = std::fs::remove_file(&wav_path);

    Ok(TranscribeResult {
        segments,
        srt_path: srt_path_str,
        txt_path: txt_path_str,
        duration,
    })
}

/// Save content to a file.
#[tauri::command]
pub async fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to save file: {e}"))
}

/// Open the containing folder in Finder and select the file.
#[tauri::command]
pub fn open_containing_folder(path: String) -> Result<(), String> {
    Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map_err(|e| format!("Failed to open folder: {e}"))?;
    Ok(())
}
