#!/usr/bin/env python3
"""Build the Cruzadinha candidate pool: frequent, correctly spelled pt-BR words of 3-5 letters.

Run from anywhere: paths resolve relative to this file. Needs `pip install spylls==0.1.7`
(a pure-Python Hunspell). Sources are fetched into sources/ on first run and checked
against pinned sha256 digests, so an upstream change fails loudly instead of silently
shifting the pool. Output: candidates.tsv (normalized, canonical, frequency rank), the
input to the curation pass.
"""
import hashlib
import os
import re
import unicodedata
import urllib.request

from spylls.hunspell import Dictionary

BASE = os.path.dirname(os.path.abspath(__file__))
SOURCES = {
    "pt_BR.dic": (
        "https://raw.githubusercontent.com/LibreOffice/dictionaries/master/pt_BR/pt_BR.dic",
        "a38bfb26b68ece2834e79fe83e48d5792652970ace12db89d1b9674bf9933183",
    ),
    "pt_BR.aff": (
        "https://raw.githubusercontent.com/LibreOffice/dictionaries/master/pt_BR/pt_BR.aff",
        "21d8ad2a769a60e17e2b5ea4ef11d4d593a58b9e2a82d642ef82d6a4c5523865",
    ),
    "pt_br_full.txt": (
        "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_full.txt",
        "533b3abaab3b1ea9cec7a150fc8aaf8d428c6f241979cc2224b7ee82f8a369b2",
    ),
}
FREQUENCY_TOP = 60_000
NORM_RE = re.compile(r"^[a-z]{3,5}$")


def fetch(name):
    url, digest = SOURCES[name]
    path = os.path.join(BASE, "sources", name)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        urllib.request.urlretrieve(url, path)
    with open(path, "rb") as f:
        actual = hashlib.sha256(f.read()).hexdigest()
    if actual != digest:
        raise SystemExit(f"{name}: sha256 {actual} does not match the pinned {digest}")
    return path


def normalize(word):
    decomposed = unicodedata.normalize("NFD", word.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def main():
    fetch("pt_BR.aff")
    dictionary = Dictionary.from_files(fetch("pt_BR.dic")[: -len(".dic")])
    pool = {}
    with open(fetch("pt_br_full.txt"), encoding="utf-8") as f:
        for rank, line in enumerate(f):
            if rank >= FREQUENCY_TOP:
                break
            word = line.split()[0]
            normalized = normalize(word)
            if word != word.lower() or not NORM_RE.match(normalized) or normalized in pool:
                continue
            if dictionary.lookup(word):
                pool[normalized] = (word, rank)
    with open(os.path.join(BASE, "candidates.tsv"), "w", encoding="utf-8") as out:
        for normalized, (canonical, rank) in sorted(pool.items(), key=lambda kv: kv[1][1]):
            out.write(f"{normalized}\t{canonical}\t{rank}\n")
    print(f"{len(pool)} candidates")


if __name__ == "__main__":
    main()
