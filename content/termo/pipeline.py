#!/usr/bin/env python3
"""Build the Termo guess dictionary and the profanity rows of excluded.txt.

Run from anywhere: paths resolve relative to this file. Sources download into
sources/ (gitignored) from pinned commits and must match their sha256. Inputs:
ispell.txt (the frozen IME-USP forms), additions.txt. Outputs: validation.txt,
excluded.txt, candidates.tsv (gitignored), rejected-lexicon-sample.txt.
"""
import hashlib
import os
import random
import re
import unicodedata
import urllib.request
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))

VERO = "https://raw.githubusercontent.com/LibreOffice/dictionaries/67032ee957631908098a72edf48dc81cac27e369/pt_BR"
FREQUENCY = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018/pt_br"
SOURCES = {
    "pt_BR.dic": (f"{VERO}/pt_BR.dic", "a38bfb26b68ece2834e79fe83e48d5792652970ace12db89d1b9674bf9933183"),
    "pt_BR.aff": (f"{VERO}/pt_BR.aff", "21d8ad2a769a60e17e2b5ea4ef11d4d593a58b9e2a82d642ef82d6a4c5523865"),
    "pt_br_full.txt": (f"{FREQUENCY}/pt_br_full.txt", "533b3abaab3b1ea9cec7a150fc8aaf8d428c6f241979cc2224b7ee82f8a369b2"),
}

NORM_RE = re.compile(r"^[a-z]{5}$")
FORBIDDEN_FLAG = "ý"

# Surface forms the expander produces and `hunspell -l` rejects against the
# same pinned files: three FORBIDDENWORD entries and three over-generated forms.
HUNSPELL_REJECTED = {"aguem", "agues", "menas", "éguam", "íguam", "íguas"}

# Normalized VERO forms that are not words: a URL scheme, an abbreviation plural.
JUNK = {"https", "vldis"}

# Lowercase duplicates of proper nouns. Deliberately kept out because a
# legitimate reading exists: "silva" (bramble), "bento" (blessed), "marta"
# (the marten), "rosa" (the flower), "edite" / "tomas" (verb forms).
PROPER_NOUN_DUPLICATES = {
    "jesus", "maria", "paulo", "pedro", "paris", "japao", "egito", "viena",
    "piaui", "ceara", "goias", "souza", "saara", "siria", "cesar", "mario",
    "andre", "artur", "chico", "chica", "jorge", "joana", "berna",
}

# A five-letter form is an excluded.txt `profanity` row when one of its VERO
# stems or spellings is listed here, so a listed stem brings every inflection.
PROFANITY = {
    "bicha", "bosta", "bostar", "cagar", "cagão", "foder", "merda", "mijar",
    "peidar", "peido", "porra", "puto", "vadia", "viado",
}

assert all(len(w) == 5 for w in JUNK | PROPER_NOUN_DUPLICATES)


def fetch_sources() -> None:
    os.makedirs(f"{BASE}/sources", exist_ok=True)
    for name, (url, sha256) in SOURCES.items():
        path = f"{BASE}/sources/{name}"
        if not os.path.exists(path):
            print(f"downloading {url} ...")
            urllib.request.urlretrieve(url, path)
        with open(path, "rb") as f:
            digest = hashlib.sha256(f.read()).hexdigest()
        assert digest == sha256, f"{name}: sha256 {digest}, expected {sha256}"


def normalize(word: str) -> str:
    d = unicodedata.normalize("NFD", word.lower())
    return "".join(c for c in d if unicodedata.category(c) != "Mn")


def read_affixes(path: str) -> dict:
    """flag -> (kind, cross_product, [(strip, add, condition regex or None)])."""
    rules = {}
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            p = line.split()
            if len(p) < 4 or p[0] not in ("SFX", "PFX"):
                continue
            kind, flag = p[0], p[1]
            if flag not in rules:
                rules[flag] = (kind, p[2] == "Y", [])
                continue
            strip = "" if p[2] == "0" else p[2]
            add = "" if p[3] == "0" else p[3].split("/")[0]
            cond = None if p[4] == "." else re.compile(
                f"(?:{p[4]})$" if kind == "SFX" else f"^(?:{p[4]})"
            )
            rules[flag][2].append((strip, add, cond))
    return rules


def apply_affix(kind: str, word: str, rule_list: list) -> list:
    out = []
    for strip, add, cond in rule_list:
        if cond and not cond.search(word):
            continue
        if kind == "SFX" and word.endswith(strip):
            out.append(word[: len(word) - len(strip)] + add)
        elif kind == "PFX" and word.startswith(strip):
            out.append(add + word[len(strip):])
    return out


def expand_vero(dic_path: str, aff_path: str):
    """Yield (surface form, stem) for every stem and affixed form.

    pt_BR.aff uses no continuation classes, so one SFX pass, one PFX pass and
    their cross product (both rules flagged Y) are the whole expansion.
    """
    rules = read_affixes(aff_path)
    with open(dic_path, encoding="utf-8-sig") as f:
        next(f)
        for line in f:
            entry = line.strip()
            if not entry or " " in entry:
                continue
            stem, _, flags = entry.partition("/")
            if FORBIDDEN_FLAG in flags:
                continue
            yield stem, stem
            own = [rules[c] for c in flags if c in rules]
            suffixed = []
            for kind, cross, rule_list in own:
                if kind == "SFX":
                    for form in apply_affix("SFX", stem, rule_list):
                        yield form, stem
                        if cross:
                            suffixed.append(form)
            for kind, cross, rule_list in own:
                if kind == "PFX":
                    for form in apply_affix("PFX", stem, rule_list):
                        yield form, stem
                    if cross:
                        for base in suffixed:
                            for form in apply_affix("PFX", base, rule_list):
                                yield form, stem


def read_lines(name: str) -> list:
    with open(f"{BASE}/{name}", encoding="utf-8") as f:
        return [line.rstrip("\n") for line in f]


def main() -> None:
    fetch_sources()
    rejected = []

    surfaces_of = defaultdict(set)
    stems_of = defaultdict(set)
    for form, stem in expand_vero(f"{BASE}/sources/pt_BR.dic", f"{BASE}/sources/pt_BR.aff"):
        norm = normalize(form)
        if len(norm) != 5:
            continue
        if any(ch.isupper() for ch in form):
            rejected.append((form, "proper-noun (capitalized)"))
        elif not NORM_RE.fullmatch(norm):
            rejected.append((form, "not a-z after normalization"))
        elif form in HUNSPELL_REJECTED:
            rejected.append((form, "rejected by hunspell"))
        elif norm in JUNK:
            rejected.append((form, "junk (not a word)"))
        elif norm in PROPER_NOUN_DUPLICATES:
            rejected.append((form, "proper-noun (lowercase duplicate)"))
        else:
            surfaces_of[norm].add(form)
            stems_of[norm].add(stem)
    print(f"VERO normalized five-letter forms: {len(surfaces_of)}")

    ispell = read_lines("ispell.txt")
    assert ispell == sorted(set(ispell)), "ispell.txt: not sorted and unique"
    assert all(NORM_RE.fullmatch(w) for w in ispell), "ispell.txt: a line is not 5 a-z letters"
    print(f"frozen IME forms: {len(ispell)} ({len(set(ispell) - set(surfaces_of))} not in VERO)")

    additions = [w for w in read_lines("additions.txt") if w]
    assert additions == sorted(set(additions), key=lambda w: (normalize(w), w)), (
        "additions.txt: not sorted by (normalized form, canonical) and unique"
    )
    for w in additions:
        norm = normalize(w)
        assert NORM_RE.fullmatch(norm) and w == w.lower(), f"additions.txt: {w!r} is not a lowercase 5-letter word"
        assert norm not in PROPER_NOUN_DUPLICATES, f"additions.txt: {w!r} is an excluded proper noun"
        assert norm not in surfaces_of and norm not in ispell, f"additions.txt: {w!r} is already a guess, drop the line"
        surfaces_of[norm].add(w)

    validation = sorted(set(surfaces_of) | set(ispell))
    with open(f"{BASE}/validation.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(validation) + "\n")
    print(f"validation.txt: {len(validation)}")

    profanity = sorted(n for n in surfaces_of if (stems_of[n] | surfaces_of[n]) & PROFANITY)
    matched = set().union(*((stems_of[n] | surfaces_of[n]) & PROFANITY for n in profanity))
    assert matched == PROFANITY, f"PROFANITY: {sorted(PROFANITY - matched)} match no form"
    kept = [r for r in read_lines("excluded.txt") if not r.endswith("\tprofanity")]
    rows = sorted(kept + [f"{n}\tprofanity" for n in profanity])
    keys = [r.split("\t")[0] for r in rows]
    assert len(keys) == len(set(keys)), "excluded.txt: a word carries two reasons"
    with open(f"{BASE}/excluded.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(rows) + "\n")
    print(f"excluded.txt: {len(rows)} rows ({len(profanity)} profanity)")

    freq = {}
    with open(f"{BASE}/sources/pt_br_full.txt", encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) == 2:
                freq[parts[0]] = int(parts[1])
    scored = []
    for norm, forms in surfaces_of.items():
        best = sorted(forms, key=lambda c: (-freq.get(c, 0), c))[0]
        if freq.get(best, 0) > 0:
            scored.append((freq[best], norm, best, sorted(forms)))
    scored.sort(reverse=True)
    with open(f"{BASE}/candidates.tsv", "w", encoding="utf-8") as f:
        for s, norm, canon, forms in scored[:2500]:
            f.write(f"{s}\t{norm}\t{canon}\t{'|'.join(forms)}\n")

    random.seed(42)
    by_reason = defaultdict(set)
    for w, r in rejected:
        by_reason[r].add(w)
    with open(f"{BASE}/rejected-lexicon-sample.txt", "w", encoding="utf-8") as f:
        for reason in sorted(by_reason):
            pool = sorted(by_reason[reason])
            for w in sorted(random.sample(pool, min(30, len(pool)))):
                f.write(f"{w}\t{reason}\n")
    print("rejection counts:", {r: len(v) for r, v in sorted(by_reason.items())})


if __name__ == "__main__":
    main()
