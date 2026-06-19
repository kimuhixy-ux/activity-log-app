const OWNER = 'kimuhixy-ux';
const REPO = 'activity-log';
const API_BASE = 'https://api.github.com';

// ── DOM要素 ──
const textarea = document.getElementById('log-input');
const saveBtn = document.getElementById('save-btn');
const status = document.getElementById('status');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const tokenInput = document.getElementById('token-input');
const tokenSaveBtn = document.getElementById('token-save-btn');
const tokenStatus = document.getElementById('token-status');

// ── 初期化 ──
function init() {
  const saved = localStorage.getItem('github_token');
  if (saved) {
    tokenInput.value = saved;
  }
  textarea.focus();

  saveBtn.addEventListener('click', handleSave);
  settingsToggle.addEventListener('click', toggleSettings);
  tokenSaveBtn.addEventListener('click', saveToken);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
}

// ── 設定パネル開閉 ──
function toggleSettings() {
  settingsPanel.classList.toggle('open');
}

// ── トークン保存 ──
function saveToken() {
  const token = tokenInput.value.trim();
  if (!token) {
    tokenStatus.textContent = 'トークンを入力してください';
    tokenStatus.style.color = 'var(--danger)';
    return;
  }
  localStorage.setItem('github_token', token);
  tokenStatus.textContent = '保存しました';
  tokenStatus.style.color = 'var(--success)';
  setTimeout(() => { tokenStatus.textContent = ''; }, 2000);
}

// ── JST日時を取得 ──
function getJSTDate() {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const year = jst.getFullYear();
  const month = String(jst.getMonth() + 1).padStart(2, '0');
  const day = String(jst.getDate()).padStart(2, '0');
  const hours = String(jst.getHours()).padStart(2, '0');
  const minutes = String(jst.getMinutes()).padStart(2, '0');
  return {
    datePath: `logs/${year}-${month}-${day}.md`,
    time: `${hours}:${minutes}`
  };
}

// ── ステータス表示 ──
function showStatus(message, type) {
  status.textContent = message;
  status.className = type;
}

// ── 保存処理 ──
async function handleSave() {
  const text = textarea.value.trim();
  if (!text) {
    showStatus('テキストを入力してください', 'error');
    return;
  }

  const token = localStorage.getItem('github_token');
  if (!token) {
    showStatus('⚙️ 設定からGitHubトークンを登録してください', 'error');
    settingsPanel.classList.add('open');
    return;
  }

  saveBtn.disabled = true;
  showStatus('保存中...', '');

  try {
    const { datePath, time } = getJSTDate();
    const newEntry = `## ${time}\n${text}\n\n`;
    const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${datePath}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };

    let existingContent = '';
    let sha = null;

    // 既存ファイルの取得を試みる
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      existingContent = decodeBase64(data.content);
    } else if (getRes.status !== 404) {
      throw new Error(`GitHub API エラー: ${getRes.status}`);
    }

    // 追記して保存
    const fullContent = existingContent + newEntry;
    const body = {
      message: `log: ${time}`,
      content: encodeBase64(fullContent)
    };
    if (sha) {
      body.sha = sha;
    }

    const putRes = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(err.message || `保存失敗: ${putRes.status}`);
    }

    showStatus('保存しました', 'success');
    textarea.value = '';
    textarea.focus();
  } catch (e) {
    showStatus(`エラー: ${e.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
  }
}

// ── Base64 エンコード/デコード（日本語対応） ──
function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function decodeBase64(base64) {
  const cleaned = base64.replace(/\n/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// ── 起動 ──
document.addEventListener('DOMContentLoaded', init);
