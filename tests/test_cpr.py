"""Cross-check engine/cpr.py and engine/cpr.js against the Item Editor's verified CPR model."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "engine"))
sys.path.insert(0, r"C:\Users\falor\OneDrive\Belgeler\Hero Siege\source\HSItemEditor")

import cpr  # noqa: E402

try:
    import generated_pool_model as G  # noqa: E402
except Exception:  # pragma: no cover
    G = None

SEEDS = [1, 2, 7, 432571, 999999999, 1000000000, 123456789]
UPPERS = [2, 4, 9, 22, 100, 1000000]


class CprTests(unittest.TestCase):
    def test_python_matches_item_editor_model(self):
        if G is None:
            self.skipTest("Item Editor model not importable")
        for seed in SEEDS:
            a = cpr.Cpr(seed)
            state = seed
            for upper in UPPERS:
                state, roll = G._draw(state, upper)
                self.assertEqual(a.irandom(upper), roll, (seed, upper))
                self.assertEqual(a.state, state)

    def test_js_matches_python(self):
        node = "node"
        script = (
            "import('./engine/cpr.js').then(m => {"
            "const out = [];"
            f"for (const seed of {json.dumps(SEEDS)}) {{ const c = new m.Cpr(seed);"
            f"for (const u of {json.dumps(UPPERS)}) out.push([c.irandom(u), c.state]); }}"
            "console.log(JSON.stringify(out)); })"
        )
        try:
            res = subprocess.run([node, "--input-type=module", "-e", script], cwd=ROOT, capture_output=True, text=True, timeout=60)
        except FileNotFoundError:
            self.skipTest("node not installed")
        self.assertEqual(res.returncode, 0, res.stderr)
        js = json.loads(res.stdout.strip())
        py = []
        for seed in SEEDS:
            c = cpr.Cpr(seed)
            for u in UPPERS:
                py.append([c.irandom(u), c.state])
        self.assertEqual(js, py)


if __name__ == "__main__":
    unittest.main()
