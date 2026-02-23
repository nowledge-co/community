# @lydell/node-pty

Smaller distribution of [microsoft/node-pty](https://github.com/microsoft/node-pty).

- microsoft/node-pty ships with prebuilt binaries for multiple platforms. @lydell/node-pty only installs the prebuilt binaries needed for the current platform (depends on your package manager).
- microsoft/node-pty supports compiling using node-gyp on unsupported platforms, which requires more source files. @lydell/node-pty only works on platforms with prebuilt binaries and never calls node-gyp.
- microsoft/node-pty ships with unneeded files, such as source code TypeScript files, source maps and test files. @lydell/node-pty removes those.
- microsoft/node-pty is about 60 MiB. @lydell/node-pty is less than 1 MiB on macOS and Linux, and around 30 MiB on Windows.

@lydell/node-pty is built like this:

1. Download the original node-pty npm package.
2. Make one copy of it per supported platform.
3. For each copy, only include relevant files.
4. Make the @lydell/node-pty wrapper package, which depends on all the platform-specific packages using `"optionalDependencies"` in package.json, allowing package managers to only install the platform-specific package matching the current platform. The wrapper package only re-exports everything from the correct platform-specific package.

## pty.js

microsoft/node-pty is forked from [chjj/pty.js](https://github.com/chjj/pty.js) with the primary goals being to provide better support for later Node.js versions and Windows.

## License

Copyright (c) 2012-2015, Christopher Jeffrey (MIT License).<br>
Copyright (c) 2016, Daniel Imms (MIT License).<br>
Copyright (c) 2018, Microsoft Corporation (MIT License).

## Version

@lydell/node-pty@1.2.0-beta.3 is based on node-pty@1.2.0-beta.3.

## Prebuilt binaries

This package includes prebuilt binaries for the following platforms and architectures:

- macOS ARM64 (darwin-arm64)
- macOS x86_64 (darwin-x64)
- Linux ARM64 (linux-arm64)
- Linux x86_64 (linux-x64)
- Windows ARM64 (win32-arm64)
- Windows x86_64 (win32-x64)