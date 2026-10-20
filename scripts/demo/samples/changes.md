# Example review

**Spec** · 2026-10-20 · Status: Draft · **Owner:** project-a team

## In short

- A small tool reads one folder and writes a report about it.
- Two decisions are still open, and three steps wait on you.

## 1. Decisions

| ID | Decision | Status |
|---|---|---|
| D1 | Read the folder once, at the start | Agreed |
| D2 | Write the report as Markdown | Agreed |
| D3 | Keep a cache between runs | Pending, see below |
| D4 | Name the output after the folder | In review |
| D5 | Drop the old flag | Rejected |
| D6 | Print a summary line at the end | Agreed |

D3 waits on a measurement of the cache's size on a large folder.

## 2. Design

The tool walks the folder once and keeps what it reads in memory. Each file becomes one entry of the report, with
its size, its kind and the first line of its text.

A file the tool cannot read is listed with the reason, and the walk goes on. Nothing is written until the walk ends,
so a failed run leaves no half report behind.

The report is one Markdown file. Its first section counts the files by kind; the second lists the largest ones; the
third lists the files that could not be read.

## 3. Tasks

### Task 1: Set up the project

- [ ] **Step 1: Make the folder** with a readme in it.
- [ ] **Step 2 (you): Pick a name** for the tool.
- [ ] **Step 3: Add the test runner** and one empty test.
- [ ] **Step 4: Write the first case** for an empty folder.
- [ ] **Step 5: Read one file** and print its size.
- [ ] **Step 6: Read a folder** of three files.
- [ ] **Step 7: Count by kind** and print the counts.
- [ ] **Step 8: List the largest** five files.
- [ ] **Step 9 (you): Review the output** on a real folder.
- [ ] **Step 10: Keep the failures** in a list of their own.

### Task 2: Ship it

- [ ] **Step 1: Write the report** to a file.
- [ ] **Step 2: Add the summary line** at the end.
- [ ] **Step 3: Measure the cache** on a large folder.
- [ ] **Step 4 (you): Decide on the cache** from the measurement.
- [ ] **Step 5: Drop the old flag** and its tests.
- [ ] **Step 6: Update the readme** with an example.
- [ ] **Step 7: Tag a release** and note what changed.
- [ ] **Step 8: Run it on three folders** and keep the reports.
- [ ] **Step 9: Fix what the runs show** in a second release.
- [ ] **Step 10: Close the project** with a short note.

## Where things stand

### Agreed

- Read once, write Markdown, print a summary (D1, D2, D6).

### Waiting on you

- Pick a name for the tool and for its output (D4).
- Decide on the cache once it is measured (D3).

## 4. Notes

The walk reads each file's first line only, so a large file costs no more than a small one. The sizes come from the
file system and are not checked against the content.

A folder of ten thousand files took under a second in a first measurement. The cache would matter only for folders
much larger than that, which is why D3 waits on a second measurement.

The kinds are read from the file names, not from the content. A file with no extension is listed under "other", and
so is one whose extension the tool does not know.

The report lists at most five of the largest files. A longer list was tried and read as noise: the five largest were
almost always the ones a reader wanted to see.

A file the tool cannot read is not retried. The reason is written as the system gave it, so a reader can search for it
and see what went wrong without running the tool again.

The summary line repeats the counts of the first section in one sentence, for a reader who only looks at the end of
the report, as a log viewer shows it.

Nothing here depends on the operating system beyond reading a folder and the sizes of its files, so the same report
comes out on any machine the tool runs on.
