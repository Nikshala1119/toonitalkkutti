const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle Rive rig files as assets (FR-1.1)
if (!config.resolver.assetExts.includes('riv')) {
  config.resolver.assetExts.push('riv');
}

module.exports = config;
