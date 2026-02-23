var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Wrapper_rows;
import ansiStyles from 'ansi-styles';
import stringWidth from 'string-width';
import stripAnsi from 'strip-ansi';
import { Terminal } from './Terminal.js';
const ESCAPES = new Set(['\u001B', '\u009B']);
const DEFAULT_COLOR_CODE = 39;
const INDENT = 4;
export class Wrapper {
    constructor() {
        _Wrapper_rows.set(this, void 0);
        __classPrivateFieldSet(this, _Wrapper_rows, [''], "f");
    }
    wrap(str, limit) {
        if (!str.trim().length)
            return [''];
        __classPrivateFieldSet(this, _Wrapper_rows, [''], "f");
        const rows = __classPrivateFieldGet(this, _Wrapper_rows, "f");
        let rowLength;
        let wordLength;
        str
            .normalize()
            .split(' ')
            .forEach((word, index) => {
            rowLength = stringWidth(rows[rows.length - 1] ?? '');
            wordLength = stringWidth(word);
            if (index !== 0) {
                rows[rows.length - 1] += ' ';
                rowLength++;
            }
            if (wordLength > limit) {
                const remainingColumns = limit - rowLength;
                const breaksStartingThisLine = 1 + Math.floor((wordLength - remainingColumns - 1) / limit);
                const breaksStartingNextLine = Math.floor((wordLength - 1) / limit);
                if (breaksStartingNextLine < breaksStartingThisLine)
                    rows.push('');
                this.wrapWord(word, limit);
            }
            else {
                if (rowLength && wordLength && rowLength + wordLength > limit)
                    rows.push('');
                rows[rows.length - 1] += word;
            }
        });
        return this.wrapEscapes(rows.map(value => value.trimRight()).join(Terminal.EOL)).split(Terminal.EOL);
    }
    wrapEscapes(characters) {
        const slice = (index) => /\d[^m]*/.exec(characters.slice(index, index + INDENT));
        const wrap = (code) => `${ESCAPES.values().next().value}[${code}m`;
        let result = '';
        let match;
        let code;
        let escapeCode;
        [...characters].forEach((character, index) => {
            result += character;
            if (ESCAPES.has(character)) {
                match = slice(index);
                if (match && match[0]) {
                    code = parseFloat(match[0]);
                    escapeCode = code === DEFAULT_COLOR_CODE ? undefined : code;
                }
            }
            if (escapeCode) {
                code = ansiStyles.codes.get(escapeCode);
                if (code) {
                    if (characters[index + 1] === Terminal.EOL)
                        result += wrap(code);
                    if (character === Terminal.EOL)
                        result += wrap(escapeCode);
                }
            }
        });
        return result;
    }
    wrapWord(word, limit) {
        const rows = __classPrivateFieldGet(this, _Wrapper_rows, "f");
        let isInsideEscape = false;
        let visible = stringWidth(stripAnsi(rows[rows.length - 1] ?? ''));
        [...word].forEach((character, index, characters) => {
            const characterLength = stringWidth(character);
            if (visible + characterLength <= limit) {
                rows[rows.length - 1] += character;
            }
            else {
                rows.push(character);
                visible = 0;
            }
            if (ESCAPES.has(character))
                isInsideEscape = true;
            else if (isInsideEscape && character === 'm')
                isInsideEscape = false;
            else if (!isInsideEscape) {
                visible += characterLength;
                if (visible === limit && index < characters.length - 1) {
                    rows.push('');
                    visible = 0;
                }
            }
        });
        if (!visible && (rows[rows.length - 1] ?? '').length > 0 && rows.length > 1)
            rows[rows.length - 2] += rows.pop();
    }
}
_Wrapper_rows = new WeakMap();
