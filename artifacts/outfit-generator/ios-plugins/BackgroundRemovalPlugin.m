// BackgroundRemovalPlugin.m
//
// This file exists for one reason: Swift classes inside a dynamic pod framework
// are NOT eagerly registered in the Objective-C runtime (Swift 5.7+ lazy
// registration). Capacitor's auto-discovery (objc_getClassList scan) therefore
// never finds BackgroundRemovalPlugin.swift.
//
// The fix is this tiny ObjC file using the CAP_PLUGIN macro — the same
// mechanism every first-party Capacitor plugin (Camera, Filesystem, etc.) uses.
// The macro generates a +load method on an ObjC class, which the ObjC runtime
// calls eagerly when the framework is loaded — before Capacitor starts its scan.
// No storyboard patching, no custom bridge view controller needed.

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(BackgroundRemovalPlugin, "BackgroundRemoval",
    CAP_PLUGIN_METHOD(isSupported, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(removeBackground, CAPPluginReturnPromise);
)
