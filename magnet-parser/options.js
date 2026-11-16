/**
 * MagnetParser - Options Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const optionsForm = document.getElementById('optionsForm');
  const inputServerUrl = document.getElementById('inputServerUrl');
  const inputUsername = document.getElementById('inputUsername');
  const inputPassword = document.getElementById('inputPassword');
  const inputTags = document.getElementById('inputTags');
  const checkboxStartPaused = document.getElementById('checkboxStartPaused');
  const btnTogglePassword = document.getElementById('buttonTogglePassword');
  const btnTestConnection = document.getElementById('buttonTestConnection');
  const btnSaveSettings = document.getElementById('buttonSaveSettings');
  const optionsStatusMessage = document.getElementById('optionsStatusMessage');

  function setStatus(text, type = '') {
    optionsStatusMessage.textContent = text;
    optionsStatusMessage.className = `status-message ${type}`.trim();
  }

  // Load existing settings
  try {
    const settings = await QBitService.loadSettings();
    inputServerUrl.value = settings.serverUrl || '';
    inputUsername.value = settings.username || '';
    inputPassword.value = settings.password || '';
    inputTags.value = settings.tags || '';
    checkboxStartPaused.checked = Boolean(settings.startPaused);
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  // Password toggle
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

  // Test connection
  btnTestConnection.addEventListener('click', async () => {
    const serverUrl = inputServerUrl.value.trim();
    if (!serverUrl) {
      setStatus('Please enter a server URL to test.', 'error');
      inputServerUrl.focus();
      return;
    }

    setStatus('Testing connection to qBittorrent...', '');
    btnTestConnection.disabled = true;

    try {
      const result = await QBitService.testQBitConnection({
        serverUrl,
        username: inputUsername.value,
        password: inputPassword.value
      });

      if (result.success) {
        const ver = result.version ? ` (${result.version})` : '';
        setStatus(`✓ Connection successful!${ver}`, 'success');
      } else {
        setStatus(`✗ ${result.error}`, 'error');
      }
    } catch (err) {
      setStatus(`✗ Connection failed: ${err.message}`, 'error');
    } finally {
      btnTestConnection.disabled = false;
    }
  });

  // Save settings
  optionsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawUrl = inputServerUrl.value.trim();
    if (!rawUrl) {
      setStatus('Server URL cannot be empty.', 'error');
      inputServerUrl.focus();
      return;
    }

    btnSaveSettings.disabled = true;
    setStatus('Saving settings...', '');

    try {
      await QBitService.saveSettings({
        serverUrl: rawUrl,
        username: inputUsername.value,
        password: inputPassword.value,
        tags: inputTags.value,
        startPaused: checkboxStartPaused.checked
      });

      setStatus('✓ Settings saved successfully!', 'success');
    } catch (err) {
      setStatus(`Failed to save settings: ${err.message}`, 'error');
    } finally {
      btnSaveSettings.disabled = false;
    }
  });
});
