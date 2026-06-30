const { withXcodeProject } = require('@expo/config-plugins');

/**
 * react-native-pencil-kit requires PencilKit.framework to be linked manually
 * in Xcode (see package README) because Fabric prevents automatic Apple SDK
 * framework imports. We have no Xcode/Mac to do this by hand, so this plugin
 * does it during `expo prebuild` (which EAS Build runs in the cloud).
 */
const withPencilKitFramework = (config) => {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    xcodeProject.addFramework('PencilKit.framework', { weak: false });
    return config;
  });
};

module.exports = withPencilKitFramework;
