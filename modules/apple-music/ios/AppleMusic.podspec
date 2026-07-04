Pod::Spec.new do |s|
  s.name             = 'AppleMusic'
  s.version          = '1.0.0'
  s.summary          = 'Apple Music (MediaPlayer) control for console-command'
  s.description      = 'Controls the system Apple Music player and reads Now Playing / library metadata via MediaPlayer.'
  s.license          = 'MIT'
  s.author           = 'whir'
  s.homepage         = 'https://github.com/coffeedevsolutions/console-command'
  s.platforms        = { :ios => '15.1' }
  s.source           = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MediaPlayer'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
