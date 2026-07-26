import Capacitor

/**
 * MyDigitalClosetViewController
 *
 * Custom Capacitor bridge view controller that explicitly registers
 * BackgroundRemovalPlugin with the bridge during startup.
 *
 * Why this is needed:
 * Swift classes in dynamic pod frameworks are registered lazily in the
 * Objective-C runtime (Swift 5.7+ optimisation). Capacitor's auto-discovery
 * (objc_getClassList + CAPBridgedPlugin scan) therefore cannot find them
 * until they are first touched. Explicit registration via registerPluginType
 * bypasses this entirely and is the approach recommended by the Capacitor docs
 * for local plugins.
 *
 * Main.storyboard must reference this class (module: BackgroundRemovalPlugin)
 * instead of the default CAPBridgeViewController (module: Capacitor).
 */
@objc(MyDigitalClosetViewController)
public class MyDigitalClosetViewController: CAPBridgeViewController {
    open override func capacitorDidLoad() {
        bridge?.registerPluginType(BackgroundRemovalPlugin.self)
    }
}
