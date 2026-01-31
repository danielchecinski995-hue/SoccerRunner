import http.server
import ssl
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Generate self-signed cert if not exists
if not os.path.exists('cert.pem') or not os.path.exists('key.pem'):
    print("Generating SSL certificates...")
    os.system('openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"')

server_address = ('0.0.0.0', 8443)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('cert.pem', 'key.pem')
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"Server running at https://localhost:8443")
print("Open: https://localhost:8443/index.html")
httpd.serve_forever()
