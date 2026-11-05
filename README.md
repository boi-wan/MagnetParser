# MagnetParser

MagnetParser is a modern Chrome extension (Manifest V3) that quickly extracts and copies `magnet:` links from any webpage.

## Features

- **Automatic Extraction**: Automatically scans the active tab for magnet links when the extension popup opens.
- **One-Click Copy**: Copies all extracted magnet links to your clipboard formatted and ready to paste into your torrent client.
- **Deduplication**: Automatically cleans and removes duplicate magnet links.
- **Privacy & Security Focused**: Built with Manifest V3 and uses minimal permissions (`activeTab`, `scripting`, `clipboardWrite`). No broad website tracking permissions or persistent background processes.
- **Dark Mode Support**: Adapts automatically to your browser/system theme.

## Installation

### Load Unpacked in Chrome / Chromium

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** via the toggle switch in the top-right corner.
4. Click **Load unpacked** and select the `magnet-parser` folder.
5. Pin the extension to your toolbar for easy access.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](magnet-parser/LICENSE) file for details.
