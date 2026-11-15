#!/usr/bin/env python3
"""One-command local startup. Creates isolated dependencies and starts both services."""
import hashlib
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import venv
import webbrowser

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "rockit"
API_PORT = int(os.getenv("ROCKIT_API_PORT", "8000"))
WEB_PORT = int(os.getenv("ROCKIT_PORT", "3000"))
processes = []
exit_code = 0


def available(port):
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def run(args, cwd=ROOT):
    subprocess.run([str(a) for a in args], cwd=cwd, check=True)


def main():
    npm = shutil.which("npm")
    node = shutil.which("node")
    if not npm or not node:
        raise RuntimeError("Node.js and npm are required. Install Node.js 20 LTS or newer, then run again.")
    major = int(subprocess.check_output([node, "--version"], text=True).strip().lstrip("v").split(".")[0])
    if major < 18:
        raise RuntimeError("This project needs Node.js 18.17+; Node.js 20 or newer is recommended.")
    if sys.version_info < (3, 10):
        raise RuntimeError("Python 3.10 or newer is required.")
    for port in [API_PORT, WEB_PORT]:
        if not available(port):
            raise RuntimeError(f"Port {port} is already in use. Stop the previous server (Control+C in its terminal), then retry. No existing process was stopped.")
    env_dir = ROOT / ".venv"
    python = env_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.exists():
        print("Setting up the Python environment…", flush=True)
        venv.EnvBuilder(with_pip=True).create(env_dir)
    requirements = ROOT / "api/requirements.txt"
    digest = hashlib.sha256(requirements.read_bytes()).hexdigest()
    marker = env_dir / "rockit-requirements.sha256"
    if not marker.exists() or marker.read_text() != digest:
        print("Installing API dependencies (first run)…", flush=True)
        run([python, "-m", "pip", "install", "-r", requirements])
        marker.write_text(digest)
    lock = FRONTEND / "package-lock.json"
    lock_hash = hashlib.sha256(lock.read_bytes()).hexdigest()
    npm_marker = FRONTEND / "node_modules/.rockit-lock.sha256"
    if not npm_marker.exists() or npm_marker.read_text() != lock_hash:
        print("Installing frontend dependencies (first run)…", flush=True)
        run([npm, "ci", "--no-audit", "--no-fund"], FRONTEND)
        npm_marker.write_text(lock_hash)
    print(f"Starting RockIT API on {API_PORT} and frontend on {WEB_PORT}…", flush=True)
    processes.append(subprocess.Popen([str(python), "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(API_PORT)], cwd=ROOT / "api"))
    env = dict(os.environ, BACKEND_URL=f"http://127.0.0.1:{API_PORT}")
    processes.append(subprocess.Popen([npm, "run", "dev", "--", "--without-api", "--hostname", "127.0.0.1", "--port", str(WEB_PORT)], cwd=FRONTEND, env=env))
    target = f"http://localhost:{WEB_PORT}"
    for _ in range(90):
        if any(p.poll() is not None for p in processes):
            raise RuntimeError("A server exited during startup. Read the error above.")
        try:
            with urllib.request.urlopen(target + "/backend/api/health", timeout=3) as response:
                if response.status == 200:
                    print(f"\nRockIT is ready: {target}\nKeep this terminal open. Press Control+C to stop both servers.\n", flush=True)
                    if os.getenv("ROCKIT_NO_BROWSER") != "1":
                        webbrowser.open(target)
                    break
        except Exception:
            time.sleep(1)
    else:
        raise RuntimeError("The application did not become ready. Read the server logs above.")
    while all(p.poll() is None for p in processes):
        time.sleep(1)
    raise RuntimeError("A RockIT service stopped. Read its error above.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopping RockIT…")
    except Exception as error:
        print(f"\nCould not start RockIT: {error}", file=sys.stderr)
        exit_code = 1
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
        for process in processes:
            try:
                process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                process.kill()

    sys.exit(exit_code)
