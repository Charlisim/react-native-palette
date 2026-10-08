const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

// The example imports the shared core from the repository root.
const root = path.resolve(__dirname, '..');
const config = getDefaultConfig(__dirname);

config.watchFolders = [root];
config.resolver.extraNodeModules = { 'palette-react-native': root };
config.resolver.blockList = [new RegExp(`^${path.join(root, 'node_modules').replace(/[/\\]/g, '[/\\\\]')}[/\\\\].*`)];

module.exports = config;
