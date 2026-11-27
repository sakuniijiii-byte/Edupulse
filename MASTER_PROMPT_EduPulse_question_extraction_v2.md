# Master prompt v2: scanned coaching PDF → EduPulse question JSON + figure zip

Paste this together with the PDF. Fill in the **Job card** first.

---

## 0. Job card (fill in before pasting)

```
PDF:                 <file name>
Pages to process:    <first page> to <LAST PAGE>   (stop exactly at LAST PAGE)
Source id / label:   aakash / Aakash               (lowercase id, display label)
Subject:             Biology
App chapter name:    Diversity in the Living World  (exact spelling; copied into every question's "c")
Chapter slug:        diversity-in-the-living-world  (lowercase, hyphens)
Id prefix:           dlw                            (2-5 letters)
Chapters merged:     The Living World + Biological Classification + Plant Kingdom
Answer key in PDF:   yes (pages …) / no
```

If any line is missing, ask once, then proceed. Do not guess the app chapter name or slug.

## 1. Your role and non-negotiables

You are building question-bank files for the EduPulse NEET app from a scanned coaching PDF (pages may be phone screenshots with no text layer; answers may not be printed).

1. **Never truncate.** No "…", "etc.", "rest same", or "// continue". Every question is written out in full.
2. **Never silently drop** a question. Every skipped, unreadable or doubtful item must appear in the final report with page and reason.
3. **Never invent content.** If text is unreadable, mark it in the report; do not fill it in from memory unless it is an answer (section 6).
4. **Do not change the schema.** Use only the fields in section 4. The app skips invalid questions with a small warning, so a malformed file looks like missing questions.
5. Work in **batches of about 10 pages**. After each batch print a checkpoint: `done through page N, last no = M`. If you hit an output limit, stop at a clean question boundary and say where to resume. Continue numbering exactly from there.

## 2. Workflow (follow in order)

**Phase A. Page map (before extracting anything).** Render each page, then list: page → chapter → section type (try-yourself / exercise / NEET-AIIMS / PYQ / assertion-reason / theory / subjective / answer key). Decide the file split and the sub-chapter (`topic`) names now, and reuse the same spelling everywhere. Show the map in one compact table and continue without waiting.

**Phase B. Read.**
- OCR every page at 200 DPI or higher. For two-column pages split into left/right columns BEFORE OCR; find the gutter per page (it moves between odd and even pages). Include the far-left margin so question numbers are not cut off.
- Verify every figure-based, matching, statement and table question against the page image. Options can sit at the top of the NEXT page; check.
- A question that continues across columns or pages is one question. Join hyphenated line breaks.
- If a page is rotated, blurry or cropped, say so in the report and extract what is legible.

**Phase C. Extract** into the schema (sections 3 and 4).

**Phase D. Answer** (section 6).

**Phase E. Figures** (section 5).

**Phase F. Validate** with the script in the Appendix (run it if you can execute code; otherwise check every rule by hand), fix every ERROR, then report (section 8).

## 3. What to keep, what to skip, how to group

**Keep:** 4-option single-answer MCQs and Assertion–Reason items, including figure, table, matching and statement types, "how many of the following…", and "identify the…" items.

**Skip and list in the report (with page + reason):**
- subjective questions (very short / short / long answer), worked examples, "Solution" boxes, theory text, activities
- questions with 5 options, "more than one correct", fill-in-the-blank without options, or integer-type answers
- questions the answer key marks as bonus / dropped / cancelled
- exact duplicates of a question already extracted. Keep the copy in the more specific file (ex3 over ex2 over ex1) and list the others as duplicates.

**Merging chapters:** every source chapter that maps to one app chapter goes into the SAME files with ONE continuous `no` per file (1, 2, 3 …). Never restart numbering at a source-chapter boundary.

**File name:** `<subject>-<chapter-slug>-<source>-<exercise>.json`, e.g. `biology-diversity-in-the-living-world-aakash-ex1.json`

| exercise | contents | exerciseLabel (use exactly) |
|---|---|---|
| ex1 | in-text "Try Yourself" + chapter "Exercise" MCQs | Try Yourself & Exercise |
| ex2 | NEET/AIIMS objective sections (A, B) | NEET / AIIMS Objective |
| ex3 | previous-year questions (AIPMT / NEET) | Previous Year Questions |
| ex1a | Assertion–Reason | Assertion–Reason |

Use only these ids (`ex1`, `ex2`, `ex3`, `ex1a`, `ex1b`); the app probes exactly these when it cannot list the data folder. Do not create an empty file for a type the PDF lacks. `exerciseLabel` is shown in the app, so keep it identical in every file of that exercise.

**File shape:**
```json
{"sourceId":"aakash","sourceLabel":"Aakash","exercise":"ex1","exerciseLabel":"Try Yourself & Exercise",
 "chapter":"Diversity in the Living World","subject":"Biology","questions":[ ... ]}
```
Valid UTF-8 JSON only: no comments, no trailing commas, no markdown inside the file. Questions sorted by `no`.

## 4. Question object

```json
{"id":"dlw-aakash-ex1-012","no":12,"q":"stem","o":["opt1","opt2","opt3","opt4"],"a":3,
 "s":"short explanation","c":"Diversity in the Living World","topic":"Plant Kingdom",
 "source":"aakash","section":"ex1","difficulty":"Medium",
 "exam":"AIPMT (Prelims)","year":"2007","note":"Exercise · Q12 · p.47","conf":"high"}
```

| field | rule |
|---|---|
| `id` | `<prefix>-<source>-<exN>-<no padded to 3>`, e.g. `dlw-aakash-ex2-036`. **Unique across ALL files of the chapter and all sources**, never reused, never changed on re-runs. The app builds each question's saved-stats key from the chapter name plus `id`, so a repeated id merges two questions' history. |
| `no` | integer, unique within the file, continuous, increasing |
| `q` | the stem only; see formatting rules below |
| `o` | exactly 4 non-empty, distinct strings in printed order; remove printed labels like "(1)", "A." |
| `a` | **1-based** integer 1–4. Never blank. |
| `s` | 1–2 sentence learner-facing explanation (max about 280 characters) saying why the answer is right. Never mention "the key" or "the book". Required when `conf` is medium/low and for every statement, A/R, table, figure and numerical item; recommended for all. |
| `c` | the app chapter name from the Job card, **identical** in every question and file (image names are derived from it) |
| `topic` | the sub-chapter or section heading as printed, spelled consistently across the whole job |
| `source` / `section` | same as the file's `sourceId` / `exercise` |
| `difficulty` | `Easy` = single direct recall; `Medium` = two-step or NCERT-line application; `Hard` = multi-statement, elimination, or exception-based. Exactly one of Easy / Medium / Hard. |
| `exam`, `year` | for PYQs. Remove the tag from the stem (e.g. "[AIPMT (Prelims)-2007]") and put the exam name as printed in `exam` and the 4-digit year as a string in `year`. If several exams are tagged, use the most recent and mention the others in `note`. Omit both when there is no tag. |
| `note` | `<Section> · Q<printed number> · p.<pdf page>` so every item can be traced back to the page |
| `conf` | `high` / `medium` / `low`; see section 6 |
| `lockOrder` | `true` for statement-type, "Both (1) & (3)", "All of these", "None of the above" and every Assertion–Reason item (options must never be shuffled). Omit otherwise. |
| `table` | `{"headers":[...],"rows":[[...]]}` for table / matching questions; each row has the same width as `headers`; all cells are strings |
| `type` | omit for normal MCQs; `"diagram"` or `"graph"` for figure-based ones |
| `needsImage`, `img`, `optionImages` | see section 5 |

**Text formatting (the app escapes HTML and renders only this):**
- Plain text only. **No HTML tags**, no markdown, no bullet characters.
- Line breaks inside a stem are `\n` (put each statement, and each A/R line, on its own line).
- Chemistry / math: use `$...$` (inline) or `$$...$$` (display) LaTeX, e.g. `$\text{CO}_2$`, `$x^2$`. The shorthand `CO_2` and `Ca^2+` also renders as sub/superscript.
- Latin names: exact spelling and capitalisation (Genus species), no italics markup.
- Fix only obvious OCR damage (rn↔m, l/1, O/0, broken ligatures, stray symbols); never "correct" the science. If the printed fact looks wrong, keep it as printed and flag it in the report.
- Remove: the question number, "Try Yourself" markers, page headers/footers, watermark text (for example "Aakash Educational Services…"), and any theory that leaked into the stem or options.
- Assertion–Reason: `q` = `"Assertion (A): …\nReason (R): …"`; options are the four standard A/R choices in the printed order; `lockOrder: true`.
- Matching questions: put the two lists in `table`, keep the options exactly as printed (e.g. "a-iii, b-i, c-iv, d-ii"), `lockOrder: true`.

## 5. Figures

**Which questions:** any question whose stem or options need a figure. Set `"needsImage": true`; also set `"type":"diagram"` (or `"graph"`).

**Cropping:** render the page at 200 DPI or higher; crop only the figure (labels A, B, I, II that belong to it stay; neighbouring question text, option text, page numbers and footers go); about 8 px padding; PNG. If a figure spans two columns or pages, stitch it. If one figure serves several questions, save a copy for each question under that question's name.

**Names (must match exactly or the app will not find the file):**
`<chapter-slug>-<source>-<exercise>-q<no>.png`, all lowercase, ASCII, hyphens, e.g. `diversity-in-the-living-world-aakash-ex2-q36.png`
- one figure → `"img":"diversity-in-the-living-world-aakash-ex2-q36"` (no extension)
- several figures in the stem → suffix `-a`, `-b`, `-c` in reading order, and `"img":["…-q36-a","…-q36-b"]`
- figures AS the options → `…-q36-opt-a.png` … `-opt-d.png`, `"optionImages":["…-opt-a","…-opt-b","…-opt-c","…-opt-d"]`, and set each option text to a short non-empty placeholder such as "Figure A" (empty options are rejected)

**Zip:** `<chapter-slug>-figures.zip`, flat (no folders), PNG only. Also give a `figures-manifest.csv` (file, question id, page) as a separate file, not inside the zip.

If a figure cannot be cropped cleanly, keep `needsImage:true`, leave `img` out, and list the question in the report.

## 6. Answers and confidence

1. **If the PDF has an answer key,** locate it first (chapter end, book end, or separate pages), map it by section and number, convert (A–D or 1–4) to 1-based `a`, and use it exactly.
2. **Always solve every question independently too** (NCERT-based knowledge; for PYQs use the official answer if you know it). Where your answer differs from the printed key: keep the printed key in `a`, set `conf:"low"`, and list the question in the report under "key disagreements" with your reasoning. Do not put the disagreement inside `s`, which is learner-facing.
3. **If there is no key,** solve each question. Set:
   - `high`: stated directly in NCERT, or computed with no ambiguity
   - `medium`: very likely right but not certain, or the options have a close second
   - `low`: options are ambiguous, the question is flawed or disputed, you are partly guessing, or the figure was hard to read
4. Never leave `a` blank or write 0. If you cannot decide, pick the best option, set `low`, and explain in `s`.
5. **Answer-position sanity check:** in any file of 20 or more questions, no single option should be the answer for more than about 40% of questions. If it is, re-verify the answers; a skew usually means guessing bias.

## 7. QA before replying

Run the validator (Appendix) on all JSON files plus the zip and fix every ERROR. Then check by eye:
- exactly 4 non-empty, distinct options; `a` in 1–4; ids and numbers unique, with ids unique across every file; `c` identical everywhere
- no footer text, theory, option labels, exam tags or question numbers left in the text
- options match the page image (especially statement, matching and table items)
- every `needsImage` question has its PNG in the zip, and every PNG is used
- the count of questions per file matches your page map (nothing skipped by accident)

## 8. Final reply format

1. **Files delivered:** table of file name → question count (and the zip + manifest).
2. **Low-confidence items:** id, file, one-line reason. Then **medium-confidence** ids.
3. **Key disagreements** (printed key vs your answer), if any.
4. **Skipped questions:** page, printed number, reason.
5. **Unreadable pages / missing options / missing figures:** page or id and what is missing.
6. **Duplicates removed** and **assumptions made.**
7. Validator output (summary line).

Deliver the JSON and zip as downloadable files when you can. If you can only reply in chat, give one code block per file with its file name as a heading above it, and never abbreviate.

---

## Appendix: validator (`validate_questions.py`)

Save as `validate_questions.py` and run `python validate_questions.py <folder-with-json> [chapter-figures.zip]`. It mirrors the app's loader rules plus the conventions above; exit code 1 means at least one ERROR.

```python
#!/usr/bin/env python3
"""EduPulse question-file validator.
Usage: python validate_questions.py <folder-with-json> [figures.zip]
Mirrors the app's loader rules, so anything flagged ERROR would be skipped or broken in the app."""
import json, re, sys, glob, os, zipfile, collections

ALLOWED_EX = {"ex1", "ex2", "ex3", "ex1a", "ex1b"}
LOCK = re.compile(r"\b(both|neither|all of the above|all of these|none of (these|the above))\b|^\s*(all|any|none)\s*\.?\s*$|\b[1-4]\s*(&|and)\s*[1-4]\b|\boptions?\s*[1-4]", re.I)
FOOTER = re.compile(r"educational services|aakash|allen career|resonance|motion education|www\.|\.com|phone|toll free|corporate office|page \d+", re.I)
TAG = re.compile(r"</?[a-z][^>]*>", re.I)
LABEL = re.compile(r"^\s*(\(?[1-4a-dA-D]\)|[1-4a-dA-D][.)])\s+")
EXAMTAG = re.compile(r"\[\s*(AIPMT|NEET|AIIMS|CBSE|PMT|JIPMER)[^\]]*\]", re.I)

def slug(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(s).lower())).strip("-")

def main(folder, zpath=None):
    errs, warns, counts = [], [], {}
    zipnames = set()
    if zpath:
        with zipfile.ZipFile(zpath) as z:
            zipnames = {os.path.basename(n) for n in z.namelist() if not n.endswith("/")}
            for n in zipnames:
                if not re.fullmatch(r"[a-z0-9][a-z0-9-]*\.png", n):
                    errs.append(f"[zip] bad file name: {n} (lowercase, hyphens, .png)")
    all_ids = collections.defaultdict(list)
    used_imgs = set()
    chapters = set()
    for path in sorted(glob.glob(os.path.join(folder, "*.json"))):
        fn = os.path.basename(path)
        try:
            raw = open(path, encoding="utf-8").read()
            data = json.loads(raw)
        except Exception as e:
            errs.append(f"[{fn}] not valid UTF-8 JSON: {e}"); continue
        for k in ("sourceId", "sourceLabel", "exercise", "exerciseLabel", "chapter", "subject", "questions"):
            if not data.get(k): errs.append(f"[{fn}] missing top-level '{k}'")
        ex = data.get("exercise")
        if ex not in ALLOWED_EX: errs.append(f"[{fn}] exercise '{ex}' not in {sorted(ALLOWED_EX)}")
        if ex and not fn.endswith(f"-{ex}.json"): errs.append(f"[{fn}] file name must end with -{ex}.json")
        chapters.add(data.get("chapter"))
        qs = data.get("questions") or []
        counts[fn] = len(qs)
        nos, ids = set(), set()
        prev_no = 0
        ans_dist = collections.Counter()
        low = 0
        for i, q in enumerate(qs):
            tag = f"[{fn} #{q.get('id') or q.get('no') or i+1}]"
            stem = str(q.get("q", "")).strip()
            opts = q.get("o")
            a = q.get("a")
            if not stem: errs.append(f"{tag} empty stem")
            if len(stem) > 4000: errs.append(f"{tag} stem > 4000 chars (app skips it)")
            if not isinstance(opts, list) or len(opts) != 4 or any(not str(o).strip() for o in opts):
                errs.append(f"{tag} needs exactly 4 non-empty options"); opts = opts if isinstance(opts, list) else []
            if not (isinstance(a, int) and not isinstance(a, bool) and 1 <= a <= 4): errs.append(f"{tag} 'a' must be an integer 1-4, got {a!r}")
            else: ans_dist[a] += 1
            if len({str(o).strip().lower() for o in opts}) != len(opts): warns.append(f"{tag} duplicate options")
            no = q.get("no")
            if not isinstance(no, int): errs.append(f"{tag} 'no' must be an integer")
            elif no in nos: errs.append(f"{tag} duplicate no {no}")
            else:
                nos.add(no)
                if no <= prev_no: warns.append(f"{tag} 'no' not increasing")
                prev_no = no
            qid = q.get("id")
            if not qid: errs.append(f"{tag} missing id")
            elif qid in ids: errs.append(f"{tag} duplicate id in file")
            ids.add(qid)
            if qid: all_ids[str(qid).lower()].append(fn)
            for k in ("c", "section", "source", "difficulty", "topic"):
                if not q.get(k): errs.append(f"{tag} missing '{k}'")
            if q.get("section") != ex: errs.append(f"{tag} section '{q.get('section')}' != file exercise '{ex}'")
            if q.get("source") != data.get("sourceId"): errs.append(f"{tag} source != sourceId")
            if q.get("difficulty") not in ("Easy", "Medium", "Hard"): errs.append(f"{tag} difficulty must be Easy|Medium|Hard")
            if q.get("conf") not in ("high", "medium", "low"): errs.append(f"{tag} conf must be high|medium|low")
            if q.get("conf") == "low": low += 1
            if q.get("conf") in ("medium", "low") and not q.get("s"): errs.append(f"{tag} conf={q.get('conf')} needs an 's' explanation")
            blob = " ".join([stem] + [str(o) for o in opts] + [str(q.get("s", ""))])
            if TAG.search(blob): errs.append(f"{tag} contains HTML tags (app escapes them)")
            if FOOTER.search(blob): errs.append(f"{tag} looks like footer/page text leaked in")
            if EXAMTAG.search(stem): errs.append(f"{tag} exam tag left in stem; move to exam/year")
            if re.match(r"^\s*(q\.?\s*)?\d+[.)]\s", stem, re.I): warns.append(f"{tag} stem starts with a question number")
            for o in opts:
                if LABEL.match(str(o)): warns.append(f"{tag} option still has a label: {str(o)[:30]!r}"); break
            if (LOCK.search(" ".join(map(str, opts))) or re.search(r"^\s*assertion", stem, re.I) or re.search(r"statement", stem, re.I)) and not q.get("lockOrder"):
                warns.append(f"{tag} looks order-dependent but lockOrder is not true")
            if re.match(r"^\s*assertion", stem, re.I) and "Reason" not in stem: errs.append(f"{tag} Assertion without Reason")
            t = q.get("table")
            if t is not None:
                if not (isinstance(t, dict) and isinstance(t.get("rows"), list) and t["rows"]): errs.append(f"{tag} bad table")
                elif t.get("headers") and any(len(r) != len(t["headers"]) for r in t["rows"]): errs.append(f"{tag} table row width != headers")
            imgs = q.get("img")
            imgs = [imgs] if isinstance(imgs, str) and imgs else (imgs or [])
            oimgs = [x for x in (q.get("optionImages") or []) if x]
            if q.get("needsImage") and not imgs and not oimgs: warns.append(f"{tag} needsImage but no img (app shows 'diagram not available')")
            if imgs and not q.get("needsImage"): errs.append(f"{tag} has img but needsImage is not true")
            base = "-".join([slug(q.get("c", "")), str(q.get("source", "")), str(q.get("section", "")).lower(), f"q{no}"])
            if imgs:
                if len(imgs) == 1 and imgs[0] != base: errs.append(f"{tag} img '{imgs[0]}' != expected '{base}'")
                if len(imgs) > 1 and not all(re.fullmatch(re.escape(base) + r"-[a-f]", x) for x in imgs): errs.append(f"{tag} multi-figure names must be '{base}-a', '-b', ...")
            if oimgs and not all(re.fullmatch(re.escape(base) + r"-opt-[a-d]", x) for x in oimgs): errs.append(f"{tag} optionImages must be '{base}-opt-a'..'-opt-d'")
            for x in imgs + oimgs:
                used_imgs.add(x)
                if zpath and f"{x}.png" not in zipnames: errs.append(f"{tag} figure file missing in zip: {x}.png")
        if len(qs) >= 20 and ans_dist:
            top, n = ans_dist.most_common(1)[0]
            if n / sum(ans_dist.values()) > 0.45: warns.append(f"[{fn}] answer {top} is {n}/{sum(ans_dist.values())} of the key: re-verify answers for positional bias")
        print(f"{fn}: {len(qs)} questions, {low} low-confidence")
    for k, fl in all_ids.items():
        if len(fl) > 1: errs.append(f"id '{k}' repeats across files {sorted(set(fl))} (stats keys would collide)")
    if len(chapters) > 1: warns.append(f"several chapter names across files: {sorted(map(str, chapters))} (must be identical for one app chapter)")
    if zpath:
        for n in sorted(zipnames):
            if n[:-4] not in used_imgs: warns.append(f"[zip] {n} is not referenced by any question")
    print(f"\nTOTAL {sum(counts.values())} questions in {len(counts)} files")
    for w in warns: print("WARN ", w)
    for e in errs: print("ERROR", e)
    print(f"\n{len(errs)} errors, {len(warns)} warnings")
    sys.exit(1 if errs else 0)

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
```
