import { prettyLogStyles } from "../prettyLogStyles.js";
import { jsonStringifyRecursive } from "./jsonStringifyRecursive.js";
export function inspect(obj, opts) {
    const ctx = {
        seen: [],
        stylize: stylizeNoColor,
    };
    if (opts != null) {
        _extend(ctx, opts);
    }
    if (isUndefined(ctx.showHidden))
        ctx.showHidden = false;
    if (isUndefined(ctx.depth))
        ctx.depth = 2;
    if (isUndefined(ctx.colors))
        ctx.colors = true;
    if (isUndefined(ctx.customInspect))
        ctx.customInspect = true;
    if (ctx.colors)
        ctx.stylize = stylizeWithColor;
    return formatValue(ctx, obj, ctx.depth);
}
inspect.colors = prettyLogStyles;
inspect.styles = {
    special: "cyan",
    number: "yellow",
    boolean: "yellow",
    undefined: "grey",
    null: "bold",
    string: "green",
    date: "magenta",
    regexp: "red",
};
function isBoolean(arg) {
    return typeof arg === "boolean";
}
function isUndefined(arg) {
    return arg === undefined;
}
function stylizeNoColor(str) {
    return str;
}
function stylizeWithColor(str, styleType) {
    const style = inspect.styles[styleType];
    if (style != null && inspect?.colors?.[style]?.[0] != null && inspect?.colors?.[style]?.[1] != null) {
        return "\u001b[" + inspect.colors[style][0] + "m" + str + "\u001b[" + inspect.colors[style][1] + "m";
    }
    else {
        return str;
    }
}
function isFunction(arg) {
    return typeof arg === "function";
}
function isString(arg) {
    return typeof arg === "string";
}
function isNumber(arg) {
    return typeof arg === "number";
}
function isNull(arg) {
    return arg === null;
}
function hasOwn(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}
function isRegExp(re) {
    return isObject(re) && objectToString(re) === "[object RegExp]";
}
function isObject(arg) {
    return typeof arg === "object" && arg !== null;
}
function isError(e) {
    return isObject(e) && (objectToString(e) === "[object Error]" || e instanceof Error);
}
function isDate(d) {
    return isObject(d) && objectToString(d) === "[object Date]";
}
function objectToString(o) {
    return Object.prototype.toString.call(o);
}
function arrayToHash(array) {
    const hash = {};
    array.forEach((val) => {
        hash[val] = true;
    });
    return hash;
}
function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
    const output = [];
    for (let i = 0, l = value.length; i < l; ++i) {
        if (hasOwn(value, String(i))) {
            output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
        }
        else {
            output.push("");
        }
    }
    keys.forEach((key) => {
        if (!key.match(/^\d+$/)) {
            output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
        }
    });
    return output;
}
function formatError(value) {
    return "[" + Error.prototype.toString.call(value) + "]";
}
export function formatValue(ctx, value, recurseTimes = 0) {
    if (ctx.customInspect &&
        value != null &&
        isFunction(value) &&
        value?.inspect !== inspect &&
        !(value?.constructor && value?.constructor.prototype === value)) {
        if (typeof value.inspect !== "function" && value.toString != null) {
            return value.toString();
        }
        let ret = value?.inspect(recurseTimes, ctx);
        if (!isString(ret)) {
            ret = formatValue(ctx, ret, recurseTimes);
        }
        return ret;
    }
    const primitive = formatPrimitive(ctx, value);
    if (primitive) {
        return primitive;
    }
    let keys = Object.keys(value);
    const visibleKeys = arrayToHash(keys);
    try {
        if (ctx.showHidden && Object.getOwnPropertyNames) {
            keys = Object.getOwnPropertyNames(value);
        }
    }
    catch {
    }
    if (isError(value) && (keys.indexOf("message") >= 0 || keys.indexOf("description") >= 0)) {
        return formatError(value);
    }
    if (keys.length === 0) {
        if (isFunction(ctx.stylize)) {
            if (isFunction(value)) {
                const name = value.name ? ": " + value.name : "";
                return ctx.stylize("[Function" + name + "]", "special");
            }
            if (isRegExp(value)) {
                return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
            }
            if (isDate(value)) {
                return ctx.stylize(Date.prototype.toISOString.call(value), "date");
            }
            if (isError(value)) {
                return formatError(value);
            }
        }
        else {
            return value;
        }
    }
    let base = "";
    let array = false;
    let braces = ["{\n", "\n}"];
    if (Array.isArray(value)) {
        array = true;
        braces = ["[\n", "\n]"];
    }
    if (isFunction(value)) {
        const n = value.name ? ": " + value.name : "";
        base = " [Function" + n + "]";
    }
    if (isRegExp(value)) {
        base = " " + RegExp.prototype.toString.call(value);
    }
    if (isDate(value)) {
        base = " " + Date.prototype.toUTCString.call(value);
    }
    if (isError(value)) {
        base = " " + formatError(value);
    }
    if (keys.length === 0 && (!array || value.length == 0)) {
        return braces[0] + base + braces[1];
    }
    if (recurseTimes < 0) {
        if (isRegExp(value)) {
            return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
        }
        else {
            return ctx.stylize("[Object]", "special");
        }
    }
    ctx.seen.push(value);
    let output;
    if (array) {
        output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
    }
    else {
        output = keys.map((key) => {
            return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
        });
    }
    ctx.seen.pop();
    return reduceToSingleString(output, base, braces);
}
function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
    let name, str;
    let desc = { value: void 0 };
    try {
        desc.value = value[key];
    }
    catch {
    }
    try {
        if (Object.getOwnPropertyDescriptor) {
            desc = Object.getOwnPropertyDescriptor(value, key) || desc;
        }
    }
    catch {
    }
    if (desc.get) {
        if (desc.set) {
            str = ctx.stylize("[Getter/Setter]", "special");
        }
        else {
            str = ctx.stylize("[Getter]", "special");
        }
    }
    else {
        if (desc.set) {
            str = ctx.stylize("[Setter]", "special");
        }
    }
    if (!hasOwn(visibleKeys, key)) {
        name = "[" + key + "]";
    }
    if (!str) {
        if (ctx.seen.indexOf(desc.value) < 0) {
            if (isNull(recurseTimes)) {
                str = formatValue(ctx, desc.value, undefined);
            }
            else {
                str = formatValue(ctx, desc.value, recurseTimes - 1);
            }
            if (str.indexOf("\n") > -1) {
                if (array) {
                    str = str
                        .split("\n")
                        .map((line) => {
                        return "  " + line;
                    })
                        .join("\n")
                        .substr(2);
                }
                else {
                    str =
                        "\n" +
                            str
                                .split("\n")
                                .map((line) => {
                                return "   " + line;
                            })
                                .join("\n");
                }
            }
        }
        else {
            str = ctx.stylize("[Circular]", "special");
        }
    }
    if (isUndefined(name)) {
        if (array && key.match(/^\d+$/)) {
            return str;
        }
        name = JSON.stringify("" + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
            name = name.substr(1, name.length - 2);
            name = ctx.stylize(name, "name");
        }
        else {
            name = name
                .replace(/'/g, "\\'")
                .replace(/\\"/g, "\\'")
                .replace(/(^"|"$)/g, "'");
            name = ctx.stylize(name, "string");
        }
    }
    return name + ": " + str;
}
function formatPrimitive(ctx, value) {
    if (isUndefined(value))
        return ctx.stylize("undefined", "undefined");
    if (isString(value)) {
        const simple = "'" + JSON.stringify(value).replace(/^"|"$/g, "").replace(/'/g, "\\'").replace(/\\"/g, "\\'") + "'";
        return ctx.stylize(simple, "string");
    }
    if (isNumber(value))
        return ctx.stylize("" + value, "number");
    if (isBoolean(value))
        return ctx.stylize("" + value, "boolean");
    if (isNull(value))
        return ctx.stylize("null", "null");
}
function reduceToSingleString(output, base, braces) {
    return braces[0] + (base === "" ? "" : base + "\n") + "  " + output.join(",\n  ") + " " + braces[1];
}
function _extend(origin, add) {
    const typedOrigin = { ...origin };
    if (!add || !isObject(add))
        return origin;
    const clonedAdd = { ...add };
    const keys = Object.keys(add);
    let i = keys.length;
    while (i--) {
        typedOrigin[keys[i]] = clonedAdd[keys[i]];
    }
    return typedOrigin;
}
export function formatWithOptions(inspectOptions, ...args) {
    const ctx = {
        seen: [],
        stylize: stylizeNoColor,
    };
    if (inspectOptions != null) {
        _extend(ctx, inspectOptions);
    }
    const first = args[0];
    let a = 0;
    let str = "";
    let join = "";
    if (typeof first === "string") {
        if (args.length === 1) {
            return first;
        }
        let tempStr;
        let lastPos = 0;
        for (let i = 0; i < first.length - 1; i++) {
            if (first.charCodeAt(i) === 37) {
                const nextChar = first.charCodeAt(++i);
                if (a + 1 !== args.length) {
                    switch (nextChar) {
                        case 115: {
                            const tempArg = args[++a];
                            if (typeof tempArg === "number") {
                                tempStr = formatPrimitive(ctx, tempArg);
                            }
                            else if (typeof tempArg === "bigint") {
                                tempStr = formatPrimitive(ctx, tempArg);
                            }
                            else if (typeof tempArg !== "object" || tempArg === null) {
                                tempStr = String(tempArg);
                            }
                            else {
                                tempStr = inspect(tempArg, {
                                    ...inspectOptions,
                                    compact: 3,
                                    colors: false,
                                    depth: 0,
                                });
                            }
                            break;
                        }
                        case 106:
                            tempStr = jsonStringifyRecursive(args[++a]);
                            break;
                        case 100: {
                            const tempNum = args[++a];
                            if (typeof tempNum === "bigint") {
                                tempStr = formatPrimitive(ctx, tempNum);
                            }
                            else if (typeof tempNum === "symbol") {
                                tempStr = "NaN";
                            }
                            else {
                                tempStr = formatPrimitive(ctx, tempNum);
                            }
                            break;
                        }
                        case 79:
                            tempStr = inspect(args[++a], inspectOptions);
                            break;
                        case 111:
                            tempStr = inspect(args[++a], {
                                ...inspectOptions,
                                showHidden: true,
                                showProxy: true,
                                depth: 4,
                            });
                            break;
                        case 105: {
                            const tempInteger = args[++a];
                            if (typeof tempInteger === "bigint") {
                                tempStr = formatPrimitive(ctx, tempInteger);
                            }
                            else if (typeof tempInteger === "symbol") {
                                tempStr = "NaN";
                            }
                            else {
                                tempStr = formatPrimitive(ctx, parseInt(tempStr));
                            }
                            break;
                        }
                        case 102: {
                            const tempFloat = args[++a];
                            if (typeof tempFloat === "symbol") {
                                tempStr = "NaN";
                            }
                            else {
                                tempStr = formatPrimitive(ctx, parseInt(tempFloat));
                            }
                            break;
                        }
                        case 99:
                            a += 1;
                            tempStr = "";
                            break;
                        case 37:
                            str += first.slice(lastPos, i);
                            lastPos = i + 1;
                            continue;
                        default:
                            continue;
                    }
                    if (lastPos !== i - 1) {
                        str += first.slice(lastPos, i - 1);
                    }
                    str += tempStr;
                    lastPos = i + 1;
                }
                else if (nextChar === 37) {
                    str += first.slice(lastPos, i);
                    lastPos = i + 1;
                }
            }
        }
        if (lastPos !== 0) {
            a++;
            join = " ";
            if (lastPos < first.length) {
                str += first.slice(lastPos);
            }
        }
    }
    while (a < args.length) {
        const value = args[a];
        str += join;
        str += typeof value !== "string" ? inspect(value, inspectOptions) : value;
        join = " ";
        a++;
    }
    return str;
}
