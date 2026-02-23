const PACKAGE_NAME = `@lydell/node-pty-${process.platform}-${process.arch}`;

const help = `
This can happen if you use the "--omit=optional" (or "--no-optional") npm flag.
The "optionalDependencies" package.json feature is used to install the correct
binary executable for your current platform. Remove that flag to use @lydell/node-pty.

This can also happen if the "node_modules" folder was copied between two operating systems
that need different binaries - including "virtual" operating systems like Docker and WSL.
If so, try installing with npm rather than copying "node_modules".
`.trim();

function requirePlatformSpecificPackage() {
  try {
    return require(PACKAGE_NAME);
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") {
      const optionalDependencies = getOptionalDependencies();
      throw new Error(
        optionalDependencies === undefined
          ? `The @lydell/node-pty package could not find the platform-specific package: ${PACKAGE_NAME}\n\n${help}\n\nYour platform (${process.platform}-${process.arch}) might not be supported.`
          : PACKAGE_NAME in optionalDependencies
          ? `The @lydell/node-pty package supports your platform (${process.platform}-${process.arch}), but it could not find the platform-specific package for it: ${PACKAGE_NAME}\n\n${help}`
          : `The @lydell/node-pty package currently does not support your platform: ${process.platform}-${process.arch}`,
        { cause: error }
      );
    } else {
      throw error;
    }
  }
}

function getOptionalDependencies() {
  try {
    return require("./package.json").optionalDependencies;
  } catch (_error) {
    return undefined;
  }
}

// These two lines are needed for `import * as pty from "@lydell/node-pty"` to work.
// `import * as pty` is used in the README of microsoft/node-pty.
Object.defineProperty(exports, "__esModule", { value: true });
// prettier-ignore
exports.native = exports.open = exports.createTerminal = exports.fork = exports.spawn = void 0;

module.exports = requirePlatformSpecificPackage();
