# chmodrp

[![npm version](https://img.shields.io/npm/v/chmodrp)](https://npmjs.com/package/chmodrp)

A port of [isaacs's chmodr](https://github.com/isaacs/chmodr) but using the Promise API.\
Has the same effect as the command line command: `chmod -R`.

## Install

```shell
npm install chmodrp
```

## API

### chmodr(path, mode)

Returns: `Promise<void>`

Takes the same arguments as [`fs.promises.chmod()`](https://nodejs.org/api/fs.html#fspromiseschmodpath-mode)

#### path

Type: `string`

The path of the file to recursively `chmod`.

#### mode

Type: `number`

The file mode to `chmod` the files with.

### chmodrSync(path, mode)

Returns: `void`

Does the same thing as `chmodr(path, mode)` but synchronously.

## Usage

```typescript
import { chmodr, chmodrSync } from 'chmodrp';

await chmodr('/var/www/my/test/folder', 0o777);
chmodrSync('/var/www/my/test/folder2', 0o777);
```
