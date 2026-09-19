# Smart TV Stream Player (42" TV Optimized)

An ultra-lightweight, zero-bloat web player designed specifically for Smart TV built-in browsers (Samsung Tizen, LG webOS, Hisense VIDAA, Opera TV, NetFront, etc.).

---

## Features
- **Ultra-Lightweight**: Built in pure HTML5, CSS3, and vanilla JS. Total bundle is tiny, ensuring zero stutter or browser crashes on low-RAM TV chipsets.
- **Hardware-Accelerated HLS**: Directly feeds `.m3u8` live streams to the TV's native `<video>` hardware decoder, with an automatic Hls.js fallback.
- **10-Foot UI for 42-inch Displays**: Scaled fonts, high-contrast theme, and glowing green focus indicators visible from across the room.
- **Full TV Remote D-Pad Navigation**: Navigate effortlessly using the arrow keys, OK/Enter, and Back button on your TV remote.
- **Pre-configured Channel**: Loaded with your TNT Sports 1 stream.
- **Custom Channels**: Easily add, save, and switch between your favorite `.m3u8` links. All saved to TV storage (`localStorage`).
- **Auto-Hiding Controls (OSD)**: Clean distraction-free viewing; controls fade out after 4 seconds and reappear on any button press.

---

## Remote Control Key Mappings

| TV Remote Button | Function |
| :--- | :--- |
| **Arrow Left / Right** | Move between control buttons / seek |
| **Arrow Up / Down** | Quick channel switch (when controls are hidden) / Navigate channel list |
| **OK / Enter** | Select / Toggle highlighted button |
| **Back / Return / ESC** | Close channel drawer / Close modal / Hide controls |
| **Play / Pause / Space** | Toggle Play and Pause |
| **Red Button / F** | Toggle Fullscreen |
| **Green Button / C** | Open / Close Channel Guide |
| **Yellow Button / R** | Reload & Reconnect Stream |
| **Blue Button / A** | Toggle Aspect Ratio (Fit 16:9 / Stretch / Zoom) |

---

## How to Run on Your Smart TV

### Option 1: Over Your Home Wi-Fi (No Internet Domain Required)
1. Make sure your PC and Smart TV are connected to the **same Wi-Fi network**.
2. On your PC, double-click `start_server.bat` (or run `python start_server.py`).
3. It will display a local IP address, for example:
   ```
   http://192.168.1.5:8080
   ```
4. Open the built-in browser on your Smart TV, type that address into the URL bar, and press Enter.
5. Bookmark the address in your TV's browser for quick 1-click access!

### Option 2: Host for Free on the Cloud (Short URL to type on TV)
Because this project consists of purely static files (`index.html`, `style.css`, `player.js`, `hls.min.js`), you can host it completely for free on:
- **GitHub Pages**: Push this folder to a GitHub repository, enable Pages in repository settings, and get a URL like `https://username.github.io/browser_football/`.
- **Cloudflare Pages / Vercel**: Drag and drop this folder to get a clean, short URL.
- Once loaded, type the short URL into your TV browser once, add it to TV Bookmarks, and you never have to type it again.
