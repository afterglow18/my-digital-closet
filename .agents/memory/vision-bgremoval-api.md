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

The xcodeproj injection (inject-plugin.rb) worked correctly on Codemagic — the Swift file compiled and linked. Only the return type was wrong.
