#!/usr/bin/env ruby
# inject-plugin.rb
#
# Registers BackgroundRemovalPlugin as a local CocoaPod so it is compiled
# into the App target by `pod install`.
#
# Run from the repo root AFTER `cap add ios && cap sync ios`:
#   ruby artifacts/outfit-generator/ios-plugins/inject-plugin.rb
#
# No third-party gems required — only stdlib + system `pod` CLI.

PODFILE_PATH = File.expand_path('../../ios/App/Podfile', __FILE__)
POD_DIR      = File.expand_path('../../ios/App', __FILE__)
# Path is relative to the Podfile location (ios/App/Podfile → ios-plugins/)
RELATIVE_POD_PATH = '../../ios-plugins'
POD_LINE         = "  pod 'BackgroundRemovalPlugin', :path => '#{RELATIVE_POD_PATH}'\n"

abort "Podfile not found at #{PODFILE_PATH} — run `cap add ios` first." unless File.exist?(PODFILE_PATH)

content = File.read(PODFILE_PATH)
puts "--- Current Podfile ---"
puts content
puts "-----------------------"

if content.include?('BackgroundRemovalPlugin')
  puts "BackgroundRemovalPlugin already present in Podfile — skipping patch."
else
  # Insert the pod line just before the closing `end` of the `target 'App' do` block.
  # Capacitor's generated Podfile ends with:
  #   target 'App' do
  #     capacitor_pods
  #   end        ← we insert our pod before this final `end`
  patched = content.sub(/^(end\s*)$/) { POD_LINE + $1 }

  if patched == content
    # Fallback: append before last line containing bare `end`
    lines = content.lines
    idx   = lines.rindex { |l| l.strip == 'end' }
    abort "Could not locate closing `end` in Podfile — manual patch required." unless idx
    lines.insert(idx, POD_LINE)
    patched = lines.join
  end

  File.write(PODFILE_PATH, patched)
  puts "Patched Podfile — added BackgroundRemovalPlugin local pod."
  puts "--- Patched Podfile ---"
  puts File.read(PODFILE_PATH)
  puts "-----------------------"
end

# Run pod install so the plugin is compiled into the Xcode workspace
puts "\nRunning `pod install` in #{POD_DIR} ..."
success = system("cd '#{POD_DIR}' && pod install --repo-update 2>&1")
abort "`pod install` failed — see output above." unless success

puts "\n=== BackgroundRemovalPlugin injection complete ==="
puts "  Podspec : #{File.expand_path('../BackgroundRemovalPlugin.podspec', __FILE__)}"
puts "  Podfile : #{PODFILE_PATH}"
puts "  Swift   : BackgroundRemovalPlugin (jsName: BackgroundRemoval)"
