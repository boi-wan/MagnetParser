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
  const btnExtract = document.getElementById('buttonExtract');
  const btnCopy = document.getElementById('buttonCopyToClip');
  const btnClear = document.getElementById('buttonClear');
  const textArea = document.getElementById('magnetContainer');
  const badgeCount = document.getElementById('badgeCount');
  const statusMessage = document.getElementById('statusMessage');

  let copyTimeoutId = null;

  function setStatus(text, type = '') {
    statusMessage.textContent = text;
    statusMessage.className = `status-message ${type}`.trim();
  }

  function updateBadgeAndButtons() {
    const rawText = textArea.value.trim();
    const links = rawText
      ? rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
      : [];

    const count = links.length;
    badgeCount.textContent = `${count} link${count === 1 ? '' : 's'}`;
    if (count > 0) {
      badgeCount.classList.add('has-links');
    } else {
      badgeCount.classList.remove('has-links');
    }

    btnCopy.disabled = (count === 0);
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

  function clearAll() {
    textArea.value = '';
    setStatus('Cleared.', '');
    updateBadgeAndButtons();
    textArea.focus();
  }

  // Event Listeners
  btnExtract.addEventListener('click', extractFromPage);
  btnCopy.addEventListener('click', copyToClipboard);
  btnClear.addEventListener('click', clearAll);

  textArea.addEventListener('input', updateBadgeAndButtons);
  textArea.addEventListener('change', updateBadgeAndButtons);

  // Initialize
  updateBadgeAndButtons();
  extractFromPage();
});
