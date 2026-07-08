Pod::Spec.new do |s|
  s.name             = 'NowSpinning'
  s.version          = '1.0.0'
  s.summary          = 'ShazamKit vinyl recognition for console-command'
  s.description      = 'Listens briefly through the mic and identifies the record playing (Now Spinning) via ShazamKit.'
  s.license          = 'MIT'
  s.author           = 'whir'
  s.homepage         = 'https://github.com/coffeedevsolutions/console-command'
  s.platforms        = { :ios => '15.1' }
  s.source           = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ShazamKit', 'AVFoundation'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
