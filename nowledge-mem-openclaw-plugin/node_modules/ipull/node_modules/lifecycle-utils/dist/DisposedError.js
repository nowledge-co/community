/**
 * This error is thrown when an object is disposed and a method is called on it.
 * You can use this error to check if an error is caused by a disposed object.
 * You can also use this error to throw when an object is disposed and a method is called on it.
 */
export class DisposedError extends Error {
    constructor() {
        super("Object is disposed");
    }
}
//# sourceMappingURL=DisposedError.js.map