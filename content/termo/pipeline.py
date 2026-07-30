#!/usr/bin/env python3
"""Build Termo word lists from IME-USP br.ispell wordlist + FrequencyWords pt_BR."""
import re
import sys
import unicodedata
from collections import defaultdict

BASE = "/tmp/claude-1000/-home-ferna-projects-miolos/eb4d6adc-8c6f-40c0-91b6-6dea0f6b90c4/scratchpad/termo"

ROMAN_RE = re.compile(r"^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$")
NORM_RE = re.compile(r"^[a-z]{5}$")

# Slurs / heavy obscenities excluded even from the guess (validation) list.
# Mild vulgarity stays guessable. Keys are NORMALIZED forms.
BLOCKLIST = {
    "viado",   # homophobic slur
    "cuzao",   # heavy obscenity (cuzão)
    "foder", "fodeu", "fodam", "fodia", "fodes", "fodas", "fodido"[:5],  # fodid ->
    "porra",   # heavy obscenity
    "putos", "putas",  # heavy obscenity in plural usage
    "bucet",   # stem safety (won't match 5 letters anyway)
    "xotas", "xanas",
    "caceta",
    "bosta",   # scatological
    "merda",   # scatological
    "mijar", "mijou", "mijei", "mijam",  # scatological verb forms
    "cagar", "cagou", "cagam", "caguei"[:5], "cagao",  # scatological
    "pirok", "piroc",  # stems, safety
    "rabao",
    "sacan",
    "boquet",
}
BLOCKLIST = {w for w in BLOCKLIST if len(w) == 5}


def normalize(word: str) -> str:
    d = unicodedata.normalize("NFD", word.lower())
    return "".join(c for c in d if unicodedata.category(c) != "Mn")


def main() -> None:
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
                if 4 <= len(norm) <= 6 and len(norm) != 5:
                    pass  # not 5 letters: uninteresting, skip silently
                elif len(norm) == 5:
                    rejected.append((w, "non a-z after normalization"))
                continue
            if set(w) <= set("mdclxvi") and ROMAN_RE.fullmatch(w):
                rejected.append((w, "roman numeral"))
                continue
            if norm in BLOCKLIST:
                rejected.append((w, "blocklist (slur/heavy obscenity)"))
                continue
            canon_by_norm[norm].add(w)

    print(f"base lexicon entries read: {n_total}")
    print(f"distinct normalized 5-letter forms: {len(canon_by_norm)}")
    collisions = {k: v for k, v in canon_by_norm.items() if len(v) > 1}
    print(f"normalized forms with >1 canonical spelling: {len(collisions)}")

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

    # ---- rejected sample ----
    import random
    random.seed(42)
    by_reason = defaultdict(list)
    for w, r in rejected:
        by_reason[r].append(w)
    with open(f"{BASE}/rejected-sample.txt", "w", encoding="utf-8") as f:
        for reason in sorted(by_reason):
            pool = by_reason[reason]
            take = random.sample(pool, min(30, len(pool)))
            for w in sorted(take):
                f.write(f"{w}\t{reason}\n")
    print("rejection counts:", {r: len(v) for r, v in by_reason.items()})


if __name__ == "__main__":
    main()
