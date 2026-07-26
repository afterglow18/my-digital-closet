#!/usr/bin/env python3
"""
patch_storyboard.py <path-to-Main.storyboard>

Replaces the default Capacitor bridge view controller with our custom subclass
(MyDigitalClosetViewController) so the app registers BackgroundRemovalPlugin
explicitly on startup rather than relying on the lazy ObjC runtime scan.

Run this AFTER `cap sync ios` so the storyboard file exists.
"""
import sys
import pathlib

if len(sys.argv) < 2:
    print("Usage: patch_storyboard.py <Main.storyboard>", file=sys.stderr)
    sys.exit(1)

path = pathlib.Path(sys.argv[1])
if not path.exists():
    print(f"ERROR: storyboard not found at {path}", file=sys.stderr)
    # Print nearby files to help debug
    import os
    parent = path.parent
    if parent.exists():
        print(f"Files in {parent}:", file=sys.stderr)
        for f in parent.iterdir():
            print(f"  {f}", file=sys.stderr)
    sys.exit(1)

txt = path.read_text()

if "MyDigitalClosetViewController" in txt:
    print("Storyboard already uses MyDigitalClosetViewController — no change.")
    sys.exit(0)

if 'customClass="CAPBridgeViewController"' not in txt:
    print("WARNING: CAPBridgeViewController not found — showing relevant lines:")
    for line in txt.splitlines():
        if "customClass" in line or "Bridge" in line or "viewController" in line.lower():
            print(f"  {line.strip()}")
    sys.exit(1)

# Swap the class and module references
txt = txt.replace(
    'customClass="CAPBridgeViewController"',
    'customClass="MyDigitalClosetViewController"'
)
txt = txt.replace(
    'customModule="Capacitor"',
    'customModule="BackgroundRemovalPlugin"'
)

path.write_text(txt)
print("✓ Storyboard patched: CAPBridgeViewController → MyDigitalClosetViewController")
print("  Module: Capacitor → BackgroundRemovalPlugin")
