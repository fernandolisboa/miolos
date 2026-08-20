#!/usr/bin/env python3
"""Build Termo word lists from IME-USP br.ispell wordlist + FrequencyWords pt_BR.

Run from anywhere: paths resolve relative to this file. Source files are
downloaded into sources/ on first run (~10 MB); delete them to force a
re-fetch. Outputs: validation.txt, canonical-map.csv, candidates.tsv
(intermediate, gitignored), rejected-lexicon-sample.txt.
"""
import os
import re
import unicodedata
import urllib.request
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))

SOURCES = {
    "br-utf8.txt": "https://www.ime.usp.br/~pf/dicios/br-utf8.txt",
    "pt_br_full.txt": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_full.txt",
}

ROMAN_RE = re.compile(r"^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$")
NORM_RE = re.compile(r"^[a-z]{5}$")

# Slurs and heavy obscenities excluded even from the guess (validation) list.
# Mild vulgarity stays guessable. Entries are NORMALIZED 5-letter forms.
BLOCKLIST = {
    # slurs
    "viado", "bicha", "vadia",
    # heavy obscenity
    "cuzao", "porra", "putos", "putas", "bosta", "merda",
    "foder", "fodeu", "fodam", "fodia", "fodes", "fodas",
    # scatological verb forms
    "mijar", "mijou", "mijei", "mijam",
    "cagar", "cagou", "cagam", "cague", "cagao",
}

# Lowercase duplicates of proper nouns that exist in the source lexicon; the
# capitalized-lemma filter cannot see them. Only names/places with no
# common-noun or verb-form reading are listed. Deliberately kept out of this
# list because a legitimate reading exists: "silva" (bramble), "bento"
# (blessed), "marta" (the marten), "rosa" (the flower), "edite" / "tomas"
# (verb forms). "ceara" (pluperfect of cear) is sacrificed to kill the state.
PROPER_NOUN_DUPLICATES = {
    "jesus", "maria", "paulo", "pedro", "paris", "japao", "egito", "viena",
    "piaui", "ceara", "goias", "souza", "saara", "siria", "cesar", "mario",
    "andre", "artur", "chico", "chica", "jorge", "joana", "berna",
}

# Corrupted entries in the source lexicon: truncated duplicates of "-eemos"
# subjunctive forms (the source has both "ceemos" and the non-word "ceemo").
SOURCE_CORRUPTION = {"ceemo", "geemo"}

assert all(len(w) == 5 for w in BLOCKLIST | PROPER_NOUN_DUPLICATES | SOURCE_CORRUPTION)


def fetch_sources() -> None:
    os.makedirs(f"{BASE}/sources", exist_ok=True)
    for name, url in SOURCES.items():
        path = f"{BASE}/sources/{name}"
        if not os.path.exists(path):
            print(f"downloading {url} ...")
            urllib.request.urlretrieve(url, path)


def normalize(word: str) -> str:
    d = unicodedata.normalize("NFD", word.lower())
    return "".join(c for c in d if unicodedata.category(c) != "Mn")


def main() -> None:
    fetch_sources()
    rejected = []  # (word, reason)

    # ---- base lexicon ----
    canon_by_norm = defaultdict(set)  # normalized -> {canonical forms}
    n_total = 0
    with open(f"{BASE}/sources/br-utf8.txt", encoding="utf-8") as f:
        for line in f:
            w = line.strip()
            if not w:
                continue
            n_total += 1
            if any(ch.isupper() for ch in w):
                rejected.append((w, "proper-noun (capitalized lemma)"))
                continue
            if re.search(r"[-'\s.]", w):
                rejected.append((w, "hyphen/space/apostrophe/period"))
                continue
            norm = normalize(w)
            if not NORM_RE.fullmatch(norm):
                # length or foreign character; only sample interesting near-misses
                if len(norm) == 5:
                    rejected.append((w, "non a-z after normalization"))
                continue
            if set(w) <= set("mdclxvi") and ROMAN_RE.fullmatch(w):
                rejected.append((w, "roman numeral"))
                continue
            if norm in BLOCKLIST:
                rejected.append((w, "blocklist (slur/heavy obscenity)"))
                continue
            if norm in PROPER_NOUN_DUPLICATES:
                rejected.append((w, "proper-noun (lowercase duplicate)"))
                continue
            if norm in SOURCE_CORRUPTION:
                rejected.append((w, "source corruption (truncated form)"))
                continue
            canon_by_norm[norm].add(w)

    print(f"base lexicon entries read: {n_total}")
    print(f"distinct normalized 5-letter forms: {len(canon_by_norm)}")
    collisions = {k: v for k, v in canon_by_norm.items() if len(v) > 1}
    print(f"normalized forms with >1 canonical spelling: {len(collisions)}")

    # ---- curated additions (#140, ADR-0062) ----
    # additions.txt closes membership gaps in the base lexicon: real, current
    # pt-BR words the IME-USP list is missing (it is explicitly "possibly
    # incomplete" — e.g. the standalone noun "áudio"). One canonical accented
    # form per line, sorted by (normalized form, canonical), unique. Every
    # line is reviewed content. Additions pass the same normalization as
    # lexicon entries, and the blocklist, proper-noun and corruption filters
    # bind on them too — as hard assertions, not the lexicon loop's silent
    # `continue`s: a hand-reviewed line that hits one must fail loudly, never
    # disappear. A line whose canonical form the base lexicon already carries
    # is stale and fails loudly, so a future source refresh cannot silently
    # duplicate curation; and a line whose NORMALIZED form the base lexicon
    # already carries fails too — merging it would put the addition into the
    # frequency-ranked canonical pick below and could silently flip an
    # existing canonical-map.csv row.
    with open(f"{BASE}/additions.txt", encoding="utf-8") as f:
        additions = [line.strip() for line in f if line.strip()]
    assert additions == sorted(
        additions, key=lambda w: (normalize(w), w)
    ), "additions.txt: not sorted by (normalized form, canonical)"
    assert len(set(additions)) == len(additions), "additions.txt: duplicate lines"
    n_new_norms = 0
    for w in additions:
        assert not any(ch.isupper() for ch in w), f"additions.txt: {w!r} is capitalized"
        assert not re.search(r"[-'\s.]", w), f"additions.txt: {w!r} carries punctuation"
        norm = normalize(w)
        assert NORM_RE.fullmatch(norm), f"additions.txt: {w!r} is not 5 a-z letters normalized"
        assert norm not in BLOCKLIST, f"additions.txt: {w!r} is blocklisted"
        assert norm not in PROPER_NOUN_DUPLICATES, f"additions.txt: {w!r} is an excluded proper noun"
        assert norm not in SOURCE_CORRUPTION, f"additions.txt: {w!r} is a known corrupted token"
        assert w not in canon_by_norm[norm], f"additions.txt: {w!r} already in the base lexicon — stale line"
        assert not canon_by_norm[norm], (
            f"additions.txt: {w!r} normalizes to {norm!r}, a form the base lexicon already"
            " carries — merging would let the frequency-ranked canonical pick silently flip"
            " that row in canonical-map.csv; the guess is already valid, drop the line"
        )
        n_new_norms += 1
        canon_by_norm[norm].add(w)
    print(f"curated additions applied: {len(additions)} ({n_new_norms} new normalized forms)")

    # ---- frequency ----
    freq = {}
    with open(f"{BASE}/sources/pt_br_full.txt", encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) == 2:
                freq[parts[0]] = int(parts[1])

    def canon_freq(c: str) -> int:
        return freq.get(c, 0)

    # ---- canonical-map: pick display form per normalized ----
    canonical_of = {}
    for norm, forms in canon_by_norm.items():
        best = sorted(forms, key=lambda c: (-canon_freq(c), c))[0]
        canonical_of[norm] = best

    # ---- outputs ----
    validation = sorted(canon_by_norm)
    with open(f"{BASE}/validation.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(validation) + "\n")

    with open(f"{BASE}/canonical-map.csv", "w", encoding="utf-8") as f:
        f.write("normalized,canonical\n")
        for norm in validation:
            f.write(f"{norm},{canonical_of[norm]}\n")

    # ---- answer candidate pool, ranked by frequency ----
    scored = []
    for norm, forms in canon_by_norm.items():
        s = max(canon_freq(c) for c in forms)
        if s > 0:
            scored.append((s, norm, canonical_of[norm], sorted(forms)))
    scored.sort(reverse=True)
    with open(f"{BASE}/candidates.tsv", "w", encoding="utf-8") as f:
        for s, norm, canon, forms in scored[:2500]:
            f.write(f"{s}\t{norm}\t{canon}\t{'|'.join(forms)}\n")
    print(f"candidates with freq>0: {len(scored)} (top 2500 written)")

    # ---- mechanical rejected sample (lexicon stage only) ----
    # The richer rejected-sample.txt is a hand-assembled audit record from the
    # curation pass, not a script output; this file is the reproducible part.
    import random
    random.seed(42)
    by_reason = defaultdict(list)
    for w, r in rejected:
        by_reason[r].append(w)
    with open(f"{BASE}/rejected-lexicon-sample.txt", "w", encoding="utf-8") as f:
        for reason in sorted(by_reason):
            pool = by_reason[reason]
            take = random.sample(pool, min(30, len(pool)))
            for w in sorted(take):
                f.write(f"{w}\t{reason}\n")
    print("rejection counts:", {r: len(v) for r, v in by_reason.items()})


if __name__ == "__main__":
    main()
