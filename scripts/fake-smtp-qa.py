"""SMTP local QA: guarda mensajes en un archivo, nunca envía correo externo."""
import argparse
import socketserver
from pathlib import Path


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        self.wfile.write(b"220 qa.local ESMTP\r\n")
        data = False
        message = bytearray()
        while line := self.rfile.readline():
            command = line.decode("utf-8", errors="replace").strip()
            if data:
                if command == ".":
                    self.server.output.parent.mkdir(parents=True, exist_ok=True)
                    with self.server.output.open("ab") as stream:
                        stream.write(message + b"\n--- QA MESSAGE END ---\n")
                    message.clear()
                    data = False
                    self.wfile.write(b"250 Stored for QA\r\n")
                else:
                    message.extend(line[1:] if line.startswith(b"..") else line)
                continue
            verb = command.split(" ", 1)[0].upper()
            if verb in {"EHLO", "HELO"}:
                self.wfile.write(b"250-qa.local\r\n250 SIZE 1000000\r\n")
            elif verb in {"MAIL", "RCPT", "RSET"}:
                self.wfile.write(b"250 OK\r\n")
            elif verb == "DATA":
                data = True
                self.wfile.write(b"354 Send message\r\n")
            elif verb == "QUIT":
                self.wfile.write(b"221 Bye\r\n")
                break
            else:
                self.wfile.write(b"502 Unsupported\r\n")


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=2526)
    parser.add_argument("--output", required=True)
    options = parser.parse_args()
    with Server(("127.0.0.1", options.port), Handler) as server:
        server.output = Path(options.output)
        server.serve_forever()
