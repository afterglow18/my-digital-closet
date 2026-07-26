#!/usr/bin/env ruby
# inject-plugin.rb
#
# Copies BackgroundRemovalPlugin.swift into the iOS App target and registers
# it in the Xcode project so it compiles with the App target.
#
# Run from the repo root AFTER `cap add ios && cap sync`:
#   ruby artifacts/outfit-generator/ios-plugins/inject-plugin.rb
#
# Requires the xcodeproj gem (pre-installed on Codemagic macOS agents).

require 'xcodeproj'
require 'fileutils'

PLUGIN_SRC   = File.expand_path('../BackgroundRemovalPlugin.swift', __FILE__)
PROJECT_DIR  = File.expand_path('../../ios/App', __FILE__)
APP_DIR      = File.join(PROJECT_DIR, 'App')
PROJECT_PATH = File.join(PROJECT_DIR, 'App.xcodeproj')
DEST_FILE    = 'BackgroundRemovalPlugin.swift'
DEST_PATH    = File.join(APP_DIR, DEST_FILE)

abort "Xcode project not found at #{PROJECT_PATH} — run `cap add ios` first." unless Dir.exist?(PROJECT_PATH)
abort "Source plugin not found at #{PLUGIN_SRC}" unless File.exist?(PLUGIN_SRC)

# 1. Copy Swift file into App target directory
FileUtils.cp(PLUGIN_SRC, DEST_PATH)
puts "Copied #{DEST_FILE} → #{DEST_PATH}"
abort "File copy failed!" unless File.exist?(DEST_PATH)

# 2. Open project and add the file reference
project = Xcodeproj::Project.open(PROJECT_PATH)
target  = project.targets.find { |t| t.name == 'App' }
abort 'Could not find App target in Xcode project.' unless target

group = project.main_group.find_subpath('App', true)

# Check for existing reference — match by last component to handle both relative/absolute
existing = group.files.find do |f|
  File.basename(f.path.to_s) == DEST_FILE
end

if existing
  puts "#{DEST_FILE} already in project group — checking compile sources phase..."
  # Ensure it's in the build phase even if the group reference already existed
  phase = target.source_build_phase
  unless phase.files_references.any? { |f| f && File.basename(f.path.to_s) == DEST_FILE }
    phase.add_file_reference(existing)
    puts "Added existing reference to compile sources build phase."
  else
    puts "Already in compile sources build phase — no changes needed."
  end
else
  ref = group.new_reference(DEST_FILE)
  ref.source_tree = '<group>'
  target.source_build_phase.add_file_reference(ref)
  puts "Added #{DEST_FILE} to App group and compile sources build phase."
end

project.save
puts "Xcode project saved."

# 3. Verify the file reference appears in the saved .pbxproj
pbxproj = File.join(PROJECT_PATH, 'project.pbxproj')
content  = File.read(pbxproj)
if content.include?(DEST_FILE)
  puts "✓ Verified: #{DEST_FILE} is present in project.pbxproj"
else
  abort "✗ FAILED: #{DEST_FILE} not found in project.pbxproj after save — injection did not work."
end

# 4. Print summary
puts ""
puts "=== Injection complete ==="
puts "  Plugin file : #{DEST_PATH}"
puts "  Project     : #{PROJECT_PATH}"
puts "  Target      : #{target.name}"
puts "  Swift class : BackgroundRemovalPlugin (jsName: BackgroundRemoval)"
