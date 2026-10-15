"""Write conformance/reference/ from a reference renderer (dev-only; never run by tests or CI).

Every path is an argument and none has a default, so no tracked file names a machine:

  PYTHONDONTWRITEBYTECODE=1 "$REFERENCE_PYTHON" -I scripts/golden/generate.py \\
    --renderer "$REFERENCE_RENDERER" --corpus conformance/corpus --out conformance/reference [--only <id> ...]

REFERENCE_PYTHON is an interpreter with the reference renderer's packages; REFERENCE_RENDERER is the
renderer module (a file defining render_md, front_matter_list and _cm). The module is copied into a
temporary directory and imported from there, so nothing beside the original is read or written.

For each corpus/<id>.md (sorted) it writes reference/<id>.html (byte-exact) and reference/<id>.meta.json,
then reference/PROVENANCE.json: the Python and package versions, the renderer's sha256, every input's
sha256 and the UTC date. No path and no host name is recorded. Exit 0 on success, 1 when a reference
renders the failure fallback, 2 on a usage error or a renderer that lacks a required name.
"""

import argparse
import datetime
import hashlib
import importlib.metadata
import importlib.util
import json
import platform
import re
import shutil
import sys
import tempfile
from pathlib import Path

PACKAGES = ("markdown-it-py", "mdit-py-plugins", "Pygments", "PyYAML")
REQUIRED = ("render_md", "front_matter_list", "_cm")
FAILED_MARK = "could not be rendered"
KIND = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,39}")
MAX_KINDS = 32


def die(code: int, message: str) -> None:
    print(f"generate.py: {message}", file=sys.stderr)
    sys.exit(code)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_renderer(path: Path, tmp: Path):
    copy = tmp / "reference_renderer.py"
    shutil.copyfile(path, copy)
    spec = importlib.util.spec_from_file_location("reference_renderer", copy)
    if spec is None or spec.loader is None:
        die(2, "the renderer cannot be loaded as a module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    missing = [name for name in REQUIRED if not hasattr(module, name)]
    if missing:
        die(2, "the renderer lacks " + ", ".join(missing))
    return module


def mermaid_kind(content: str):
    """The diagram keyword of one Mermaid source: skip blank and %% lines, then a --- ... --- block,
    then blank and %% lines again; the keyword is the leading [A-Za-z][A-Za-z0-9_-]{0,39} of the next line."""
    lines = [line.strip() for line in content.split("\n")]
    i = 0

    def skip(i: int) -> int:
        while i < len(lines) and (lines[i] == "" or lines[i].startswith("%%")):
            i += 1
        return i

    i = skip(i)
    if i < len(lines) and lines[i] == "---":
        i += 1
        while i < len(lines) and lines[i] != "---":
            i += 1
        if i >= len(lines):
            return None
        i = skip(i + 1)
    if i >= len(lines):
        return None
    m = KIND.match(lines[i])
    return m.group(0) if m else None


def build_meta(module, text: str, html: str) -> dict:
    tokens = module._cm.parse(text)
    headings, kinds = [], []
    for i, tok in enumerate(tokens):
        if tok.type == "heading_open":
            inline = tokens[i + 1]
            title = "".join(c.content for c in (inline.children or []) if c.type in ("text", "code_inline"))
            hid = tok.attrGet("id")
            if not isinstance(hid, str):
                die(1, "a heading has no id attribute")
            headings.append({"level": int(tok.tag[1]), "id": hid, "text": title.strip()})
        elif tok.type == "fence" and (tok.info or "").strip().split(" ")[0] == "mermaid":
            kind = mermaid_kind(tok.content)
            if kind is not None and kind not in kinds and len(kinds) < MAX_KINDS:
                kinds.append(kind)
    front_list = module.front_matter_list(text)
    front = None
    if front_list is not None:
        front = {}
        for entry in front_list:
            front[entry["key"]] = entry["vals"] if entry["list"] else entry["vals"][0]
    title = next((h["text"] for h in headings if h["level"] == 1), None)
    return {
        "front": front,
        "frontList": front_list,
        "title": title,
        "headings": headings,
        "figures": html.count('<figure class="mermaid-figure"'),
        "tables": html.count('<div class="table-wrapper">'),
        "mermaidKinds": kinds,
    }


def main() -> None:
    sys.dont_write_bytecode = True
    ap = argparse.ArgumentParser(description="Write conformance/reference/ from a reference renderer.")
    ap.add_argument("--renderer", required=True, type=Path, help="the reference renderer module (.py)")
    ap.add_argument("--corpus", required=True, type=Path, help="the corpus directory (conformance/corpus)")
    ap.add_argument("--out", required=True, type=Path, help="the reference directory (conformance/reference)")
    ap.add_argument("--only", nargs="+", default=None, metavar="ID", help="regenerate only these case ids")
    args = ap.parse_args()

    if not args.renderer.is_file():
        die(2, "--renderer is not a file")
    if not args.corpus.is_dir():
        die(2, "--corpus is not a directory")
    inputs = {p.relative_to(args.corpus).with_suffix("").as_posix(): p for p in args.corpus.rglob("*.md")}
    ids = sorted(inputs)
    if args.only is not None:
        unknown = sorted(set(args.only) - set(inputs))
        if unknown:
            die(2, "unknown case id: " + ", ".join(unknown))
        ids = sorted(set(args.only))

    with tempfile.TemporaryDirectory() as tmp:
        module = load_renderer(args.renderer, Path(tmp))
        rendered = {}
        for cid in ids:
            raw = inputs[cid].read_bytes()
            text = raw.decode("utf-8", "replace")
            html = module.render_md.__wrapped__(text)
            if FAILED_MARK in html:
                die(1, f"{cid}: the reference rendered its failure fallback")
            rendered[cid] = (html, build_meta(module, text, html))

    provenance = {
        "python": platform.python_version(),
        "packages": {name: importlib.metadata.version(name) for name in PACKAGES},
        "renderer": sha256(args.renderer.read_bytes()),
        "inputs": {},
        "date": datetime.datetime.now(datetime.timezone.utc).date().isoformat(),
    }
    prov_path = args.out / "PROVENANCE.json"
    if args.only is not None:
        if not prov_path.is_file():
            die(2, "--only needs an existing PROVENANCE.json; run without --only first")
        old = json.loads(prov_path.read_text("utf-8"))
        for key in ("python", "packages", "renderer"):
            if old.get(key) != provenance[key]:
                die(2, f"the reference {key} changed since PROVENANCE.json; regenerate every case")
        provenance["inputs"] = {k: v for k, v in old.get("inputs", {}).items() if k in inputs}

    args.out.mkdir(parents=True, exist_ok=True)
    for cid, (html, meta) in rendered.items():
        target = args.out / f"{cid}.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(html.encode("utf-8"))
        (args.out / f"{cid}.meta.json").write_bytes(
            (json.dumps(meta, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        provenance["inputs"][cid] = sha256(inputs[cid].read_bytes())

    if args.only is None:
        keep = {f"{cid}.html" for cid in ids} | {f"{cid}.meta.json" for cid in ids} | {"PROVENANCE.json"}
        for p in sorted(args.out.rglob("*"), reverse=True):
            rel = p.relative_to(args.out).as_posix()
            if p.is_file() and rel not in keep:
                p.unlink()
            elif p.is_dir() and not any(p.iterdir()):
                p.rmdir()

    provenance["inputs"] = dict(sorted(provenance["inputs"].items()))
    prov_path.write_bytes((json.dumps(provenance, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(f"generate.py: wrote {len(rendered)} reference case(s)")


if __name__ == "__main__":
    main()
