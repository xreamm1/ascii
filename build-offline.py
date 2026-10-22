#!/usr/bin/env python3
"""Собирает ascii-offline.html — игру одним файлом, которая работает без интернета.
Берёт index.html и подставляет внутрь всё, что он грузит из сети: three.js, шрифт JetBrains Mono, мир для помощников.
Нужны python3 и npm (интернет нужен только при сборке)."""
import base64, glob, json, os, re, subprocess, sys, tempfile

root = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(root, "index.html"), encoding="utf8").read()

with tempfile.TemporaryDirectory() as tmp:
    for pkg in ("three@0.160.0", "@fontsource/jetbrains-mono@5.3.0"):
        subprocess.run(["npm", "pack", pkg], cwd=tmp, check=True, capture_output=True)
    for tgz in glob.glob(os.path.join(tmp, "*.tgz")):
        subprocess.run(["tar", "xzf", tgz, "-C", tmp, "--one-top-level=" + os.path.basename(tgz)[:-4]], check=True)
    three = open(glob.glob(os.path.join(tmp, "three-*", "package", "build", "three.module.min.js"))[0], "rb").read()
    fonts = {}
    for sub in ("latin", "cyrillic"):
        for w in (400, 700):
            f = glob.glob(os.path.join(tmp, "fontsource-jetbrains-mono-*", "package", "files", f"jetbrains-mono-{sub}-{w}-normal.woff2"))[0]
            fonts[(sub, w)] = base64.b64encode(open(f, "rb").read()).decode()

def sub1(old, new, pattern=False):
    global html
    n = len(re.findall(old, html, re.S)) if pattern else html.count(old)
    if n != 1:
        sys.exit(f"не нашёл место для замены ({n}): {old[:60]}")
    html = re.sub(old, lambda m: new, html, flags=re.S) if pattern else html.replace(old, new)

# three.js внутрь (importmap принимает data: адрес)
data_url = "data:text/javascript;base64," + base64.b64encode(three).decode()
sub1(r'<script type="importmap">.*?</script>', '<script type="importmap">{"imports":{"three":"%s"}}</script>' % data_url, True)
# шрифт внутрь
ranges = {"latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
          "cyrillic": "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116"}
face = "".join('@font-face{font-family:"JetBrains Mono";font-weight:%d;src:url(data:font/woff2;base64,%s) format("woff2");unicode-range:%s}' % (w, fonts[(sub, w)], ranges[sub])
               for sub in ("latin", "cyrillic") for w in (400, 700))
sub1(r'<link rel="preconnect" href="https://fonts.googleapis.com">\s*<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\s*<link href="https://fonts.googleapis.com/[^"]*" rel="stylesheet">', "<style>" + face + "</style>", True)
# без Firebase: сетевых лобби нет, остаётся одиночная игра и игра вдвоём напрямую
sub1(r"const FIREBASE_CONFIG = \{.*?\};", "const FIREBASE_CONFIG = null;  // офлайн-сборка", True)
# мир для помощников «Вкусно и точка»
world = open(os.path.join(root, "worlds", "vkusno-i-tochka-3-etazha.baseAscii"), encoding="utf8").read()
sub1("<script>\n!function(o,e){", "<script>window.HELPER_WORLD_DATA = %s;</script>\n<script>\n!function(o,e){" % json.dumps(json.loads(world), ensure_ascii=False, separators=(",", ":")))
sub1("<title>ASCII Baseplate</title>", "<title>ASCII Baseplate (офлайн)</title>")
open(os.path.join(root, "ascii-offline.html"), "w", encoding="utf8").write(html)
print("готово: ascii-offline.html,", round(len(html) / 1e6, 2), "МБ")
