/**
 * MagnetParser - Popup Controller
 */

// Function injected into the page to find and extract magnet links
function pageExtractMagnetLinks() {
  const found = new Set();
  const anchors = document.querySelectorAll('a[href*="magnet:"], a[href^="magnet:"]');

  for (const anchor of anchors) {
    const rawHref = anchor.getAttribute('href') || anchor.href;
    if (!rawHref) continue;

    const trimmed = rawHref.trim();
    const magnetIndex = trimmed.toLowerCase().indexOf('magnet:?');

    if (magnetIndex !== -1) {
      found.add(trimmed.slice(magnetIndex));
    } else if (trimmed.toLowerCase().startsWith('magnet:')) {
      found.add(trimmed);
    }
  }

  return Array.from(found);
}

document.addEventListener('DOMContentLoaded', () => {
  // Main view elements
  const btnExtract = document.getElementById('buttonExtract');
  const btnCopy = document.getElementById('buttonCopyToClip');
  const btnSendQbit = document.getElementById('buttonSendQbit');
  const btnClear = document.getElementById('buttonClear');
  const textArea = document.getElementById('magnetContainer');
  const badgeCount = document.getElementById('badgeCount');
  const statusMessage = document.getElementById('statusMessage');

  // Navigation & Views
  const btnSettings = document.getElementById('buttonSettings');
  const btnBackToMain = document.getElementById('buttonBackToMain');
  const mainView = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');

  // Settings form elements
  const settingsForm = document.getElementById('settingsForm');
  const inputServerUrl = document.getElementById('inputServerUrl');
  const inputUsername = document.getElementById('inputUsername');
  const inputPassword = document.getElementById('inputPassword');
  const inputTags = document.getElementById('inputTags');
  const checkboxStartPaused = document.getElementById('checkboxStartPaused');
  const btnTogglePassword = document.getElementById('buttonTogglePassword');
  const btnTestConnection = document.getElementById('buttonTestConnection');
  const btnSaveSettings = document.getElementById('buttonSaveSettings');
  const settingsStatusMessage = document.getElementById('settingsStatusMessage');

  let copyTimeoutId = null;
  let sendTimeoutId = null;

  function setStatus(text, type = '') {
    statusMessage.textContent = text;
    statusMessage.className = `status-message ${type}`.trim();
  }

  function setSettingsStatus(text, type = '') {
    settingsStatusMessage.textContent = text;
    settingsStatusMessage.className = `status-message ${type}`.trim();
  }

  function getMagnetLinks() {
    const rawText = textArea.value.trim();
    if (!rawText) return [];
    return rawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.toLowerCase().startsWith('magnet:'));
  }

  function updateBadgeAndButtons() {
    const rawText = textArea.value.trim();
    const links = rawText
      ? rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
      : [];

    const magnetLinks = getMagnetLinks();
    const count = links.length;

    badgeCount.textContent = `${count} link${count === 1 ? '' : 's'}`;
    if (count > 0) {
      badgeCount.classList.add('has-links');
    } else {
      badgeCount.classList.remove('has-links');
    }

    btnCopy.disabled = (count === 0);
    btnSendQbit.disabled = (magnetLinks.length === 0);
    btnClear.disabled = (textArea.value.length === 0);
  }

  function formatLinks(links) {
    if (!links || links.length === 0) return '';
    return links.join('\n\n') + '\n\n';
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function isRestrictedUrl(url) {
    if (!url) return false;
    return (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('devtools://') ||
      url.startsWith('view-source:') ||
      url.includes('chromewebstore.google.com')
    );
  }

  async function extractFromPage() {
    setStatus('Scanning page for magnet links...', '');
    btnExtract.disabled = true;

    try {
      const tab = await getActiveTab();
      if (!tab || !tab.id) {
        setStatus('Could not locate active browser tab.', 'error');
        return;
      }

      if (isRestrictedUrl(tab.url)) {
        setStatus('Cannot extract from protected or browser system pages.', 'error');
        return;
      }

      let hrefs = [];

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: pageExtractMagnetLinks
        });

        if (results && results[0] && Array.isArray(results[0].result)) {
          hrefs = results[0].result;
        }
      } catch (scriptError) {
        // Fallback to tabs.sendMessage if content script is active
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract' });
          if (response && Array.isArray(response.hrefs)) {
            hrefs = response.hrefs;
          } else {
            throw scriptError;
          }
        } catch {
          throw scriptError;
        }
      }

      if (hrefs.length > 0) {
        textArea.value = formatLinks(hrefs);
        setStatus(`Found ${hrefs.length} magnet link${hrefs.length === 1 ? '' : 's'}.`, 'success');
      } else {
        textArea.value = '';
        setStatus('No magnet links found on this page.', '');
      }

      updateBadgeAndButtons();
    } catch (err) {
      console.error('Failed to extract magnet links:', err);
      setStatus('Unable to scan page. Try reloading the tab.', 'error');
    } finally {
      btnExtract.disabled = false;
    }
  }

  async function copyToClipboard() {
    const textToCopy = textArea.value.trim();
    if (!textToCopy) return;

    let copied = false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        copied = true;
      } catch (err) {
        console.warn('navigator.clipboard write failed, attempting fallback', err);
      }
    }

    if (!copied) {
      textArea.select();
      copied = document.execCommand('copy');
    }

    if (copied) {
      const originalText = 'Copy All';
      btnCopy.textContent = '✓ Copied!';
      btnCopy.disabled = true;

      const lines = textToCopy.split('\n').filter(l => l.trim().length > 0);
      setStatus(`Copied ${lines.length} link${lines.length === 1 ? '' : 's'} to clipboard!`, 'success');

      if (copyTimeoutId) clearTimeout(copyTimeoutId);
      copyTimeoutId = setTimeout(() => {
        btnCopy.textContent = originalText;
        btnCopy.disabled = (textArea.value.trim().length === 0);
      }, 1500);
    } else {
      setStatus('Failed to copy to clipboard.', 'error');
    }
  }

  async function sendToQBittorrent() {
    const magnetLinks = getMagnetLinks();
    if (magnetLinks.length === 0) {
      setStatus('No valid magnet links found to send.', 'error');
      return;
    }

    const settings = await QBitService.loadSettings();
    if (!settings.serverUrl) {
      setStatus('qBittorrent is not configured. Opening Settings...', 'error');
      showSettingsView();
      inputServerUrl.focus();
      return;
    }

    const originalText = 'Send to qBittorrent';
    btnSendQbit.textContent = 'Sending...';
    btnSendQbit.disabled = true;
    setStatus(`Sending ${magnetLinks.length} magnet link${magnetLinks.length === 1 ? '' : 's'} to qBittorrent...`, '');

    try {
      const result = await QBitService.sendTorrentsToQBit(magnetLinks, settings);

      if (result.success) {
        btnSendQbit.textContent = '✓ Sent!';
        setStatus(`Successfully sent ${magnetLinks.length} link${magnetLinks.length === 1 ? '' : 's'} to qBittorrent!`, 'success');

        if (sendTimeoutId) clearTimeout(sendTimeoutId);
        sendTimeoutId = setTimeout(() => {
          btnSendQbit.textContent = originalText;
          updateBadgeAndButtons();
        }, 2000);
      } else {
        btnSendQbit.textContent = originalText;
        btnSendQbit.disabled = false;
        setStatus(`qBittorrent error: ${result.error}`, 'error');

        if (result.needsConfig) {
          showSettingsView();
          inputServerUrl.focus();
        }
      }
    } catch (err) {
      btnSendQbit.textContent = originalText;
      btnSendQbit.disabled = false;
      setStatus(`Failed to send to qBittorrent: ${err.message}`, 'error');
    }
  }

  function clearAll() {
    textArea.value = '';
    setStatus('Cleared.', '');
    updateBadgeAndButtons();
    textArea.focus();
  }

  // Views & Settings Management
  async function loadSettingsIntoForm() {
    const settings = await QBitService.loadSettings();
    inputServerUrl.value = settings.serverUrl || '';
    inputUsername.value = settings.username || '';
    inputPassword.value = settings.password || '';
    inputTags.value = settings.tags || '';
    checkboxStartPaused.checked = Boolean(settings.startPaused);
  }

  async function showSettingsView() {
    mainView.classList.add('hidden');
    settingsView.classList.remove('hidden');
    setSettingsStatus('');
    await loadSettingsIntoForm();
  }

  function showMainView() {
    settingsView.classList.add('hidden');
    mainView.classList.remove('hidden');
    updateBadgeAndButtons();
  }

  // Event Listeners - Main View
  btnExtract.addEventListener('click', extractFromPage);
  btnCopy.addEventListener('click', copyToClipboard);
  btnSendQbit.addEventListener('click', sendToQBittorrent);
  btnClear.addEventListener('click', clearAll);

  btnSettings.addEventListener('click', () => {
    if (settingsView.classList.contains('hidden')) {
      showSettingsView();
    } else {
      showMainView();
    }
  });

  btnBackToMain.addEventListener('click', showMainView);

  textArea.addEventListener('input', updateBadgeAndButtons);
  textArea.addEventListener('change', updateBadgeAndButtons);

  // Event Listeners - Settings Form
  btnTogglePassword.addEventListener('click', () => {
    if (inputPassword.type === 'password') {
      inputPassword.type = 'text';
      btnTogglePassword.textContent = '🔒';
      btnTogglePassword.title = 'Hide password';
    } else {
      inputPassword.type = 'password';
      btnTogglePassword.textContent = '👁';
      btnTogglePassword.title = 'Show password';
    }
  });

  btnTestConnection.addEventListener('click', async () => {
    const serverUrl = inputServerUrl.value.trim();
    if (!serverUrl) {
      setSettingsStatus('Please enter a server URL to test.', 'error');
      inputServerUrl.focus();
      return;
    }

    setSettingsStatus('Testing connection...', '');
    btnTestConnection.disabled = true;

    try {
      const result = await QBitService.testQBitConnection({
        serverUrl,
        username: inputUsername.value,
        password: inputPassword.value
      });

      if (result.success) {
        const ver = result.version ? ` (${result.version})` : '';
        setSettingsStatus(`✓ Connected successfully!${ver}`, 'success');
      } else {
        setSettingsStatus(`✗ ${result.error}`, 'error');
      }
    } catch (err) {
      setSettingsStatus(`✗ Connection failed: ${err.message}`, 'error');
    } finally {
      btnTestConnection.disabled = false;
    }
  });

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawUrl = inputServerUrl.value.trim();
    if (!rawUrl) {
      setSettingsStatus('Server URL cannot be empty.', 'error');
      inputServerUrl.focus();
      return;
    }

    btnSaveSettings.disabled = true;
    setSettingsStatus('Saving settings...', '');

    try {
      await QBitService.saveSettings({
        serverUrl: rawUrl,
        username: inputUsername.value,
        password: inputPassword.value,
        tags: inputTags.value,
        startPaused: checkboxStartPaused.checked
      });

      setSettingsStatus('✓ Settings saved successfully!', 'success');
    } catch (err) {
      setSettingsStatus(`Failed to save settings: ${err.message}`, 'error');
    } finally {
      btnSaveSettings.disabled = false;
    }
  });

  // Initialize
  updateBadgeAndButtons();
  extractFromPage();
});
