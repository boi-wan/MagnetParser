/**
 * MagnetParser - qBittorrent Client Service
 * Handles settings persistence, header rewriting, authentication,
 * and adding torrents via the qBittorrent WebUI v2 API.
 */

const QBitService = (() => {
  const DEFAULT_SETTINGS = {
    serverUrl: 'http://localhost:8080',
    username: '',
    password: '',
    tags: 'MagnetParser',
    startPaused: false
  };

  const DNR_RULE_ID = 1001;

  /**
   * Normalize and validate a server URL.
   * Ensures http/https scheme, removes trailing slashes, and checks syntax.
   */
  function normalizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let trimmed = rawUrl.trim();
    if (!trimmed) return '';

    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'http://' + trimmed;
    }

    // Strip trailing slashes
    trimmed = trimmed.replace(/\/+$/, '');

    try {
      const parsed = new URL(trimmed);
      return parsed.origin;
    } catch {
      return trimmed;
    }
  }

  /**
   * Load saved settings from chrome.storage.local
   */
  async function loadSettings() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const data = await chrome.storage.local.get(['qbittorrentSettings']);
      if (data && data.qbittorrentSettings) {
        return {
          ...DEFAULT_SETTINGS,
          ...data.qbittorrentSettings
        };
      }
    } catch (err) {
      console.warn('Failed to load qBittorrent settings:', err);
    }

    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Update declarativeNetRequest dynamic rule to inject matching Origin & Referer headers.
   * This neutralizes qBittorrent's CSRF and Host Header validation blocks without requiring
   * the user to manually disable security in their qBittorrent configuration.
   */
  async function updateDNRHeadersRule(serverUrl) {
    if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) {
      return;
    }

    const cleanUrl = normalizeUrl(serverUrl);
    if (!cleanUrl) {
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [DNR_RULE_ID]
        });
      } catch (err) {
        console.warn('Failed to remove DNR rule:', err);
      }
      return;
    }

    try {
      const parsed = new URL(cleanUrl);
      const origin = parsed.origin;

      const rule = {
        id: DNR_RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Origin', operation: 'set', value: origin },
            { header: 'Referer', operation: 'set', value: `${origin}/` }
          ]
        },
        condition: {
          urlFilter: `${origin}/*`,
          resourceTypes: ['xmlhttprequest']
        }
      };

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [DNR_RULE_ID],
        addRules: [rule]
      });
    } catch (err) {
      console.warn('Failed to configure declarativeNetRequest headers:', err);
    }
  }

  /**
   * Save settings to chrome.storage.local and update DNR rules
   */
  async function saveSettings(settings) {
    const toSave = {
      serverUrl: normalizeUrl(settings.serverUrl),
      username: (settings.username || '').trim(),
      password: settings.password || '',
      tags: (settings.tags || '').trim(),
      startPaused: Boolean(settings.startPaused)
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ qbittorrentSettings: toSave });
    }

    await updateDNRHeadersRule(toSave.serverUrl);
    return toSave;
  }

  /**
   * Authenticate with the qBittorrent WebUI.
   * POST /api/v2/auth/login
   */
  async function qbitLogin(serverUrl, username, password) {
    const cleanUrl = normalizeUrl(serverUrl);
    if (!cleanUrl) {
      return { success: false, error: 'Server URL is required.' };
    }

    // If both username and password are empty, user might have auth bypass enabled for localhost/LAN.
    // Try a probe to /api/v2/app/version first.
    if (!username && !password) {
      try {
        const probe = await fetch(`${cleanUrl}/api/v2/app/version`, { credentials: 'include' });
        if (probe.ok) {
          return { success: true, bypassed: true };
        }
      } catch (err) {
        return {
          success: false,
          error: `Could not connect to qBittorrent at ${cleanUrl}. Please ensure it is running.`
        };
      }
    }

    const endpoint = `${cleanUrl}/api/v2/auth/login`;
    const body = new URLSearchParams({
      username: username || '',
      password: password || ''
    }).toString();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body,
        credentials: 'include'
      });

      // qBittorrent v5.2+ returns 204 No Content on successful auth
      if (response.status === 204) {
        return { success: true };
      }

      // qBittorrent v4.x / 5.0 returns 200 with text 'Ok.' or 'Fails.'
      if (response.status === 200) {
        const text = await response.text();
        if (text.trim() === 'Fails.') {
          return { success: false, error: 'Invalid username or password.' };
        }
        return { success: true };
      }

      if (response.status === 403 || response.status === 401) {
        const text = await response.text().catch(() => '');
        if (text.includes('Invalid Host') || text.includes('Referer')) {
          return {
            success: false,
            error: 'Host/Origin check failed. Ensure CSRF protection is configured in qBittorrent.'
          };
        }
        return { success: false, error: 'Authentication failed (403 Forbidden). Check credentials.' };
      }

      return {
        success: false,
        error: `Login failed with HTTP status ${response.status} (${response.statusText}).`
      };
    } catch (err) {
      return {
        success: false,
        error: `Could not connect to ${cleanUrl}. Check network connectivity and that qBittorrent WebUI is enabled.`
      };
    }
  }

  /**
   * Get qBittorrent application version.
   * GET /api/v2/app/version
   */
  async function qbitGetVersion(serverUrl) {
    const cleanUrl = normalizeUrl(serverUrl);
    try {
      const response = await fetch(`${cleanUrl}/api/v2/app/version`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const version = await response.text();
        return { success: true, version: version.trim() };
      }
      return { success: false, error: `HTTP ${response.status}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Add magnet links to qBittorrent.
   * POST /api/v2/torrents/add
   */
  async function qbitAddTorrents(serverUrl, links, options = {}) {
    const cleanUrl = normalizeUrl(serverUrl);
    if (!links || links.length === 0) {
      return { success: false, error: 'No links to send.' };
    }

    const endpoint = `${cleanUrl}/api/v2/torrents/add`;
    const formData = new FormData();
    formData.append('urls', links.join('\n'));

    if (options.tags) {
      formData.append('tags', options.tags);
    }
    if (options.startPaused) {
      formData.append('paused', 'true');
    }
    if (options.savepath) {
      formData.append('savepath', options.savepath);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (response.ok) {
        const text = await response.text();
        if (text.trim() === 'Fails.') {
          return { success: false, error: 'qBittorrent rejected the magnet links.' };
        }
        return { success: true, count: links.length };
      }

      if (response.status === 403 || response.status === 401) {
        return { success: false, error: 'Unauthorized. Session expired or missing permissions.' };
      }

      return {
        success: false,
        error: `Failed to add torrents: HTTP ${response.status} (${response.statusText}).`
      };
    } catch (err) {
      return {
        success: false,
        error: `Network error when adding torrents: ${err.message}`
      };
    }
  }

  /**
   * Test connection to qBittorrent with provided settings.
   */
  async function testQBitConnection(settings) {
    const cleanUrl = normalizeUrl(settings.serverUrl);
    if (!cleanUrl) {
      return { success: false, error: 'Please enter a valid server URL.' };
    }

    await updateDNRHeadersRule(cleanUrl);

    const loginRes = await qbitLogin(cleanUrl, settings.username, settings.password);
    if (!loginRes.success) {
      return loginRes;
    }

    const verRes = await qbitGetVersion(cleanUrl);
    return {
      success: true,
      version: verRes.success ? verRes.version : null
    };
  }

  /**
   * High-level workflow: Authenticate and send magnet links to qBittorrent.
   */
  async function sendTorrentsToQBit(links, providedSettings = null) {
    const settings = providedSettings || (await loadSettings());

    if (!settings.serverUrl) {
      return {
        success: false,
        needsConfig: true,
        error: 'qBittorrent URL is not configured. Please set your instance link in Settings.'
      };
    }

    const cleanUrl = normalizeUrl(settings.serverUrl);
    const validLinks = (links || [])
      .map(l => (typeof l === 'string' ? l.trim() : ''))
      .filter(l => l.toLowerCase().startsWith('magnet:'));

    if (validLinks.length === 0) {
      return { success: false, error: 'No valid magnet links found to send.' };
    }

    await updateDNRHeadersRule(cleanUrl);

    // 1. Authenticate
    const loginRes = await qbitLogin(cleanUrl, settings.username, settings.password);
    if (!loginRes.success) {
      return loginRes;
    }

    // 2. Add torrents
    const addRes = await qbitAddTorrents(cleanUrl, validLinks, {
      tags: settings.tags,
      startPaused: settings.startPaused
    });

    return addRes;
  }

  return {
    DEFAULT_SETTINGS,
    normalizeUrl,
    loadSettings,
    saveSettings,
    updateDNRHeadersRule,
    qbitLogin,
    qbitGetVersion,
    qbitAddTorrents,
    testQBitConnection,
    sendTorrentsToQBit
  };
})();

// Export for Node/CommonJS test environments if applicable
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QBitService;
}
