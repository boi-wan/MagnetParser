/**
 * MagnetParser - Content Script
 * Extracts magnet links from the current DOM.
 */

function extractMagnetLinks() {
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

// Support runtime message passing
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract' || request.greeting === 'hello') {
      sendResponse({ hrefs: extractMagnetLinks() });
    }
    return false;
  });
}

// Return result when executed as a scripted file
extractMagnetLinks();
