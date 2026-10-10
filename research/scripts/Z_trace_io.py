"""Provenance tracer: re-run every saved research script and record the files it
actually opens (read vs write) via Python's audit hook. Also hashes research/data
before and after so we can see whether outputs reproduce byte-for-byte.

Usage: .venv/bin/python research/scripts/Z_trace_io.py
Output: research/data/Z_io_trace.json
"""
import glob
import hashlib
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PY = os.path.join(ROOT, ".venv", "bin", "python")

# One child process per script; the child installs the audit hook, then runs it.
CHILD = r'''
import sys, os, json, runpy
ROOT = sys.argv[1]; script = sys.argv[2]; out = sys.argv[3]; args = sys.argv[4:]
seen = {}
def hook(event, a):
    if event != "open" or not a or not isinstance(a[0], (str, bytes, os.PathLike)):
        return
    p = os.path.abspath(os.fsdecode(a[0]))
    if not p.startswith(ROOT) or "/.venv/" in p or "__pycache__" in p:
        return
    mode = a[1] if len(a) > 1 and isinstance(a[1], str) else "r"
    flags = a[2] if len(a) > 2 and isinstance(a[2], int) else 0
    w = any(c in mode for c in "wax+") or bool(flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT))
    rel = os.path.relpath(p, ROOT)
    seen.setdefault(rel, set()).add("write" if w else "read")
sys.addaudithook(hook)
sys.argv = [script] + args
status = "ok"
try:
    runpy.run_path(script, run_name="__main__")
except SystemExit as e:
    status = "ok" if not e.code else "exit %s" % e.code
except Exception as e:
    status = "error: %s: %s" % (type(e).__name__, str(e)[:200])
with open(out, "w") as f:
    json.dump({"status": status, "io": {k: sorted(v) for k, v in seen.items()}}, f)
'''


def digest():
    h = {}
    for p in sorted(glob.glob(os.path.join(ROOT, "research", "data", "*"))):
        if os.path.isfile(p) and not p.endswith("Z_io_trace.json"):
            with open(p, "rb") as f:
                h[os.path.relpath(p, ROOT)] = hashlib.sha256(f.read()).hexdigest()
    return h


def main():
    scripts = sorted(glob.glob(os.path.join(ROOT, "research", "scripts", "[A-F]*.py")))
    # Scripts that need CLI args to do anything (seen in the subagent transcripts).
    extra = {"F_probe_matrix.py": ["F70", "17"], "F_show_pages.py": ["F70", "17"]}
    before = digest()
    child = os.path.join(ROOT, "research", "data", ".trace_child.py")
    with open(child, "w") as f:
        f.write(CHILD)
    results = []
    for s in scripts:
        name = os.path.basename(s)
        tmp = os.path.join(ROOT, "research", "data", ".trace_out.json")
        p = subprocess.run([PY, child, ROOT, s, tmp] + extra.get(name, []),
                           cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=600)
        try:
            with open(tmp) as f:
                r = json.load(f)
        except Exception:
            r = {"status": "tracer failed: %s" % p.stderr.decode()[-200:], "io": {}}
        r["script"] = os.path.relpath(s, ROOT)
        results.append(r)
        print("%-45s %s" % (name, r["status"]), flush=True)
    for p in (child, os.path.join(ROOT, "research", "data", ".trace_out.json")):
        if os.path.exists(p):
            os.remove(p)
    after = digest()
    changed = sorted(k for k in after if k in before and before[k] != after[k])
    new = sorted(k for k in after if k not in before)
    with open(os.path.join(ROOT, "research", "data", "Z_io_trace.json"), "w") as f:
        json.dump({"scripts": results, "outputs_changed_on_rerun": changed,
                   "outputs_new_on_rerun": new}, f, indent=1)
    print("changed on rerun:", changed)
    print("new on rerun:", new)


if __name__ == "__main__":
    sys.exit(main())
