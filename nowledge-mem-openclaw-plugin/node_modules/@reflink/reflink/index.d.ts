/**
 * Create a reflink asynchronously.
 * @param {String} src Source of the reflink.
 * @param {String} dst Target of the reflink.
 * @returns {Promise.<number>}
 */
export function reflinkFile(src: string, dst: string): Promise<number>;
/**
 * Create a reflink asynchronously.
 * @param {String} src Source of the reflink.
 * @param {String} dst Target of the reflink.
 * @returns {number}
 */
export function reflinkFileSync(src: string, dst: string): number;
