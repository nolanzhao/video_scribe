const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { open, save } = window.__TAURI__.dialog;

// ============================================
// State
// ============================================
let selectedFilePath = null;
let transcribeResult = null;
let isTranscribing = false;

// ============================================
// DOM
// ============================================
const $ = (id) => document.getElementById(id);

const $modelOverlay = $('model-overlay');
const $btnDownload = $('btn-download');
const $downloadProgressArea = $('download-progress-area');
const $downloadProgressBar = $('download-progress-bar');
const $downloadStatus = $('download-status');

const $dropZone = $('drop-zone');
const $btnSelectFile = $('btn-select-file');
const $fileInfo = $('file-info');
const $fileName = $('file-name');
const $filePath = $('file-path');
const $btnChangeFile = $('btn-change-file');
const $btnStart = $('btn-start');
const $languageSelect = $('language-select');

const $progressSection = $('progress-section');
const $progressStage = $('progress-stage');
const $progressPercent = $('progress-percent');
const $transcribeProgressBar = $('transcribe-progress-bar');
const $progressMessage = $('progress-message');

const $resultsSection = $('results-section');
const $segmentCount = $('segment-count');
const $totalDuration = $('total-duration');
const $timeline = $('timeline');
const $btnOpenFolder = $('btn-open-folder');
const $btnExportSrt = $('btn-export-srt');
const $btnExportTxt = $('btn-export-txt');
const $btnCopyAll = $('btn-copy-all');
const $completionBanner = $('completion-banner');
const $completionMessage = $('completion-message');
const $emptyState = $('empty-state');

// SVG icon strings (no emoji)
const ICON = {
  play: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  loading: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="loading-spin"><path d="M12 2v4m0 12v4m-7.07-14.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>',
  check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  copy: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
};

// ============================================
// Init
// ============================================
async function init() {
  initTheme();

  const modelInfo = await invoke('check_model_status');
  if (!modelInfo.exists) {
    $modelOverlay.classList.remove('hidden');
  }

  const ffmpegOk = await invoke('check_ffmpeg');
  if (!ffmpegOk) {
    console.warn('FFmpeg not found in system PATH.');
  }

  setupEventListeners();
  setupDragDrop();
  await setupTauriListeners();
}

// ============================================
// Theme
// ============================================
function initTheme() {
  const saved = localStorage.getItem('videoscribe-theme');
  if (saved) {
    setTheme(saved);
  } else {
    // Follow system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  localStorage.setItem('videoscribe-theme', next);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const $sun = document.getElementById('icon-sun');
  const $moon = document.getElementById('icon-moon');
  if (theme === 'dark') {
    $sun.classList.add('hidden');
    $moon.classList.remove('hidden');
  } else {
    $sun.classList.remove('hidden');
    $moon.classList.add('hidden');
  }
}

// ============================================
// Model Download
// ============================================
async function handleDownloadModel() {
  $btnDownload.disabled = true;
  $btnDownload.textContent = '下载中...';
  $downloadProgressArea.classList.remove('hidden');

  try {
    await invoke('download_model');
    $downloadStatus.textContent = '下载完成';
    $downloadProgressBar.style.width = '100%';
    setTimeout(() => $modelOverlay.classList.add('hidden'), 800);
  } catch (err) {
    $downloadStatus.textContent = `下载失败: ${err}`;
    $btnDownload.disabled = false;
    $btnDownload.innerHTML = `${ICON.play} 重新下载`;
  }
}

// ============================================
// File Selection
// ============================================
async function selectFile() {
  const selected = await open({
    multiple: false,
    filters: [{
      name: 'Video',
      extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts', 'mts'],
    }],
  });
  if (selected) setSelectedFile(selected);
}

function setSelectedFile(path) {
  selectedFilePath = path;
  const parts = path.split('/');
  $fileName.textContent = parts[parts.length - 1];
  $filePath.textContent = path;

  $dropZone.classList.add('hidden');
  $fileInfo.classList.remove('hidden');
  $resultsSection.classList.add('hidden');
  $progressSection.classList.add('hidden');
  $emptyState.classList.remove('hidden');
  $completionBanner.classList.add('hidden');
  $btnOpenFolder.classList.add('hidden');
  transcribeResult = null;
}

// ============================================
// Transcription
// ============================================
async function startTranscribe() {
  if (!selectedFilePath || isTranscribing) return;

  isTranscribing = true;
  $btnStart.disabled = true;
  $btnStart.innerHTML = `${ICON.loading} 转录中...`;

  $progressSection.classList.remove('hidden');
  $emptyState.classList.add('hidden');
  $completionBanner.classList.add('hidden');
  $btnOpenFolder.classList.add('hidden');

  // Show results section immediately for real-time display
  $resultsSection.classList.remove('hidden');
  $timeline.innerHTML = '';
  $segmentCount.textContent = '0 段';
  $totalDuration.textContent = '00:00';

  const language = $languageSelect.value || null;

  try {
    const result = await invoke('transcribe_video', {
      videoPath: selectedFilePath,
      language: language,
    });

    transcribeResult = result;
    showCompletedResults(result);
  } catch (err) {
    $progressStage.innerHTML = `${ICON.check} 转录失败`;
    $progressMessage.textContent = typeof err === 'string' ? err : JSON.stringify(err);
    $progressPercent.textContent = '';
    $transcribeProgressBar.style.width = '0%';
  } finally {
    isTranscribing = false;
    $btnStart.disabled = false;
    $btnStart.innerHTML = `${ICON.play} 开始转录`;
  }
}

function showCompletedResults(result) {
  $progressSection.classList.add('hidden');
  $segmentCount.textContent = `${result.segments.length} 段`;
  $totalDuration.textContent = formatDuration(result.duration);

  // Re-render full timeline for final state
  $timeline.innerHTML = '';
  result.segments.forEach((seg, i) => {
    $timeline.appendChild(createSegmentElement(seg, i));
  });

  // Show completion banner
  $completionBanner.classList.remove('hidden');
  const srtName = result.srt_path.split('/').pop();
  const txtName = result.txt_path.split('/').pop();
  $completionMessage.textContent = `已自动保存: ${srtName} · ${txtName}`;

  $btnOpenFolder.classList.remove('hidden');
}

function createSegmentElement(segment) {
  const div = document.createElement('div');
  div.className = 'segment';
  div.innerHTML = `
    <span class="segment-time">${formatTime(segment.start)} → ${formatTime(segment.end)}</span>
    <span class="segment-text">${escapeHtml(segment.text)}</span>
  `;
  return div;
}

// ============================================
// Export & Open Folder
// ============================================
async function openFolder() {
  if (!transcribeResult) return;
  try {
    await invoke('open_containing_folder', { path: transcribeResult.srt_path });
  } catch (err) {
    console.error('Failed to open folder:', err);
  }
}

async function exportSrt() {
  if (!transcribeResult) return;
  const srt = await readFileOrGenerate('srt');
  const path = await save({
    filters: [{ name: 'SRT Subtitle', extensions: ['srt'] }],
    defaultPath: getDefaultExportName('srt'),
  });
  if (path) await invoke('save_file', { path, content: srt });
}

async function exportTxt() {
  if (!transcribeResult) return;
  const txt = await readFileOrGenerate('txt');
  const path = await save({
    filters: [{ name: 'Text File', extensions: ['txt'] }],
    defaultPath: getDefaultExportName('txt'),
  });
  if (path) await invoke('save_file', { path, content: txt });
}

function readFileOrGenerate(type) {
  // Generate from segments since files were already written incrementally
  if (type === 'srt') {
    return transcribeResult.segments.map((seg, i) =>
      `${i + 1}\n${formatSrtTs(seg.start)} --> ${formatSrtTs(seg.end)}\n${seg.text}\n`
    ).join('\n');
  }
  return transcribeResult.segments.map(seg =>
    `[${formatTime(seg.start)} --> ${formatTime(seg.end)}] ${seg.text}`
  ).join('\n');
}

async function copyAll() {
  if (!transcribeResult) return;
  const text = transcribeResult.segments.map(s => s.text).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    $btnCopyAll.innerHTML = `${ICON.check} 已复制`;
    setTimeout(() => { $btnCopyAll.innerHTML = `${ICON.copy} 复制`; }, 1500);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
  $btnDownload.addEventListener('click', handleDownloadModel);
  $btnSelectFile.addEventListener('click', selectFile);
  $dropZone.addEventListener('click', selectFile);
  $btnChangeFile.addEventListener('click', () => {
    $dropZone.classList.remove('hidden');
    $fileInfo.classList.add('hidden');
    $resultsSection.classList.add('hidden');
    $progressSection.classList.add('hidden');
    $emptyState.classList.remove('hidden');
    selectedFilePath = null;
    transcribeResult = null;
  });
  $btnStart.addEventListener('click', startTranscribe);
  $btnOpenFolder.addEventListener('click', openFolder);
  $btnExportSrt.addEventListener('click', exportSrt);
  $btnExportTxt.addEventListener('click', exportTxt);
  $btnCopyAll.addEventListener('click', copyAll);
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);
}

function setupDragDrop() {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
    document.body.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); });
  });
  $dropZone.addEventListener('dragenter', () => $dropZone.classList.add('drag-over'));
  $dropZone.addEventListener('dragleave', () => $dropZone.classList.remove('drag-over'));
  $dropZone.addEventListener('dragover', e => { e.preventDefault(); $dropZone.classList.add('drag-over'); });
  $dropZone.addEventListener('drop', e => {
    e.preventDefault();
    $dropZone.classList.remove('drag-over');
    const files = e.dataTransfer?.files;
    if (files?.length > 0 && files[0].path) setSelectedFile(files[0].path);
  });
}

async function setupTauriListeners() {
  await listen('transcribe-progress', (event) => {
    const d = event.payload;
    const pct = Math.round(d.progress * 100);

    $progressStage.innerHTML = `${getStageIcon(d.stage)} ${getStageLabel(d.stage)}`;
    $progressPercent.textContent = `${pct}%`;
    $transcribeProgressBar.style.width = `${pct}%`;
    $progressMessage.textContent = d.message;

    // Real-time segment display
    if (d.segment && d.stage === 'transcribing') {
      const idx = $timeline.children.length;
      $timeline.appendChild(createSegmentElement(d.segment, idx));
      $segmentCount.textContent = `${idx + 1} 段`;
      $timeline.scrollTop = $timeline.scrollHeight;
    }
  });

  await listen('download-progress', (event) => {
    const d = event.payload;
    if (d.total > 0) {
      $downloadProgressBar.style.width = `${Math.round((d.downloaded / d.total) * 100)}%`;
    }
    $downloadStatus.textContent = d.message;
  });
}

// ============================================
// Helpers
// ============================================
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  if (h > 0) return `${p(h)}:${p(m)}:${p(s)}.${p3(ms)}`;
  return `${p(m)}:${p(s)}.${p3(ms)}`;
}

function formatSrtTs(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${p(h)}:${p(m)}:${p(s)},${p3(ms)}`;
}

function formatDuration(seconds) {
  if (!seconds) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

function p(n) { return n.toString().padStart(2, '0'); }
function p3(n) { return n.toString().padStart(3, '0'); }

function getStageIcon(stage) {
  const spinner = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="loading-spin"><path d="M12 2v4m0 12v4m-7.07-14.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>';
  const checkSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  return stage === 'done' ? checkSvg : spinner;
}

function getStageLabel(stage) {
  const labels = {
    extracting: '提取音频',
    loading: '加载模型',
    loading_audio: '加载音频',
    transcribing: '正在转录',
    done: '转录完成',
  };
  return labels[stage] || stage;
}

function getDefaultExportName(ext) {
  if (!selectedFilePath) return `transcription.${ext}`;
  const name = selectedFilePath.split('/').pop().replace(/\.[^/.]+$/, '');
  return `${name}.${ext}`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ============================================
// Start
// ============================================
init();
