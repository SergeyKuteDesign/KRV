"""Типограф для index.html: неразрывные пробелы прямо в разметке.

Правила те же, что в typograph() в main.js (там — страховка для текста, который
появляется из JS):
  • короткое слово (предлог, союз, частица, местоимение) приклеивается к следующему —
    в конце строки не висят «и», «в», «для», «или» и т. п.;
  • перед тире, «же», «ли», «бы» — неразрывный пробел;
  • число приклеивается к следующему слову или числу («13 кг», «1 190 ₽», «3 дня»);
  • в заголовках h1–h3 последнее короткое слово не уходит на строку одно.

Запуск после правки текстов:  python tools/typograph.py
"""
import re
import sys
from pathlib import Path

NB = " "
SHORT = ("а|в|во|и|к|ко|о|об|обо|с|со|у|я|ты|мы|вы|он|она|они|не|ни|но|на|по|за|из|от|до|для|без|под|над|при|про|"
         "через|перед|или|как|что|это|то|так|уже|ещё|еще|где|кто|чем|все|всё|мой|моя|мои|твой|твоя|твои|раз|два|три|"
         "её|его|их|если|когда|чтобы|ведь|лишь|даже|только")
RE_AFTER = re.compile(r"(^|[\s («\"„])(" + SHORT + r")[ \t\n\r]+", re.I)
RE_PARTICLE = re.compile(r"[ \t\n\r]+(же|ли|бы)(?=[\s .,!?…»]|$)", re.I)
RE_DASH = re.compile(r"[ \t\n\r]+([—–])")
RE_NUM = re.compile(r"(\d)[ \t\n\r]+(?=[\dА-Яа-яЁёA-Za-z₽%+≈])")
SKIP = {"script", "style", "svg", "code", "pre", "textarea", "title"}
HEAD = {"h1", "h2", "h3"}
TOKEN = re.compile(r"(<!--.*?-->|<[^>]+>)", re.S)


def fix(text: str) -> str:
    t = text.replace("&nbsp;", NB)
    t = RE_AFTER.sub(lambda m: m.group(1) + m.group(2) + NB, t)
    t = RE_AFTER.sub(lambda m: m.group(1) + m.group(2) + NB, t)  # цепочки «и в»
    t = RE_PARTICLE.sub(lambda m: NB + m.group(1), t)
    t = RE_DASH.sub(lambda m: NB + m.group(1), t)
    t = RE_NUM.sub(lambda m: m.group(1) + NB, t)
    return t


def process(html: str) -> str:
    parts = TOKEN.split(html)
    stack = []
    head_last = None  # индекс последнего непустого текста внутри текущего заголовка
    for i, p in enumerate(parts):
        if i % 2:  # тег или комментарий
            m = re.match(r"<\s*(/?)\s*([a-zA-Z0-9]+)", p)
            if not m:
                continue
            closing, name = m.group(1) == "/", m.group(2).lower()
            if name in SKIP:
                if closing:
                    if name in stack:
                        while stack and stack.pop() != name:
                            pass
                elif not p.rstrip().endswith("/>"):
                    stack.append(name)
            elif name in HEAD:
                if not closing:
                    head_last = -1
                elif head_last is not None:
                    if head_last >= 0:
                        v = parts[head_last]
                        core = v.rstrip()
                        j = max(core.rfind(" "), core.rfind(NB))
                        tail = core[j + 1:]
                        if j > 0 and core[j] == " " and len(tail) <= 9:
                            parts[head_last] = core[:j] + NB + tail + v[len(core):]
                    head_last = None
            continue
        if stack or not p.strip():
            continue
        # в атрибутах ничего не трогаем — сюда попадает только текст между тегами
        parts[i] = fix(p)
        if head_last is not None:
            head_last = i
    out = "".join(parts)
    return out.replace(NB, "&nbsp;")


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "index.html")
    src = path.read_text(encoding="utf-8")
    dst = process(src)
    if dst != src:
        path.write_text(dst, encoding="utf-8", newline="\n")
        print(f"{path.name}: обновлён")
    else:
        print(f"{path.name}: без изменений")


if __name__ == "__main__":
    main()
