---
name: Vision background removal API quirk
description: generateMaskedImage returns CVPixelBuffer, not CIImage — must wrap before CIContext
---

`VNGenerateForegroundInstanceMaskRequest.generateMaskedImage(ofInstances:from:croppedToInstancesExtent:)` returns **`CVPixelBuffer`**, not `CIImage`.

**Why:** Apple's public docs say "returns a pixel buffer" but the name implies image. Easy to assume wrong type.

**How to apply:** Always bridge through `CIImage(cvPixelBuffer:)` before calling `CIContext.createCGImage`:

```swift
let pixelBuffer = try result.generateMaskedImage(
    ofInstances: result.allInstances,
    from: handler,
    croppedToInstancesExtent: false
)
let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
let context = CIContext()
guard let cgOut = context.createCGImage(ciImage, from: ciImage.extent) else { ... }
```

**Plugin registration (critical):** xcodeproj gem injection adds a file reference to the .pbxproj but the class does NOT appear in the ObjC runtime — Capacitor reports "plugin is not implemented on ios". Use a **local CocoaPod** instead:
1. `BackgroundRemovalPlugin.podspec` alongside the Swift file, declaring `s.dependency 'Capacitor'`
2. Patch the Podfile (`pod 'BackgroundRemovalPlugin', :path => '...'`) and run `pod install`
3. CocoaPods compiles the Swift file into the App target and the class is auto-discovered by Capacitor's `objc_getClassList` scan at runtime.
