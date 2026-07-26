Pod::Spec.new do |s|
  s.name                   = 'BackgroundRemovalPlugin'
  s.version                = '1.0.0'
  s.summary                = 'On-device background removal via Apple Vision for Capacitor'
  s.description            = <<-DESC
    Capacitor plugin that uses VNGenerateForegroundInstanceMaskRequest (iOS 17+)
    to remove image backgrounds entirely on-device. No API key or network needed.
  DESC
  s.homepage               = 'https://github.com/afterglow18/my-digital-closet'
  s.license                = { :type => 'MIT' }
  s.author                 = { 'My Digital Closet' => 'dev@mydigitalcloset.com' }

  # The Swift source lives alongside this podspec
  s.source                 = { :path => '.' }
  s.source_files           = 'BackgroundRemovalPlugin.swift'

  s.ios.deployment_target  = '15.0'
  s.swift_version          = '5.9'

  # Depends on the Capacitor iOS framework installed by cap add ios
  s.dependency 'Capacitor'
end
