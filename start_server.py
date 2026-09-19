import http.server
import socket
import socketserver
import os

PORT = 8080

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't need to be reachable, used to get the interface IP on local network
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

class TVHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and caching headers for smooth TV streaming
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    # Ensure working directory is the script folder
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    local_ip = get_local_ip()
    url = f"http://{local_ip}:{PORT}"

    print("=" * 60)
    print("  SMART TV STREAM PLAYER - LOCAL SERVER")
    print("=" * 60)
    print(f"\n>> Open your Smart TV's web browser and type:")
    print(f"\n      {url}\n")
    print(f">> On this PC, you can test at: http://localhost:{PORT}")
    print("=" * 60)
    print("Press Ctrl+C to stop the server.\n")

    with socketserver.TCPServer(("", PORT), TVHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
