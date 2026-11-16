# MagnetParser

MagnetParser is a modern Chrome extension (Manifest V3) that quickly extracts and copies `magnet:` links from any webpage, and allows you to send them directly to your **qBittorrent** instance with a single click.

## Features

- **Automatic Extraction**: Automatically scans the active tab for magnet links when the extension popup opens.
- **Direct Send to qBittorrent**: Dispatch extracted magnet links directly to your local or remote qBittorrent client via its WebUI API.
- **One-Click Copy**: Copies all extracted magnet links to your clipboard formatted and ready to paste into any torrent client.
- **Configurable Settings**: In-popup and dedicated Options page to configure your qBittorrent server URL, authentication credentials, custom tags, and initial paused state.
- **Built-in Connection Tester**: Test your qBittorrent connection and verify credentials directly from the settings interface.
- **CSRF & Header Management**: Automatically manages origin and referer headers via Chrome's `declarativeNetRequest` API to pass qBittorrent's CSRF and host header validation out of the box.
- **Deduplication**: Automatically cleans and removes duplicate magnet links.
- **Dark Mode Support**: Adapts automatically to your browser/system theme.

## Installation

### Load Unpacked in Chrome / Chromium

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** via the toggle switch in the top-right corner.
4. Click **Load unpacked** and select the `magnet-parser` folder.
5. Pin the extension to your toolbar for easy access.

## qBittorrent Setup

To send magnet links directly to qBittorrent:

1. **Enable WebUI in qBittorrent**:
   - Open qBittorrent and navigate to **Tools > Options > Web UI**.
   - Check **Web User Interface (Remote control)**.
   - Note your IP and Port (default is `8080`).
   - Set a **Username** and **Password**.
2. **Configure MagnetParser**:
   - Click the MagnetParser extension icon.
   - Click the **⚙️ Settings** icon in the header (or right-click the extension icon and select **Options**).
   - Enter your **Server URL** (e.g. `http://localhost:8080` or `http://192.168.1.100:8080`).
   - Enter your **Username** and **Password**.
   - (Optional) Set default tags or choose whether torrents should start paused.
   - Click **Test Connection** to verify your setup, then click **Save Settings**.
3. **Send Magnets**:
   - On any webpage with magnet links, open the extension and click **Send to qBittorrent**.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](magnet-parser/LICENSE) file for details.
