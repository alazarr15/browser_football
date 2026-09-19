import http.server
import socket
import socketserver
import os
import urllib.request
import urllib.parse
import time
import re

PORT = 8080

# Default live match stream
LIVE_STREAM_M3U8 = "https://a16.kora-plus.li/live/usa.m3u8?token=3OWrgM5SPx-MHGNNgAFcKRykUVM&exp=1789830116"

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

class TVHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_GET(self):
        # Sony Bravia KDL Native Stream Relay Endpoint
        # Relays live HLS chunks as a single continuous MPEG-TS stream (video/mp2t)
        if self.path.startswith('/live.ts'):
            self.handle_live_ts_stream()
            return
        
        super().do_GET()

    def handle_live_ts_stream(self):
        print("[TV Relay] Sony Bravia connected to live stream!")
        self.send_response(200)
        self.send_header('Content-Type', 'video/mp2t')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store')
        self.send_header('Connection', 'close')
        super().end_headers()

        stream_url = LIVE_STREAM_M3U8
        seen_chunks = set()
        user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

        try:
            while True:
                # 1. Fetch live playlist
                try:
                    req = urllib.request.Request(stream_url, headers={'User-Agent': user_agent})
                    with urllib.request.urlopen(req, timeout=5) as res:
                        content = res.read().decode('utf-8', errors='ignore')
                except Exception as e:
                    time.sleep(1)
                    continue

                # 2. Extract .ts segment URLs
                lines = [line.strip() for line in content.splitlines() if line.strip() and not line.startswith('#')]
                
                new_chunks = []
                for line in lines:
                    chunk_url = urllib.parse.urljoin(stream_url, line)
                    if chunk_url not in seen_chunks:
                        new_chunks.append(chunk_url)
                        seen_chunks.add(chunk_url)

                # Keep seen_chunks size bounded
                if len(seen_chunks) > 100:
                    seen_chunks = set(list(seen_chunks)[-50:])

                # 3. Stream chunks to TV
                if new_chunks:
                    for chunk_url in new_chunks:
                        try:
                            creq = urllib.request.Request(chunk_url, headers={'User-Agent': user_agent})
                            with urllib.request.urlopen(creq, timeout=5) as cres:
                                chunk_data = cres.read()
                                self.wfile.write(chunk_data)
                                self.wfile.flush()
                        except (BrokenPipeError, ConnectionResetError):
                            print("[TV Relay] TV disconnected.")
                            return
                        except Exception as ce:
                            pass
                else:
                    time.sleep(1)

        except (BrokenPipeError, ConnectionResetError):
            print("[TV Relay] TV client closed stream.")
        except Exception as err:
            print(f"[TV Relay] Error: {err}")

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    local_ip = get_local_ip()
    url = f"http://{local_ip}:{PORT}"

    print("=" * 65)
    print("  SONY BRAVIA KDL - HARDWARE ACCELERATED STREAM SERVER")
    print("=" * 65)
    print(f"\n>> Step 1: Open your Sony Bravia KDL Internet Browser")
    print(f">> Step 2: Enter this URL:")
    print(f"\n      {url}\n")
    print(f"  * Native MPEG-TS Relay is active at: {url}/live.ts")
    print("=" * 65)
    print("Press Ctrl+C to stop.\n")

    with ThreadedTCPServer(("", PORT), TVHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
