"""Сборка для прода (запускается в deploy-vaskristi-ru на сервере, в репозитории ничего не меняет).

1. Стили встраиваются прямо в index.html (<style> вместо <link>): первый экран рисуется,
   как только пришёл HTML, без отдельного запроса за CSS — это главный выигрыш для
   First Contentful Paint / Largest Contentful Paint в Lighthouse.
2. CSS при этом ужимается: без комментариев и лишних пробелов.
3. Метка версии ?v=<hash> у остальных файлов, чтобы браузер не брал старые из кэша.

python3 tools/build.py index.html <hash>
"""
import re
import sys
from pathlib import Path


def minify_css(css: str) -> str:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{};,])\s*", r"\1", css)  # двоеточия не трогаем: в селекторах пробел перед ":" значим
    css = css.replace(";}", "}")
    return css.strip()


def main():
    html_path = Path(sys.argv[1])
    version = sys.argv[2] if len(sys.argv) > 2 else None
    root = html_path.parent
    html = html_path.read_text(encoding="utf-8")
    m = re.search(r'<link rel="stylesheet" href="(assets/css/style\.css)(\?v=[^"]*)?">', html)
    if m:
        css = (root / m.group(1)).read_text(encoding="utf-8")
        css = css.replace('url("../', 'url("assets/')  # пути из css/ → от корня сайта
        html = html.replace(m.group(0), "<style>" + minify_css(css) + "</style>")
    if version:
        html = re.sub(r"\?v=[A-Za-z0-9]+", "?v=" + version, html)
    html_path.write_text(html, encoding="utf-8", newline="\n")
    print("build:", "css inlined" if m else "css link not found", "| v=" + (version or "-"))


if __name__ == "__main__":
    main()
