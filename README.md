# Sync SONAR

Changes from Facebook Engineering's Flipper:

* Branding
* Automatic updates from AWS S3
* Support for desktop devices (e.g., not just those running on iOS and Android)
* Automatic discovery between desktop and devices on same LAN based on SSDP standards
* Updated release/packaging scripts to harden and notarize app for distribution and support in macOS Catalina and later
* Removal of sample plugins and automatic inclusion of Sync SONAR plugins

For the remainder of the documenation we still refer to this project as Flipper, since 99% of the code is unchanged.

![Flipper](/docs/assets/layout.png)

## Table of Contents

- [Mobile development](#mobile-development)
- [Extending Flipper](#extending-flipper)
- [Contributing to Flipper](#contributing-to-flipper)
- [In this repo](#in-this-repo)
- [Getting started](#getting-started)
  - [Requirements](#requirements)
- [Building from Source](#building-from-source)
  - [Desktop](#desktop)
    - [Running from source](#running-from-source)
    - [Building standalone application](#building-standalone-application)
- [iOS SDK + Sample App](#ios-sdk--sample-app)
- [Android SDK + Sample app](#android-sdk--sample-app)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Mobile development

Flipper aims to be your number one companion for mobile app development on iOS and Android. Therefore, we provide a bunch of useful tools, including a log viewer, interactive layout inspector, and network inspector.

## Extending Flipper

Flipper is built as a platform. In addition to using the tools already included, you can create your own plugins to visualize and debug data from your mobile apps. Flipper takes care of sending data back and forth, calling functions, and listening for events on the mobile app.

## Contributing to Flipper

Both Flipper's desktop app and native mobile SDKs are open-source and MIT licensed. This enables you to see and understand how we are building plugins, and of course, join the community and help improve Flipper. We are excited to see what you will build on this platform.

# In this repo

This repository includes all parts of Flipper. This includes:

* Flipper's desktop app built using [Electron](https://electronjs.org) (`/desktop`)
* native Flipper SDKs for iOS (`/iOS`)
* native Flipper SDKs for Android (`/android`)
* Plugins:
  * Logs (`/desktop/src/device-plugins/logs`)
  * Layout inspector (`/desktop/plugins/layout`)
  * Network inspector (`/desktop/plugins/network`)
  * Shared Preferences/NSUserDefaults inspector (`/desktop/plugins/shared_preferences`)
* website and documentation (`/website` / `/docs`)

# Getting started

Please refer to our [Getting Started guide](https://fbflipper.com/docs/getting-started/) to set up Flipper.

## Requirements

* node >= 8
* yarn >= 1.5
* iOS developer tools (for developing iOS plugins)
* Android SDK and adb

# Building from Source

## Desktop
### Running from source

```
git clone https://github.com/facebook/flipper.git
cd flipper/desktop
yarn
yarn start
```

NOTE: If you're on Windows, you need to use Yarn 1.5.1 until [this issue](https://github.com/yarnpkg/yarn/issues/6048) is resolved.

### Building standalone application

Provide either `--mac`, `--win`, `--linux` or any combination of them
to `yarn build` to build a release zip file for the given platform(s). E.g.

```
yarn build --mac --version $buildNumber
```

You can find the resulting artifact in the `dist/` folder.

## iOS SDK + Sample App

```
cd iOS/Sample
rm -f Podfile.lock
pod install --repo-update
open Sample.xcworkspace
<Run app from xcode>
```

You can omit `--repo-update` to speed up the installation, but watch out as you may be building against outdated dependencies.

## Android SDK + Sample app

Start up an android emulator and run the following in the project root:
```
./gradlew :sample:installDebug
```

## React Native SDK + Sample app

```
cd react-native/ReactNativeFlipperExample
yarn
yarn android
```

Note that the first 2 steps need to be done only once.

Alternatively, the app can be started on `iOS` by running `yarn ios`.

#### Troubleshooting

Older yarn versions might show an error / hang with the message 'Waiting for the other yarn instance to finish'. If that happens, run the command `yarn` first separately in the directory `react-native/react-native-flipper`.

# Documentation

Find the full documentation for this project at [fbflipper.com](https://fbflipper.com/docs).

Our documentation is built with [Docusaurus](https://docusaurus.io/). You can build
it locally by running this:

```bash
cd website
yarn
yarn start
```

## Contributing
See the [CONTRIBUTING](/CONTRIBUTING.md) file for how to help out.

## License
Flipper is MIT licensed, as found in the [LICENSE](/LICENSE) file.
