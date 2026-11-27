# Master prompt v4: scanned coaching PDF → EduPulse question JSON + figure zip

Paste this together with the PDF. Nothing needs filling in: the AI configures the job itself (section 0).
Optional: add one line such as "stop at page 118" to your message. With no line, the whole PDF is processed.

**New in v4**
- **Easy explanations.** Every `s` is written by fixed rules for a student who got the question wrong: short sentences, everyday words, one clear reason, never "Option 3" (the app shuffles options). See section 4A.
- **No image mismatch.** Figures are tied to questions by a locked numbering, a figure ledger, a mandatory look-at-every-crop audit, a reverse audit for missed figures, and a manifest that the validator cross-checks against the JSON. See section 5 and Appendix B.

---

## 0. Auto-configuration (decide everything yourself; never ask)

Everything the job needs is in the PDF and in this prompt. **Do not ask the user any question, do not request confirmation, do not leave "?" placeholders, and do not wait for a reply before starting.** Decide each item in the table below, print the result as a **Job card** block at the very start of your reply, then continue straight into extraction. Every decision you made with less than full certainty goes into the report's "Assumptions" (section 8) so the user can correct it afterwards.

| item | how to decide |
|---|---|
| Pages | Start at page 1. Stop at the page the user's message names ("stop at page N", "up to N", "till N"); if none is named, process to the end of the PDF. Skip cover, index, blank and pure answer-key pages for extraction, but still READ key pages for answers. |
| Source (`sourceId` / `sourceLabel`) | From the cover, running headers/footers or watermark. `sourceId` = first word of the brand in lowercase letters ("Aakash Educational Services" → `aakash`, "ALLEN Career Institute" → `allen`); `sourceLabel` = that brand word as normally written ("Aakash", "Allen"). If no brand is visible, use the PDF's file name; as a last resort `coaching` / "Coaching". |
| Subject | `Physics`, `Chemistry` or `Biology` (Botany and Zoology are Biology), from the cover, headers and content. |
| App chapter (`c` / `chapter`) | Map every source chapter title to the closest chapter in **Appendix A** by meaning, not spelling, and use Appendix A's spelling exactly. Several source chapters may map to ONE app chapter; merge them into the same files (typical mappings below). If nothing in the list fits well, do not force it: use the source chapter title (title case) as the chapter name, still process it, and flag **NEW CHAPTER** in the report. |
| Several app chapters in one PDF | Run the whole workflow once per app chapter, in PDF order: separate file sets, numbering and zip for each. |
| Chapter slug | The app's rule: lowercase; every run of characters other than a–z and 0–9 becomes a single hyphen; trim hyphens at both ends. "Cell: The Unit of Life" → `cell-the-unit-of-life`; "Work, Energy and Power" → `work-energy-and-power`; "d- and f-Block Elements" → `d-and-f-block-elements`. |
| Id prefix | First letters of the chapter name's words, ignoring a / an / and / in / of / the / to / for / on / their / its; lowercase; 2 to 5 letters ("Diversity in the Living World" → `dlw`, "Cell: The Unit of Life" → `cul`). If that gives under 2 letters, use the first 3 letters of the first word. |
| Answer key | Scan the whole PDF for a key (end of chapter, end of book, separate pages, "Answers" / "Key" headings). Record where it is. If there is none, section 6 applies. |
| Exercise split | From your page map (Phase A) and the table in section 3. |

**Typical mappings from textbook chapters to app chapters** (match by meaning for everything else):
- Biology: The Living World + Biological Classification + Plant Kingdom → Diversity in the Living World · Morphology of Flowering Plants + Anatomy of Flowering Plants → Morphology and Anatomy of Flowering Plants · Photosynthesis in Higher Plants → Photosynthesis in Plants · Biotechnology: Principles and Processes / Biotechnology and its Applications keep their own names.
- Chemistry: Thermodynamics → Chemical Thermodynamics · Equilibrium → Chemical and Ionic Equilibrium · Redox Reactions + Electrochemistry → Electrochemistry and Redox Reactions · Classification of Elements and Periodicity in Properties → Classification of Elements and Periodicity · The p-Block Elements (Class 11 and 12) → p-Block Elements · Organic Chemistry: Some Basic Principles and Techniques → General Organic Chemistry (and Purification and Characterisation where the PDF treats it separately) · Alcohols, Phenols and Ethers + Aldehydes, Ketones and Carboxylic Acids → Oxygen-Containing Compounds · Amines (and other nitrogen compounds) → Nitrogen-Containing Compounds.
- Physics: System of Particles and Rotational Motion → Rotational Motion · Semiconductor Electronics: Materials, Devices and Simple Circuits → Semiconductor Electronics · Ray Optics and Optical Instruments, Wave Optics, Dual Nature of Radiation and Matter keep their names.

**Job card block to print (example, filled by you):**
```
Source:    aakash / Aakash          Subject: Biology
Pages:     1 to 164 (no stop page given, whole PDF)
Chapter:   Diversity in the Living World   slug: diversity-in-the-living-world   id prefix: dlw
Merged:    The Living World + Biological Classification + Plant Kingdom
Answer key: yes, pages 150–164
```

## 1. Your role and non-negotiables

You are building question-bank files for the EduPulse NEET app from a scanned coaching PDF (pages may be phone screenshots with no text layer; answers may not be printed).

1. **Never truncate.** No "…", "etc.", "rest same", or "// continue". Every question is written out in full.
2. **Never silently drop** a question. Every skipped, unreadable or doubtful item must appear in the final report with page and reason.
3. **Never invent content.** If text is unreadable, mark it in the report; do not fill it in from memory unless it is an answer (section 6).
4. **Do not change the schema.** Use only the fields in section 4. The app skips invalid questions with a small warning, so a malformed file looks like missing questions.
5. Work in **batches of about 10 pages**, one after another **without waiting for the user**. After each batch print a one-line checkpoint: `done through page N, last no = M`. Only if you hit an output limit, stop at a clean question boundary and say exactly where to resume (the user will reply "continue"); then continue numbering exactly from there.
6. **Never ask the user anything and never stop for confirmation.** When something is unclear, choose the most reasonable option, carry on, and record it under Assumptions.
7. **Explanations must be easy.** Every `s` is written for a Class 11 student who just got the question wrong: short sentences, everyday words, one clear reason (section 4A).
8. **A figure goes only to the question it belongs to.** Never attach a figure by guesswork or by nearness alone, and never reuse a neighbour's figure as a stand-in. Section 5 is a checked procedure, not a suggestion.

## 2. Workflow (follow in order)

**Phase 0. Auto-configuration** (section 0): print the Job card, then go straight on.

**Phase A. Page map (before extracting anything).** Render each page, then list: page → chapter → section type (try-yourself / exercise / NEET-AIIMS / PYQ / assertion-reason / theory / subjective / answer key). Decide the file split and the sub-chapter (`topic`) names now, and reuse the same spelling everywhere. Show the map in one compact table and continue without waiting.

**Phase B. Read.**
- OCR every page at 200 DPI or higher. For two-column pages split into left/right columns BEFORE OCR; find the gutter per page (it moves between odd and even pages). Include the far-left margin so question numbers are not cut off.
- Verify every figure-based, matching, statement and table question against the page image. Options can sit at the top of the NEXT page; check.
- A question that continues across columns or pages is one question. Join hyphenated line breaks.
- If a page is rotated, blurry or cropped, say so in the report and extract what is legible.
- While reading, note every figure in the figure ledger (section 5.2): page, column, the printed question number it sits beside, and whether the stem says "refer to the figure". Do this even if you crop later.

**Phase C. Extract** into the schema (sections 3 and 4), batch by batch.

**Phase D. Answer and explain** (sections 6 and 4A). Fix every `a` first, then write every `s`. When all batches of an app chapter are extracted, answered and explained, **freeze the numbering**: every `no` and `id` of that chapter is now final.

**Phase E. Figures** (section 5), only after the numbering is frozen: ledger → crop → name → audit each crop → reverse audit → zip + manifest.

**Phase F. Validate** with the script in Appendix B on the JSON folder, the zip AND the manifest (run it if you can execute code; otherwise check every rule by hand), fix every ERROR and read every WARN, then report (section 8).

## 3. What to keep, what to skip, how to group

**Keep:** 4-option single-answer MCQs and Assertion–Reason items, including figure, table, matching and statement types, "how many of the following…", and "identify the…" items.

**Skip and list in the report (with page + reason):**
- subjective questions (very short / short / long answer), worked examples, "Solution" boxes, theory text, activities
- questions with 5 options, "more than one correct", fill-in-the-blank without options, or integer-type answers
- questions the answer key marks as bonus / dropped / cancelled
- exact duplicates of a question already extracted. Keep the copy in the more specific file (ex3 over ex2 over ex1) and list the others as duplicates.

**Merging chapters:** every source chapter that maps to one app chapter (section 0) goes into the SAME files with ONE continuous `no` per file (1, 2, 3 …). Never restart numbering at a source-chapter boundary.

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
| `s` | simple learner-facing explanation: 2–3 short sentences, about 300 characters (never over 350), written by the rules in section 4A. Required for every question. Never mention the key, the book or a page. |
| `c` | the app chapter name decided in section 0, **identical** in every question and file (image names are derived from it) |
| `topic` | the sub-chapter or section heading as printed, spelled consistently across the whole job |
| `source` / `section` | same as the file's `sourceId` / `exercise` |
| `difficulty` | `Easy` = single direct recall; `Medium` = two-step or NCERT-line application; `Hard` = multi-statement, elimination, or exception-based. Exactly one of Easy / Medium / Hard. |
| `exam`, `year` | for PYQs. Remove the tag from the stem (e.g. "[AIPMT (Prelims)-2007]") and put the exam name as printed in `exam` and the 4-digit year as a string in `year`. If several exams are tagged, use the most recent and mention the others in `note`. Omit both when there is no tag. |
| `note` | `<Section> · Q<printed number> · p.<pdf page>` so every item can be traced back to the page |
| `conf` | `high` / `medium` / `low`; see section 6 |
| `lockOrder` | `true` for statement-type, "Both (1) & (3)", "All of these", "None of the above" and every Assertion–Reason item (options must never be shuffled). Omit otherwise. |
| `table` | `{"headers":[...],"rows":[[...]]}` for table / matching questions; each row has the same width as `headers`; all cells are strings |
| `type` | omit for normal MCQs; `"diagram"` or `"graph"` for figure-based ones |
| `needsImage`, `img`, `optionImages` | see section 5 (image names use `no`, never the printed number) |

**Text formatting (the app escapes HTML and renders only this):**
- Plain text only. **No HTML tags**, no markdown, no bullet characters.
- Line breaks inside a stem are `\n` (put each statement, and each A/R line, on its own line).
- Chemistry / math: use `$...$` (inline) or `$$...$$` (display) LaTeX, e.g. `$\text{CO}_2$`, `$x^2$`. The shorthand `CO_2` and `Ca^2+` also renders as sub/superscript.
- Latin names: exact spelling and capitalisation (Genus species), no italics markup.
- Fix only obvious OCR damage (rn↔m, l/1, O/0, broken ligatures, stray symbols); never "correct" the science. If the printed fact looks wrong, keep it as printed and flag it in the report.
- Remove: the question number, "Try Yourself" markers, page headers/footers, watermark text (for example "Aakash Educational Services…"), and any theory that leaked into the stem or options.
- Assertion–Reason: `q` = `"Assertion (A): …\nReason (R): …"`; options are the four standard A/R choices in the printed order; `lockOrder: true`.
- Matching questions: put the two lists in `table`, keep the options exactly as printed (e.g. "a-iii, b-i, c-iv, d-ii"), `lockOrder: true`.

## 4A. Writing the explanation (`s`): easy and simple

Reader: a Class 11–12 student who just got this wrong and has 20 seconds. After reading `s` they should think "oh, that is why".

1. **Length.** 2–3 short sentences, about 300 characters, never over 350. Keep each sentence to about 20 words or fewer.
2. **Order.** (a) The right answer in plain words plus the ONE reason it is right. (b) Optional: the trap, meaning why the most tempting wrong option fails, or a tiny memory hook.
3. **Everyday words.** If a technical term is unavoidable, explain it in brackets the first time: "xylem (the tissue that carries water)". No "hence", "thus", "wherein", "viz.", no stacks of jargon.
4. **Name the answer by its content, never by position.** Write "Mitochondria", not "Option 3" or "(c)". The app shuffles options, so a position will point to the wrong choice. Exception: when `lockOrder` is true, option numbers and statement numbers are allowed.
5. **By question type:**
   - Statement type: say which statements are true and which are false, and fix each false one in a few words.
   - Assertion–Reason: say whether A is true, whether R is true, and whether R explains A.
   - Numerical: formula, substitution and result in one line ("v = u + at = 0 + 2 × 5 = 10 m/s").
   - Figure: say what to look at ("In the figure, label A points to the xylem").
   - Matching: give each pair in a few words.
   - "Which is NOT / incorrect": say what the odd one out gets wrong.
6. **Own words.** Do not copy the book's sentence. Never write "as per NCERT", "the key says", "given in the book", a page number, or any claim you cannot back up.
7. **Be honest about doubt.** For `conf` medium or low, say plainly what makes it uncertain ("Two options are close; X fits better because …").
8. **Must agree with `a`.** Write `s` only after `a` is final, then re-read: the explanation must justify exactly the option stored in `a`. If it does not, either `a` or `s` is wrong; fix it before moving on.
9. Plain text. Use `$...$` only where chemistry or maths really needs it.

Examples:
- Bad: "Option 3 is correct as per NCERT. Hence the answer is mitochondria."
  Good: "Mitochondria make most of the cell's ATP (energy), so they are called its powerhouse. Ribosomes only build proteins, which is the common mix-up."
- Bad: "Using kinematic equation, v = 10."
  Good: "Use v = u + at. So v = 0 + 2 × 5 = 10 m/s."
- Bad: "Both are correct."
  Good: "A is true: plants lose water mainly through stomata. R is true but does not explain A, because it talks about roots, not leaves."

## 5. Figures: bind each figure to the right question

A figure may be attached to a question only when three things agree: (1) its **position** on the page, (2) the **wording** of the stem ("in the figure", labels A, B, C), and (3) the **labels** visible in the cropped image. If any one of them disagrees, do not attach it silently: fix it or flag it.

### 5.1 Order of work (this prevents number mismatch)
1. Finish extraction, answers and explanations for the whole app chapter first. Then the numbering is **frozen**: every `no` and `id` is final.
2. Only then crop and name images. Names use the app's `no`, NOT the number printed in the book (they usually differ, because sections are merged and questions are skipped).
3. If you add, remove or renumber any question afterwards, regenerate every image name and manifest row of that file before finishing.

### 5.2 Figure ledger (start it while reading)
For every figure on every page, write one row: page · column (left / right / full width) · printed question number it sits beside · first 5–8 words of that question's stem · what the figure shows in 10 words or fewer (for example "labelled cross-section of dicot stem, parts A–D"). Fill in `no` and `id` once numbering is frozen. This ledger becomes `figures-manifest.csv`.

### 5.3 Which question owns a figure
- A figure belongs to the question whose number it is printed beside, in the same column. On two-column pages never take a figure across the gutter.
- A figure at the top of a column or page, before any question number there, usually belongs to the question that started just before it (its stem or options are cut off). Confirm by the stem wording; if that question never refers to a figure, the figure belongs to the next question.
- "Refer to the figure for Q.12–14", or one figure serving several questions: save one copy per question under each question's own name, and list the others in the `shared_with` column.
- If two questions could own it and the stem does not settle it: compare the letters and labels in the stem with those in the image. If still unsure, choose the best fit, set `conf:"medium"`, and list it in the report. Never guess silently.

### 5.4 Cropping
Render the page at 200 DPI or higher. Crop only the figure: labels (A, B, I, II …) that belong to it stay; neighbouring question text, option text, option numbers, page numbers and footers go. About 8 px padding, white background, PNG. If a figure spans two columns or pages, stitch it. The final image must be at least 300 px wide (re-render at 300 DPI if it is smaller) so it stays readable on a phone.

### 5.5 Names (must match exactly or the app will not find the file)
`<chapter-slug>-<source>-<exercise>-q<no>.png`, all lowercase, ASCII, hyphens, e.g. `diversity-in-the-living-world-aakash-ex2-q36.png`. `<no>` is the question's `no` in the JSON, not the printed number.
- one figure → `"img":"diversity-in-the-living-world-aakash-ex2-q36"` (no extension)
- several figures in the stem → suffix `-a`, `-b`, `-c` in reading order, and `"img":["…-q36-a","…-q36-b"]`
- figures AS the options → `…-q36-opt-a.png` … `-opt-d.png`, in the same order as the printed options (first printed option = `opt-a`), `"optionImages":["…-opt-a","…-opt-b","…-opt-c","…-opt-d"]`. Crop the picture only, without its "(1)" / "A." label. Set each option text to a short non-empty placeholder such as "Figure A" (empty options are rejected).
- every question with an image also has `"needsImage": true` and `"type":"diagram"` (or `"graph"`).

### 5.6 Look at every crop (mandatory audit)
After saving each PNG, open it and read the question's stem next to it, then answer yes or no:
1. Does the image show what the stem refers to (same labels, same number of parts)?
2. Are the letters or numbers in the image the ones the stem and options use?
3. Is any neighbouring question text, option text, page number or footer still visible? (must be no)
4. Is any edge cut off, or any label unreadable? (must be no)
5. Is the `q<no>` in the file name the `no` of this very question, with the right exercise in the name?

Any failure means re-crop. Record the result for each image in the report's figure audit table (section 8, item 5a).

### 5.7 Reverse audit (find figures you missed)
Search every stem and option for: figure, fig, diagram, graph, picture, pedigree, apparatus, curve, labelled, "as shown", "marked A", "identify A". Every hit must have `needsImage:true` and an image, or a one-line reason in the report for why none is needed. Also walk through your figure ledger: every ledger row must end up with a question, or be reported as unused.

### 5.8 Zip and manifest
- **Zip:** `<chapter-slug>-figures.zip`, flat (no folders), PNG only.
- **Manifest:** a separate file `figures-manifest.csv` (not inside the zip), UTF-8, with exactly these columns in this order: `file,question_id,no,printed_no,page,shows,stem_cue,shared_with`. `file` is the PNG name with extension; `stem_cue` is the first 5–8 words of that question's `q`, copied exactly; `shows` is 10 words or fewer; `shared_with` lists the other question ids that use the same figure (empty if none). The validator checks every row against the JSON (id, `no`, stem cue), so a mismatched image shows up as an ERROR.

### 5.9 If a figure cannot be cropped cleanly
Keep `needsImage:true`, leave `img` out, and list the question in the report. Never draw, redraw or recreate a figure, and never use a similar-looking figure from another question.

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

Run the validator (Appendix B) on all JSON files plus the zip and fix every ERROR. Then check by eye:
- exactly 4 non-empty, distinct options; `a` in 1–4; ids and numbers unique, with ids unique across every file; `c` identical everywhere
- no footer text, theory, option labels, exam tags or question numbers left in the text
- options match the page image (especially statement, matching and table items)
- every `s` follows section 4A: 2–3 short sentences, simple words, no "Option 3", agrees with `a`, no mention of key/book/page
- figures: every crop was opened and audited (5.6), the reverse audit found no unflagged figure question (5.7), every `needsImage` question has its PNG in the zip, every PNG is used by exactly the question named in the manifest, and the validator passes with the manifest
- the count of questions per file matches your page map (nothing skipped by accident)

## 8. Final reply format

0. **Job card used** (the section 0 decisions) and **Assumptions** (every guess made, one line each: source, subject, chapter mapping, NEW CHAPTER flags, last page, answer-key location).
1. **Files delivered:** table of file name → question count (and the zip + manifest).
2. **Low-confidence items:** id, file, one-line reason. Then **medium-confidence** ids.
3. **Key disagreements** (printed key vs your answer), if any.
4. **Skipped questions:** page, printed number, reason.
5. **Unreadable pages / missing options / missing figures:** page or id and what is missing.
5a. **Figure audit table:** question id | file | page | what the figure shows | match ✔/✘ | note. Every row must be ✔ at delivery; any ✘ that could not be fixed is also listed in item 5.
6. **Duplicates removed.**
7. Validator output (summary line).

Deliver the JSON and zip as downloadable files when you can. If you can only reply in chat, give one code block per file with its file name as a heading above it, and never abbreviate.

---

## Appendix A: the app's chapter list (authoritative; copy spelling exactly)

**Biology** (29): Diversity in the Living World · Animal Kingdom · Morphology and Anatomy of Flowering Plants · Structural Organisation in Animals · Cell: The Unit of Life · Biomolecules · Cell Cycle and Cell Division · Photosynthesis in Plants · Respiration in Plants · Plant Growth and Development · Breathing and Exchange of Gases · Body Fluids and Circulation · Excretory Products and their Elimination · Locomotion and Movement · Neural Control and Coordination · Chemical Coordination and Integration · Sexual Reproduction in Flowering Plants · Human Reproduction · Reproductive Health · Principles of Inheritance and Variation · Molecular Basis of Inheritance · Evolution · Human Health and Disease · Microbes in Human Welfare · Biotechnology: Principles and Processes · Biotechnology and its Applications · Organisms and Populations · Ecosystem · Biodiversity and Conservation

**Chemistry** (20): Some Basic Concepts of Chemistry · Structure of Atom · Chemical Thermodynamics · Chemical and Ionic Equilibrium · Solutions · Electrochemistry and Redox Reactions · Chemical Kinetics · Classification of Elements and Periodicity · Chemical Bonding · p-Block Elements · d- and f-Block Elements · Coordination Compounds · Purification and Characterisation · General Organic Chemistry · Hydrocarbons · Haloalkanes and Haloarenes · Oxygen-Containing Compounds · Nitrogen-Containing Compounds · Biomolecules · Principles Related to Practical Chemistry

**Physics** (28): Units and Measurements · Motion in a Straight Line · Motion in a Plane · Laws of Motion · Work, Energy and Power · Rotational Motion · Gravitation · Mechanical Properties of Solids · Mechanical Properties of Fluids · Thermal Properties of Matter · Thermodynamics · Kinetic Theory of Gases · Oscillations · Waves · Electric Charges and Fields · Electrostatic Potential and Capacitance · Current Electricity · Moving Charges and Magnetism · Magnetism and Matter · Electromagnetic Induction · Alternating Current · Electromagnetic Waves · Ray Optics and Optical Instruments · Wave Optics · Dual Nature of Radiation and Matter · Atoms · Nuclei · Semiconductor Electronics

## Appendix B: validator (`validate_questions.py`)

Save as `validate_questions.py` and run `python validate_questions.py <folder-with-json> [chapter-figures.zip] [figures-manifest.csv]`. It mirrors the app's loader rules plus the conventions above, including the chapter list and file names; exit code 1 means at least one ERROR. A "NEW CHAPTER" warning is expected only for chapters you flagged as not in the app list.

```python
#!/usr/bin/env python3
"""EduPulse question-file validator.
Usage: python validate_questions.py <folder-with-json> [figures.zip] [figures-manifest.csv]
Mirrors the app's loader rules, so anything flagged ERROR would be skipped or broken in the app."""
import json, re, sys, glob, os, zipfile, collections, hashlib, struct, csv

ALLOWED_EX = {"ex1", "ex2", "ex3", "ex1a", "ex1b"}
APP_CHAPTERS = {
 "Biology": [
  "Diversity in the Living World",
  "Animal Kingdom",
  "Morphology and Anatomy of Flowering Plants",
  "Structural Organisation in Animals",
  "Cell: The Unit of Life",
  "Biomolecules",
  "Cell Cycle and Cell Division",
  "Photosynthesis in Plants",
  "Respiration in Plants",
  "Plant Growth and Development",
  "Breathing and Exchange of Gases",
  "Body Fluids and Circulation",
  "Excretory Products and their Elimination",
  "Locomotion and Movement",
  "Neural Control and Coordination",
  "Chemical Coordination and Integration",
  "Sexual Reproduction in Flowering Plants",
  "Human Reproduction",
  "Reproductive Health",
  "Principles of Inheritance and Variation",
  "Molecular Basis of Inheritance",
  "Evolution",
  "Human Health and Disease",
  "Microbes in Human Welfare",
  "Biotechnology: Principles and Processes",
  "Biotechnology and its Applications",
  "Organisms and Populations",
  "Ecosystem",
  "Biodiversity and Conservation"
 ],
 "Chemistry": [
  "Some Basic Concepts of Chemistry",
  "Structure of Atom",
  "Chemical Thermodynamics",
  "Chemical and Ionic Equilibrium",
  "Solutions",
  "Electrochemistry and Redox Reactions",
  "Chemical Kinetics",
  "Classification of Elements and Periodicity",
  "Chemical Bonding",
  "p-Block Elements",
  "d- and f-Block Elements",
  "Coordination Compounds",
  "Purification and Characterisation",
  "General Organic Chemistry",
  "Hydrocarbons",
  "Haloalkanes and Haloarenes",
  "Oxygen-Containing Compounds",
  "Nitrogen-Containing Compounds",
  "Biomolecules",
  "Principles Related to Practical Chemistry"
 ],
 "Physics": [
  "Units and Measurements",
  "Motion in a Straight Line",
  "Motion in a Plane",
  "Laws of Motion",
  "Work, Energy and Power",
  "Rotational Motion",
  "Gravitation",
  "Mechanical Properties of Solids",
  "Mechanical Properties of Fluids",
  "Thermal Properties of Matter",
  "Thermodynamics",
  "Kinetic Theory of Gases",
  "Oscillations",
  "Waves",
  "Electric Charges and Fields",
  "Electrostatic Potential and Capacitance",
  "Current Electricity",
  "Moving Charges and Magnetism",
  "Magnetism and Matter",
  "Electromagnetic Induction",
  "Alternating Current",
  "Electromagnetic Waves",
  "Ray Optics and Optical Instruments",
  "Wave Optics",
  "Dual Nature of Radiation and Matter",
  "Atoms",
  "Nuclei",
  "Semiconductor Electronics"
 ]
}
LOCK = re.compile(r"\b(both|neither|all of the above|all of these|none of (these|the above))\b|^\s*(all|any|none)\s*\.?\s*$|\b[1-4]\s*(&|and)\s*[1-4]\b|\boptions?\s*[1-4]", re.I)
FOOTER = re.compile(r"educational services|aakash|allen career|resonance|motion education|www\.|\.com|phone|toll free|corporate office|page \d+", re.I)
TAG = re.compile(r"</?[a-z][^>]*>", re.I)
LABEL = re.compile(r"^\s*(\(?[1-4a-dA-D]\)|[1-4a-dA-D][.)])\s+")
EXAMTAG = re.compile(r"\[\s*(AIPMT|NEET|AIIMS|CBSE|PMT|JIPMER)[^\]]*\]", re.I)
FIGWORDS = re.compile(r"\b(figure|fig|diagram|graph|picture|pedigree|apparatus|curve|labell?ed|as shown|shown in|marked\s+[A-D]|identify\s+[A-D])\b", re.I)
BOOKREF = re.compile(r"\b(the key|the book|ncert line|as per ncert|as given in|page \d+)\b", re.I)
OPTREF = re.compile(r"\boption\s*\(?[1-4a-d]\)?\b|\(\s*[1-4]\s*\)", re.I)
SAYS_ANS = [re.compile(r"(?:correct|right) (?:answer|option) is (?:option )?\(?([1-4])\)?", re.I),
            re.compile(r"\boption\s*\(?([1-4])\)?\s+is\s+(?:the\s+)?(?:correct|right)", re.I)]

def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", str(s).lower()).strip()

def slug(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(s).lower())).strip("-")

def main(folder, zpath=None, mpath=None):
    errs, warns, counts = [], [], {}
    zipnames = set()
    zhash = {}
    if zpath:
        with zipfile.ZipFile(zpath) as z:
            for n in z.namelist():
                if n.endswith("/"): continue
                b = os.path.basename(n)
                if "/" in n: warns.append(f"[zip] {n} is inside a folder; the zip must be flat")
                zipnames.add(b)
                if not re.fullmatch(r"[a-z0-9][a-z0-9-]*\.png", b):
                    errs.append(f"[zip] bad file name: {b} (lowercase, hyphens, .png)")
                blob_b = z.read(n)
                if blob_b[:8] != b"\x89PNG\r\n\x1a\n":
                    errs.append(f"[zip] {b} is not a real PNG file"); continue
                w, h = struct.unpack(">II", blob_b[16:24])
                if w < 300: warns.append(f"[zip] {b} is only {w}px wide; re-render at higher DPI so it is readable on a phone")
                if h < 40: warns.append(f"[zip] {b} is only {h}px tall; check the crop")
                zhash[b[:-4]] = hashlib.md5(blob_b).hexdigest()
    all_ids = collections.defaultdict(list)
    used_imgs = set()
    img_owner = {}
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
        subj, chp, srcid = data.get("subject"), data.get("chapter"), data.get("sourceId")
        if subj not in APP_CHAPTERS: errs.append(f"[{fn}] subject must be one of {sorted(APP_CHAPTERS)}")
        elif chp not in APP_CHAPTERS[subj]: warns.append(f"[{fn}] NEW CHAPTER: '{chp}' is not in the app's {subj} list (check spelling, or report it as new)")
        if subj and chp and srcid and ex and fn != f"{str(subj).lower()}-{slug(chp)}-{srcid}-{ex}.json":
            errs.append(f"[{fn}] file name should be {str(subj).lower()}-{slug(chp)}-{srcid}-{ex}.json")
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
            s_txt = str(q.get("s", "") or "").strip()
            if not s_txt: warns.append(f"{tag} no explanation 's' (every question should have a short, simple one)")
            if len(s_txt) > 350: warns.append(f"{tag} explanation is {len(s_txt)} chars; keep it near 300 so it stays easy to read")
            if len(re.findall(r"[.!?](?:\s|$)", s_txt)) > 4: warns.append(f"{tag} explanation has more than 4 sentences; shorten to 2-3")
            if BOOKREF.search(s_txt): warns.append(f"{tag} explanation mentions the key/book/page")
            if s_txt and not q.get("lockOrder") and OPTREF.search(s_txt): warns.append(f"{tag} explanation points to an option by number/letter, but options are shuffled; name the content instead")
            if isinstance(a, int) and not isinstance(a, bool) and q.get("lockOrder"):
                for pat in SAYS_ANS:
                    for m in pat.finditer(s_txt):
                        if int(m.group(1)) != a: errs.append(f"{tag} explanation says option {m.group(1)} is correct but a={a}")
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
            if FIGWORDS.search(stem) and not q.get("needsImage"): warns.append(f"{tag} stem refers to a figure/graph/labelling but needsImage is not set: possible missing image")
            if q.get("needsImage") and not imgs and not oimgs: warns.append(f"{tag} needsImage but no img (app shows 'diagram not available')")
            if imgs and not q.get("needsImage"): errs.append(f"{tag} has img but needsImage is not true")
            base = "-".join([slug(q.get("c", "")), str(q.get("source", "")), str(q.get("section", "")).lower(), f"q{no}"])
            if imgs:
                if len(imgs) == 1 and imgs[0] != base: errs.append(f"{tag} img '{imgs[0]}' != expected '{base}'")
                if len(imgs) > 1 and not all(re.fullmatch(re.escape(base) + r"-[a-f]", x) for x in imgs): errs.append(f"{tag} multi-figure names must be '{base}-a', '-b', ...")
            if oimgs and not all(re.fullmatch(re.escape(base) + r"-opt-[a-d]", x) for x in oimgs): errs.append(f"{tag} optionImages must be '{base}-opt-a'..'-opt-d'")
            for x in imgs + oimgs:
                used_imgs.add(x)
                if x in img_owner and img_owner[x][0] != qid: errs.append(f"{tag} image '{x}' is already used by question {img_owner[x][0]}")
                img_owner[x] = (qid, no, stem)
                if zpath and f"{x}.png" not in zipnames: errs.append(f"{tag} figure file missing in zip: {x}.png")
        if len(qs) >= 20 and ans_dist:
            top, n = ans_dist.most_common(1)[0]
            if n / sum(ans_dist.values()) > 0.45: warns.append(f"[{fn}] answer {top} is {n}/{sum(ans_dist.values())} of the key: re-verify answers for positional bias")
        print(f"{fn}: {len(qs)} questions, {low} low-confidence")
    for k, fl in all_ids.items():
        if len(fl) > 1: errs.append(f"id '{k}' repeats across files {sorted(set(fl))} (stats keys would collide)")
    if len(chapters) > 1: warns.append(f"{len(chapters)} chapters in this folder: {sorted(map(str, chapters))} (fine only if the PDF covers several app chapters; each chapter's files must use one identical name)")
    if zpath:
        for n in sorted(zipnames):
            if n[:-4] not in used_imgs: warns.append(f"[zip] {n} is not referenced by any question")
        groups = collections.defaultdict(list)
        for name, hsh in zhash.items(): groups[hsh].append(name)
        for names in groups.values():
            owners = {img_owner[n][0] for n in names if n in img_owner}
            if len(names) > 1 and len(owners) > 1:
                warns.append(f"[zip] identical picture used by different questions {sorted(owners)}: fine only for a genuinely shared figure; otherwise one is the wrong image")
    if mpath:
        need = ["file", "question_id", "no", "printed_no", "page", "shows", "stem_cue", "shared_with"]
        with open(mpath, encoding="utf-8-sig", newline="") as f:
            rd = csv.DictReader(f)
            missing = [c for c in need if c not in (rd.fieldnames or [])]
            if missing:
                errs.append(f"[manifest] missing columns: {missing}")
            else:
                seen = set()
                for r in rd:
                    fnm = (r["file"] or "").strip()
                    key = fnm[:-4] if fnm.endswith(".png") else fnm
                    seen.add(key)
                    own = img_owner.get(key)
                    if not own:
                        errs.append(f"[manifest] {fnm} is not used by any question"); continue
                    qid, no, stem = own
                    if (r["question_id"] or "").strip() != str(qid): errs.append(f"[manifest] {fnm}: question_id {r['question_id']!r} != {qid!r} (image attached to a different question)")
                    if (r["no"] or "").strip() != str(no): errs.append(f"[manifest] {fnm}: no {r['no']!r} != {no}")
                    cue = norm(r["stem_cue"])
                    if not cue: errs.append(f"[manifest] {fnm}: empty stem_cue")
                    elif cue not in norm(stem): errs.append(f"[manifest] {fnm}: stem_cue not found in the stem of {qid} (possible image mismatch)")
                    if not (r["shows"] or "").strip(): warns.append(f"[manifest] {fnm}: 'shows' is empty")
                    if zpath and key + ".png" not in zipnames: errs.append(f"[manifest] {fnm} is not in the zip")
                for x in sorted(used_imgs - seen): errs.append(f"[manifest] no row for image {x}")
    print(f"\nTOTAL {sum(counts.values())} questions in {len(counts)} files")
    for w in warns: print("WARN ", w)
    for e in errs: print("ERROR", e)
    print(f"\n{len(errs)} errors, {len(warns)} warnings")
    sys.exit(1 if errs else 0)

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None, sys.argv[3] if len(sys.argv) > 3 else None)
```
