/**
 * BackgroundRemovalPlugin
 *
 * On-device subject/background separation using Apple Vision framework.
 * Requires iOS 17.0+ (VNGenerateForegroundInstanceMaskRequest).
 * Degrades gracefully on older OS — callers should check isSupported() first.
 *
 * Usage (TypeScript):
 *   const { supported } = await BackgroundRemoval.isSupported();
 *   if (supported) {
 *     const { dataUrl } = await BackgroundRemoval.removeBackground({ dataUrl: jpegDataUrl });
 *   }
 */

import Foundation
import Capacitor
import Vision
import CoreImage
import UIKit

@objc(BackgroundRemovalPlugin)
public class BackgroundRemovalPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier     = "BackgroundRemovalPlugin"
    public let jsName         = "BackgroundRemoval"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported",       returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeBackground",  returnType: CAPPluginReturnPromise),
    ]

    // ── isSupported ──────────────────────────────────────────────────────────────

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 17.0, *) {
            call.resolve(["supported": true])
        } else {
            call.resolve(["supported": false])
        }
    }

    // ── removeBackground ─────────────────────────────────────────────────────────

    @objc func removeBackground(_ call: CAPPluginCall) {
        guard let dataUrl = call.getString("dataUrl") else {
            call.reject("Missing required parameter: dataUrl")
            return
        }

        // Parse the base64 data URL (supports "data:image/jpeg;base64,..." format)
        let parts = dataUrl.components(separatedBy: ",")
        guard parts.count >= 2,
              let data = Data(base64Encoded: parts[1], options: .ignoreUnknownCharacters),
              let uiImage = UIImage(data: data),
              let cgImage = uiImage.cgImage else {
            call.reject("Invalid or unreadable image data")
            return
        }

        guard #available(iOS 17.0, *) else {
            call.reject("Background removal requires iOS 17.0 or later")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            self.doRemoveBackground(cgImage: cgImage, call: call)
        }
    }

    // ── Private Vision pipeline ──────────────────────────────────────────────────

    @available(iOS 17.0, *)
    private func doRemoveBackground(cgImage: CGImage, call: CAPPluginCall) {
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        let request = VNGenerateForegroundInstanceMaskRequest()

        do {
            try handler.perform([request])

            guard let result = request.results?.first else {
                call.reject("No foreground subject detected in this photo")
                return
            }

            // Generate masked CIImage — background pixels become transparent
            let maskedCI = try result.generateMaskedImage(
                ofInstances: result.allInstances,
                from: handler,
                croppedToInstancesExtent: false
            )

            // Render to CGImage and encode as PNG to preserve transparency
            let context = CIContext()
            guard let cgOut = context.createCGImage(maskedCI, from: maskedCI.extent) else {
                call.reject("Failed to render masked image")
                return
            }

            guard let pngData = UIImage(cgImage: cgOut).pngData() else {
                call.reject("Failed to encode result as PNG")
                return
            }

            let base64 = pngData.base64EncodedString()
            call.resolve(["dataUrl": "data:image/png;base64,\(base64)"])

        } catch {
            call.reject("Vision error: \(error.localizedDescription)")
        }
    }
}
