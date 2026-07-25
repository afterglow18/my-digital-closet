#!/usr/bin/env ruby
# inject-plugin.rb
#
# Copies BackgroundRemovalPlugin.swift into the iOS App target and registers
# it in the Xcode project so it compiles without manual Xcode editing.
#
# Run from the repo root AFTER `cap add ios && cap sync`:
#   ruby artifacts/outfit-generator/ios-plugins/inject-plugin.rb
#
# Requires the xcodeproj gem (pre-installed on Codemagic macOS agents):
#   gem install xcodeproj

require 'xcodeproj'
require 'fileutils'

PLUGIN_SRC  = File.expand_path('../BackgroundRemovalPlugin.swift', __FILE__)
PROJECT_DIR = File.expand_path('../../ios/App', __FILE__)
APP_DIR     = File.join(PROJECT_DIR, 'App')
PROJECT_PATH = File.join(PROJECT_DIR, 'App.xcodeproj')
DEST_FILE   = 'BackgroundRemovalPlugin.swift'

abort "Xcode project not found at #{PROJECT_PATH} — run `cap add ios` first." unless Dir.exist?(PROJECT_PATH)

# 1. Copy Swift file into App target directory
FileUtils.cp(PLUGIN_SRC, File.join(APP_DIR, DEST_FILE))
puts "Copied #{DEST_FILE} → ios/App/App/"

# 2. Open project and add the file reference
project = Xcodeproj::Project.open(PROJECT_PATH)
target  = project.targets.find { |t| t.name == 'App' }
abort 'Could not find App target in Xcode project.' unless target

group = project.main_group.find_subpath('App', true)

# Avoid duplicate references
unless group.files.any? { |f| f.path == DEST_FILE }
  ref = group.new_file(DEST_FILE)
  target.source_build_phase.add_file_reference(ref)
  puts "Added #{DEST_FILE} to App target source build phase."
else
  puts "#{DEST_FILE} already in project — skipping."
end

project.save
puts 'Xcode project saved.'
