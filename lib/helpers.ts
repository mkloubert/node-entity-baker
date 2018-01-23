/**
 * This file is part of the node-entity-baker distribution.
 * Copyright (c) Marcel Joachim Kloubert.
 * 
 * node-entity-baker is free software: you can redistribute it and/or modify  
 * it under the terms of the GNU Lesser General Public License as   
 * published by the Free Software Foundation, version 3.
 *
 * node-entity-baker is distributed in the hope that it will be useful, but 
 * WITHOUT ANY WARRANTY; without even the implied warranty of 
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU 
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as FS from 'fs';
import * as Glob from 'glob';
const MergeDeep = require('merge-deep');
import * as OS from 'os';


/**
 * Converts an input value to an array.
 * 
 * @param {T|T[]} val The input value.
 * @param {boolean} [removeEmpty] Removes items which are (null) or (undefined).
 * 
 * @return {T[]} The value as array.
 */
export function asArray<T>(val: T | T[], removeEmpty = true): T[] {
    removeEmpty = toBooleanSafe(removeEmpty, true);
    
    if (!Array.isArray(val)) {
        val = [ val ];
    }

    return val.filter(i => {
        if (removeEmpty) {
            return !isNullOrUndefined(i);
        }

        return true;
    });
}

/**
 * Compares two values for sort operations.
 * 
 * @param {T} x The left value.
 * @param {T} y The right value.
 * 
 * @return {number} The comparer value.
 */
export function compareValues<T>(x: T, y: T) {
    return compareValuesBy(x, y,
                           i => i);
}

/**
 * Compares two values for sort operations by using a selector.
 * 
 * @param {T} x The left value.
 * @param {T} y The right value.
 * @param {Function} selector The selector to use.
 * 
 * @return {number} The comparer value.
 */
export function compareValuesBy<T, U>(x: T, y: T, selector: (item: T) => U): number {
    const MAPPED_X = selector(x);
    const MAPPED_Y = selector(y);

    if (MAPPED_X !== MAPPED_Y) {
        if (MAPPED_X < MAPPED_Y) {
            return -1;
        }

        if (MAPPED_X > MAPPED_Y) {
            return 1;
        }
    }

    return 0;
}

/**
 * Removes duplicate entries from an array.
 * 
 * @param {T[]} arr The input array.
 * 
 * @return {T[]} The distincted array.
 */
export function distinctArray<T>(arr: T[]): T[] {
    return distinctArrayBy(arr, i => i);
}

/**
 * Removes duplicate entries from an array by using a selector.
 * 
 * @param {T[]} arr The input array.
 * @param {Function} selector The selector.
 * 
 * @return {T[]} The distincted array.
 */
export function distinctArrayBy<T, U>(arr: T[], selector: (item: T) => U): T[] {
    if (!arr) {
        return arr;
    }

    const MAPPED = arr.map(x => selector(x));
    
    return arr.filter((x, i) => {
        return i === MAPPED.indexOf( selector(x) );
    });
}

/**
 * Promise version of 'Glob()' function.
 * 
 * @param {string} pattern The pattern.
 * @param {Glob.IOptions} [options] Custom options.
 * 
 * @return {Promise<string[]>} The promise with the matches.
 */
export async function glob(pattern: string, options?: Glob.IOptions): Promise<string[]> {
    const DEFAULT_OPTS: Glob.IOptions = {
        absolute: true,
        cwd: process.cwd(),
        dot: true,
        nocase: true,        
        nodir: true,
        nonull: false,
        nosort: true,
        nounique: false,
        root: process.cwd(),
        sync: false,
    };
    
    pattern = toStringSafe(pattern);
    if (isEmptyString(pattern)) {
        pattern = '**';
    }

    return new Promise<string[]>((resolve, reject) => {
        try {
            Glob(pattern, MergeDeep(DEFAULT_OPTS, options), (err, matches) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(matches);
                }
            });
        }
        catch (e) {
            reject(e);
        }
    });
}

/**
 * Promise version of 'FS.exists()' function.
 * 
 * @param {FS.PathLike} path The path.
 * 
 * @return {Promise<Buffer>} The promise that indicates if item exists or not.
 */

export async function exists(path: FS.PathLike): Promise<boolean> {
    if (!Buffer.isBuffer(path)) {
        if (!isObj(path)) {
            path = toStringSafe(path);
        }
    }

    return new Promise<boolean>((resolve, reject) => {
        try {
            FS.exists(path, (exists) => {
                resolve(exists);
            });
        }
        catch (e) {
            reject(e);
        }
    });
}

/**
 * s. 'Glob.sync()'
 * 
 * @param {string} pattern The pattern.
 * @param {Glob.IOptions} [options] Custom options.
 * 
 * @return {string[]} The matches.
 */
export function globSync(pattern: string, options?: Glob.IOptions): string[] {
    const DEFAULT_OPTS: Glob.IOptions = {
        absolute: true,
        cwd: process.cwd(),
        dot: true,
        nocase: true,        
        nodir: true,
        nonull: false,
        nosort: true,
        nounique: false,
        root: process.cwd(),
        sync: true,
    };
    
    pattern = toStringSafe(pattern);
    if (isEmptyString(pattern)) {
        pattern = '**';
    }

    return Glob.sync(pattern,
                     MergeDeep(DEFAULT_OPTS, options));
}

/**
 * Checks if a value is a boolean.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is boolean.
 */
export function isBool(val: any): val is boolean {
    return !isNullOrUndefined(val) &&
           'boolean' === typeof val;
}

/**
 * Checks if the string representation of a value is an empty string
 * or contains whitespaces only.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is empty string or not.
 */
export function isEmptyString(val: any) {
    return '' === toStringSafe(val).trim();
}

/**
 * Checks if a value is a function.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is function.
 */
export function isFunc<TFunc extends Function = Function>(val: any): val is TFunc {
    return !isNullOrUndefined(val) &&
           'function' === typeof val;
}

/**
 * Checks if a value is (null) or (undefined).
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is (null) or (undefined).
 */
export function isNullOrUndefined(val: any): val is (null | undefined) {
    return null === val ||
           'undefined' === typeof val;
}

/**
 * Checks if a value is a number.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is number.
 */
export function isNumber(val: any): val is number {
    return !isNullOrUndefined(val) &&
           'number' === typeof val;
}

/**
 * Checks if a value is an object.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is object.
 */
export function isObj<TObj extends Object = Object>(val: any): val is TObj {
    return !isNullOrUndefined(val) &&
           !Array.isArray(val) &&
           'object' === typeof val;
}

/**
 * Checks if a value is a string.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is string.
 */
export function isString(val: any): val is string {
    return !isNullOrUndefined(val) &&
           'string' === typeof val;
}

/**
 * Checks if a value is a symbol.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is symbol.
 */
export function isSymbol<TSymbol extends Symbol = Symbol>(val: any): val is TSymbol {
    return !isNullOrUndefined(val) &&
           'symbol' === typeof val;
}

/**
 * Pushes a list of items to an array.
 * 
 * @param {T[]} arr The array to push to.
 * @param {T[]} items The items to push.
 */
export function pushMany<T>(arr: T[], items: T[]) {
    if (!items) {
        items = [];
    }
    
    arr.push
       .apply(arr, items);
}

/**
 * Normalizes a value to a string for comparison.
 * 
 * @param {any} val The value to normalize.
 * 
 * @return {string} The normalized value.
 */
export function normalizeString(val: any): string {
    return toStringSafe(val).toLowerCase().trim();
}

/**
 * Promise version of 'FS.readFile()' function.
 * 
 * @param {FS.PathLike|number} path The path or descriptor to the file.
 * 
 * @return {Promise<Buffer>} The promise with the read data.
 */
export async function readFile(path: FS.PathLike | number): Promise<Buffer> {
    if (!Buffer.isBuffer(path)) {
        if (!isObj(path)) {
            if (!isNumber(path)) {
                path = toStringSafe(path);
            }
        }
    }

    return new Promise<Buffer>((resolve, reject) => {
        try {
            FS.readFile(path, (err, data) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        }
        catch (e) {
            reject(e);
        }
    });
}

/**
 * Handles a value as string and replaces all sub strings with another string.
 * 
 * @param {any} val The input value.
 * @param {any} searchFor The value to search for.
 * @param {any} replaceWith The value to replace 'searchFor' with.
 * 
 * @return {string} The new value.
 */
export function replaceAll(val: any, searchFor: any, replaceWith: any): string {
    searchFor = toStringSafe(searchFor);
    replaceWith = toStringSafe(replaceWith);

    if (isNullOrUndefined(val)) {
        return val;
    }

    return toStringSafe(val).split(searchFor)
                            .join(replaceWith);
}

/**
 * Converts a value to a boolean.
 * 
 * @param {any} val The value to convert.
 * @param {any} [defaultValue] The custom default value if 'val' is (null) or (undefined).
 * 
 * @return {boolean} The converted value.
 */
export function toBooleanSafe(val: any, defaultValue: any = false): boolean {
    if (isBool(val)) {
        return val;
    }

    if (isEmptyString(val)) {
        return !!defaultValue;
    }

    switch (normalizeString(val)) {
        case '0':
        case 'false':
        case 'n':
        case 'no':
            return false;

        case '1':
        case 'true':
        case 'y':
        case 'yes':
            return true;
    }

    return !!val;
}

/**
 * Converts a value to a string.
 * 
 * @param {any} val The value to convert.
 * @param {any} [defaultValue] The custom default value if 'val' is (null) or (undefined).
 * 
 * @return {string} The converted value.
 */
export function toStringSafe(val: any, defaultValue: any = ''): string {
    if (isString(val)) {
        return val;
    }

    try {
        if (isNullOrUndefined(val)) {
            return '' + defaultValue;
        }
    
        if (val instanceof Error) {
            return '' + val.message;
        }

        if (isFunc(val['toString'])) {
            return '' + val.toString();
        }

        return '' + val;
    }
    catch (e) {
        // console.debug(e);
    }

    return '';
}

/**
 * Writes a message to a stream.
 * 
 * @param {any} msg The message to write.
 * @param {NodeJS.WritableStream} [stream] The custom output stream. Default: stdout
 */
export function write(msg: any, stream?: NodeJS.WritableStream) {
    if (arguments.length < 2) {
        stream = process.stdout;
    }

    if (!Buffer.isBuffer(msg)) {
        msg = toStringSafe(msg);
    }

    if (msg.length > 0) {
        stream.write(msg);
    }
}

/**
 * Writes a message to stderr.
 * 
 * @param {any} msg The message to write.
 */
export function write_err(msg: any) {
    write(msg, process.stderr);
}

/**
 * Writes an optional message to stderr and appends a new line.
 * 
 * @param {any} [msg] The message to write.
 */
export function write_err_ln(msg?: any) {
    write_ln(msg, process.stderr);
}

/**
 * Writes an optional message to a stream and appends a new line.
 * 
 * @param {any} [msg] The message to write.
 * @param {NodeJS.WritableStream} [stream] The custom output stream. Default: stdout
 */
export function write_ln(msg?: any, stream?: NodeJS.WritableStream) {
    if (arguments.length < 2) {
        stream = process.stdout;
    }

    if (Buffer.isBuffer(msg)) {
        msg = Buffer.concat([
            msg,
            new Buffer(OS.EOL, 'binary')
        ]);
    }
    else {
        msg = toStringSafe(msg) + OS.EOL;
    }

    write(msg, stream);
}

/**
 * Promise version of 'FS.writeFile()' function.
 * 
 * @param {FS.PathLike|number} path The path or descriptor to the file.
 * @param {any} data The data to write.
 * @param {string} [encoding] The encoding to use.
 * 
 * @return {Promise<Buffer>} The promise with the read data.
 */
export async function writeFile(path: FS.PathLike | number, data: any, encoding?: string): Promise<void> {
    if (!Buffer.isBuffer(path)) {
        if (!isObj(path)) {
            if (!isNumber(path)) {
                path = toStringSafe(path);
            }
        }
    }

    if (isNullOrUndefined(encoding)) {
        encoding = undefined;
    }
    else {
        encoding = normalizeString(encoding);
    }

    if (isNullOrUndefined(data)) {
        data = Buffer.alloc(0);
    }
    if (!Buffer.isBuffer(data)) {
        if (encoding) {
            data = new Buffer(toStringSafe(data), encoding);
        }
        else {
            data = new Buffer(toStringSafe(data));
        }
    }

    return new Promise<void>((resolve, reject) => {
        try {
            FS.writeFile(path, data, encoding, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        }
        catch (e) {
            reject(e);
        }
    });
}