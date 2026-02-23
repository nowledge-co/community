'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var fs = require('node:fs');
var path = require('node:path');

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n["default"] = e;
    return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespace(fs);
var path__namespace = /*#__PURE__*/_interopNamespace(path);

// If a party has r, add x
// so that dirs are listable
const dirMode = (mode) => {
    mode = Number(mode);
    if (mode & 0o400)
        mode |= 0o100;
    if (mode & 0o40)
        mode |= 0o10;
    if (mode & 0o4)
        mode |= 0o1;
    return mode;
};
async function chmodrKid(entryPath, child, mode) {
    if (typeof child === 'string') {
        const stats = (await fs__namespace.promises.lstat(path__namespace.resolve(entryPath, child)));
        stats.name = child;
        await chmodrKid(entryPath, stats, mode);
        return;
    }
    if (child.isDirectory()) {
        await chmodr(path__namespace.resolve(entryPath, child.name), mode);
        await fs__namespace.promises.chmod(path__namespace.resolve(entryPath, child.name), dirMode(mode));
    }
    else {
        await fs__namespace.promises.chmod(path__namespace.resolve(entryPath, child.name), mode);
    }
}
function chmodrKidSync(entryPath, child, mode) {
    if (typeof child === 'string') {
        const stats = fs__namespace.lstatSync(path__namespace.resolve(entryPath, child));
        stats.name = child;
        child = stats;
    }
    if (child.isDirectory()) {
        chmodrSync(path__namespace.resolve(entryPath, child.name), mode);
        fs__namespace.chmodSync(path__namespace.resolve(entryPath, child.name), dirMode(mode));
    }
    else {
        fs__namespace.chmodSync(path__namespace.resolve(entryPath, child.name), mode);
    }
}
async function chmodr(entryPath, mode) {
    try {
        const children = await fs__namespace.promises.readdir(entryPath, {
            withFileTypes: true,
        });
        if (children.length === 0) {
            await fs__namespace.promises.chmod(entryPath, dirMode(mode));
            return;
        }
        await Promise.all(children.map(async (child) => {
            await chmodrKid(entryPath, child, mode);
            await fs__namespace.promises.chmod(entryPath, dirMode(mode));
        }));
    }
    catch (error) {
        const err = error;
        if (err.code === 'ENOTDIR') {
            await fs__namespace.promises.chmod(entryPath, mode);
        }
        // any error other than ENOTDIR means it's not readable, or
        // doesn't exist. Give up.
        else {
            throw err;
        }
    }
}
function chmodrSync(entryPath, mode) {
    let children;
    try {
        children = fs__namespace.readdirSync(entryPath, { withFileTypes: true });
        for (const child of children) {
            chmodrKidSync(entryPath, child, mode);
        }
        fs__namespace.chmodSync(entryPath, dirMode(mode));
    }
    catch (error) {
        const err = error;
        if (err.code === 'ENOTDIR') {
            fs__namespace.chmodSync(entryPath, mode);
        }
        else {
            throw err;
        }
    }
}

exports.chmodr = chmodr;
exports.chmodrSync = chmodrSync;
