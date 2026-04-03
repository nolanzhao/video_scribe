use std::path::Path;
use std::process::Command;

/// Extract audio from a video file to a WAV file (16kHz, mono, 16-bit PCM).
/// This is the format whisper.cpp expects.
pub fn extract_audio(video_path: &str, output_path: &str) -> Result<(), String> {
    let output = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            video_path,
            "-vn",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "16000",
            "-ac",
            "1",
            output_path,
        ])
        .output()
        .map_err(|e| {
            format!("FFmpeg not found: {e}. Please install via: brew install ffmpeg")
        })?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg failed: {stderr}"))
    }
}

/// Load a WAV file and return audio samples as Vec<f32> (normalized to [-1.0, 1.0]).
pub fn load_wav_as_f32(wav_path: &str) -> Result<Vec<f32>, String> {
    let reader =
        hound::WavReader::open(wav_path).map_err(|e| format!("Failed to open WAV: {e}"))?;

    let spec = reader.spec();
    if spec.channels != 1 {
        return Err(format!(
            "Expected mono audio, got {} channels",
            spec.channels
        ));
    }

    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => {
            let max_val = (1 << (spec.bits_per_sample - 1)) as f32;
            reader
                .into_samples::<i32>()
                .filter_map(|s| s.ok())
                .map(|s| s as f32 / max_val)
                .collect()
        }
        hound::SampleFormat::Float => reader
            .into_samples::<f32>()
            .filter_map(|s| s.ok())
            .collect(),
    };

    Ok(samples)
}

/// Get video duration in seconds using ffprobe.
pub fn get_video_duration(video_path: &str) -> Result<f64, String> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "quiet",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            video_path,
        ])
        .output()
        .map_err(|e| format!("ffprobe failed: {e}"))?;

    if !output.status.success() {
        return Err("ffprobe failed to get duration".to_string());
    }

    let duration_str = String::from_utf8_lossy(&output.stdout);
    duration_str
        .trim()
        .parse::<f64>()
        .map_err(|e| format!("Failed to parse duration: {e}"))
}

/// Check if FFmpeg is available.
pub fn is_ffmpeg_available() -> bool {
    Command::new("ffmpeg")
        .arg("-version")
        .output()
        .is_ok_and(|o| o.status.success())
}

/// Check if the given path looks like a supported video file.
pub fn is_supported_video(path: &str) -> bool {
    let extensions = [
        "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "ts", "mts",
    ];
    Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| extensions.contains(&ext.to_lowercase().as_str()))
}
