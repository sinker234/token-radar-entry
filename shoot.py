"""Render the built dashboard locally and take the entry's three screenshots."""
import os
import subprocess
import sys
import time

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
PORT = 8937

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", OUT],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
try:
    time.sleep(1.0)
    from camoufox.sync_api import Camoufox

    base = f"http://127.0.0.1:{PORT}/dashboard/index.html"
    views = [
        ("1-board.png", base),
        ("2-detail.png", base + "#p=steakhouse-financial"),
        ("3-filtered.png", base + "#category=Lending"),
    ]
    with Camoufox(headless=True, canvas_noise=False, i_know_what_im_doing=True) as browser:
        for name, url in views:
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            page.goto(url, wait_until="load")
            page.wait_for_selector("tbody tr", timeout=20000)
            page.wait_for_timeout(700)
            path = os.path.join(SHOTS, name)
            page.screenshot(path=path)
            print(name, os.path.getsize(path), "bytes")
            page.close()
finally:
    server.terminate()
