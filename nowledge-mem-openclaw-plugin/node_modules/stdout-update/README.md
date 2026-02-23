<p align="center"><img src="https://cdn.jsdelivr.net/gh/tagproject/art/packages/stdout-update/banner.svg" alt="Package logo"></p>

<p align="center">
    <a href="https://github.com/keindev/stdout-update/actions"><img src="https://github.com/keindev/stdout-update/actions/workflows/build.yml/badge.svg" alt="Build Status"></a>
    <a href="https://codecov.io/gh/keindev/stdout-update"><img src="https://codecov.io/gh/keindev/stdout-update/branch/master/graph/badge.svg" /></a>
    <a href="https://www.npmjs.com/package/stdout-update"><img alt="npm" src="https://img.shields.io/npm/v/stdout-update.svg"></a>
    <a href="https://github.com/tagproject/ts-package-shared-config"><img src="https://img.shields.io/badge/standard--shared--config-nodejs%2Bts-green?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAfCAYAAACh+E5kAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJQSURBVHgB1VftUcMwDFU4/tMNyAZ0A7IBbBA2CExAmIBjApcJChO0TFA2SJkgMIGRyDNV3TSt26RN353OX/LHUyTZIdoB1tqMZcaS0imBDzxkeWaJWR51SX0HrJ6pdsJyifpdb4loq3v9A+1CaBuWMR0Q502DzuJRFD34Y9z3DXIRNy/QPWKZY27COlM6BtZZHWMJ3CkVa28KZMTJkDpCVLOhs/oL2gMuEhYpxeenPPah9EdczLkvpwZgnQHWnlNLiNQGYiWx5gu6Ehz4m+WNN/2i9Yd75CJmeRDXogbIFxECrqQ2wIvlLBOXaViuYbGQNSQLFSGZyOnulb2wadaGnyoSSeC8GBJkNDf5kloESAhy2gFIIPG2+ufUMtivn/gAEi+Gy4u6FLxh/qer8/xbLq7QlNh6X4mbtr+A3pylDI0Lb43YrmLmXP5v3a4I4ABDRSI4xjB/ghveoj4BCVm37JQADhGDgOA+YJ48TSaoOwKpt27aOQG1WRES3La65WPU3dysTjE8de0Aj8SsKS5sdS9lqCeYI08bU6d8EALYS5OoDW4c3qi2gf7f+4yODfj2DIcqdVzYKnMtEUO7RP2gT/W1AImxXSC3i7R7rfRuMT5G2xzSYzaCDzOyyzDeuNHZx1a3fOdJJwh28fRwwT1QY6Xzf7TvWG6ob/BIGPQ59ymUngRyRn2El6Fy5T7G0zl+JmoC3KRQXyT1xpfiJKIeAemzqBl6U3V5ocZNf4hHg61u223wn4nOqF8IzvF9IxCMkyfQ+i/lnnhlmW6h9+Mqv1SmQhehji4JAAAAAElFTkSuQmCC" alt="Standard Shared Config"></a>
</p>

Purely and accurately overwrites the previous output in the terminal, while maintaining the history of third-party logs.

<p align="center">
    <img src="media/demo.gif">
</p>

## Install

```
npm install stdout-update
```

## Usage

```typescript
import UpdateManager from 'stdout-update';

const TICKS = 60;
const TIMEOUT = 80;
const manager = UpdateManager.getInstance();
const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const messages = ['Swapping time and space...', 'Have a good day.', "Don't panic...", 'Updating Updater...', '42'];
let ticks = TICKS;
let i = 0;

manager.hook();

// eslint-disable-next-line no-console
console.log(' - log message');
// eslint-disable-next-line no-console
console.error(' - error message');
// eslint-disable-next-line no-console
console.warn(' - warn message');

const id = setInterval(() => {
  if (--ticks < 0) {
    clearInterval(id);
    manager.update(['✔ Success', '', 'Messages:', 'this line is be deleted!!!']);
    manager.erase(1);
    manager.unhook(false);
  } else {
    const frame = frames[(i = ++i % frames.length)];
    const index = Math.round(ticks / 10) % messages.length;
    const message = messages[index];

    if (message) manager.update([`${frame} Some process...`, message]);
  }
}, TIMEOUT);
```

## Examples

[tasktree-cli](https://github.com/keindev/tasktree) - simple terminal task tree, helps you keep track of your tasks in a tree structure.

## API

Read the [API documentation](docs/api/index.md) for more information.
