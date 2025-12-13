export default {
  appId: 'com.tageai.app',
  productName: 'tage',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: [
    'dist-electron/**/*',
    'app-dist/**/*',
    'package.json',
  ],
  extraMetadata: {
    main: 'dist-electron/electron/main.js',
  },
  asar: true,
  mac: {
    category: 'public.app-category.productivity',
    target: ['dmg', 'zip'],
  },
  win: {
    target: ['nsis', 'zip'],
  },
  linux: {
    target: ['AppImage', 'deb'],
  },
};

