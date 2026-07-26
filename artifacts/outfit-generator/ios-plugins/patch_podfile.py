#!/usr/bin/env python3
"""
patch_podfile.py <path-to-Podfile>

Inserts BackgroundRemovalPlugin as a local CocoaPod into the Capacitor-
generated Podfile before the closing `end` of the `target 'App' do` block.
Run this AFTER `cap add ios` and BEFORE `cap sync ios` (which runs pod install).
"""
import sys, re

if len(sys.argv) < 2:
    print("Usage: patch_podfile.py <Podfile>", file=sys.stderr)
    sys.exit(1)

path = sys.argv[1]

with open(path) as f:
    txt = f.read()

POD_LINE = "  pod 'BackgroundRemovalPlugin', :path => '../../ios-plugins'\n"

if 'BackgroundRemovalPlugin' in txt:
    print("BackgroundRemovalPlugin already present — skipping.")
    sys.exit(0)

# Insert before the final bare `end` that closes `target 'App' do`
patched = re.sub(r'\nend(\s*)$', '\n' + POD_LINE + r'end\1', txt)
if patched == txt:
    # Fallback: append before last line containing only 'end'
    lines = txt.splitlines(keepends=True)
    idx = next((i for i in reversed(range(len(lines))) if lines[i].strip() == 'end'), None)
    if idx is None:
        print("ERROR: could not locate closing 'end' in Podfile.", file=sys.stderr)
        sys.exit(1)
    lines.insert(idx, POD_LINE)
    patched = ''.join(lines)

with open(path, 'w') as f:
    f.write(patched)

print("Podfile patched — BackgroundRemovalPlugin local pod added.")
