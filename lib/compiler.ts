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

import * as eb_lib_doctrine from './doctrine';
import * as eb_lib_ef from './ef';
import * as eb_lib_ef_core from './efcore';
import * as eb_lib_helpers from './helpers';
import * as Enumerable from 'node-enumerable';
import * as FSExtra from 'fs-extra';
import * as Path from 'path';


/**
 * Stores compiler callbacks.
 */
export interface CompilerCallbacks {
    /**
     * Is invoked before a class is being generated.
     * 
     * @param {string} className The name of the class.
     * @param {EntityFramework} target The target framework.
     */
    readonly onBeforeGenerateClass?: (className: string, target: EntityFramework) => void | PromiseLike<void>;
    
    /**
     * Is invoked after a class has been generated.
     * 
     * @param {any} err The error (if occurred).
     * @param {string} className The name of the class.
     * @param {EntityFramework} target The target framework.
     */
    readonly onClassGenerated?: (err: any, className: string, target: EntityFramework) => void | PromiseLike<void>;
}

/**
 * Settings / description of an entity (class).
 */
export interface EntityClass {
    /**
     * Table columns.
     */
    readonly columns?: EntityColumnDescriptions;
    /**
     * The (custom) name of the underlying name.
     */
    readonly table?: string;
}

/**
 * Stores method names for columns.
 */
export type EntityClassMethodNames = { [columnName: string]: string };

/**
 * Describes an entity column.
 */
export interface EntityColumn {
    /**
     * Is auto generated value or not.
     */
    readonly auto?: boolean;
    /**
     * Is ID value or not.
     */
    readonly id?: boolean;
    /**
     * Can be (null) or not.
     */
    readonly 'null'?: boolean;
    /**
     * The data type.
     */
    readonly type?: string;
}

/**
 * An entity column description entry.
 */
export type EntityColumnDescriptionEntry = string | EntityColumn;

/**
 * Entity column descriptions.
 */
export type EntityColumnDescriptions = { [columnName: string]: EntityColumnDescriptionEntry };

/**
 * A storage of entity columns.
 */
export type EntityColumnStorage = { [columnName: string]: EntityColumn };

/**
 * Options for an entity compiler.
 */
export interface EntityCompilerOptions {
    /**
     * Callbacks
     */
    readonly callbacks?: CompilerCallbacks;
    /**
     * The custom working directory.
     */
    readonly cwd?: string;
    /**
     * Special options for Doctrine.
     */
    readonly doctrine?: {
        /**
         *The directory where to store the XML files.
         */        
        readonly xmlOutDir?: string;
    };
    /**
     * The file with the entity descriptions.
     */
    readonly file?: EntityFile;
    /**
     * The output directory.
     */
    readonly outDir?: string;
    /**
     * The target framework / system.
     */
    readonly target: EntityFramework;
}

/**
 * Result of a compile operation of an entity compiler.
 */
export interface EntityCompilerResult {
}

/**
 * Entity descriptions.
 */
export type EntityDescriptions = { [className: string]: EntityClass };

/**
 * An entity file.
 */
export interface EntityFile {
    /**
     * Entity descriptions.
     */
    readonly entities?: EntityDescriptions;
    /**
     * The namespace for the classes to use.
     */
    readonly 'namespace'?: string;
}

/**
 * List of known frameworks.
 */
export enum EntityFramework {
    /**
     * Doctrine (PHP)
     */
    Doctrine = 1,
    /**
     * Microsoft's Entity Framework
     */
    EntityFramework = 2,
    /**
     * Microsoft's Entity Framework Core
     */
    EntityFrameworkCore = 3,
}

/**
 * Context for generating a class.
 */
export interface GenerateClassContext {
    /**
     * Sorted list of column names.
     */
    readonly columnNames: string[];
    /**
     * The columns.
     */
    readonly columns: EntityColumnStorage;
    /**
     * The entity / class description.
     */
    readonly entity: EntityClass;
    /**
     * Method names.
     */
    readonly methods: EntityClassMethodNames;
    /**
     * The class name.
     */
    readonly name: string;
    /**
     * The namespace.
     */
    readonly 'namespace': string[];
    /**
     * Compiler options.
     */
    readonly options: EntityCompilerOptions;
    /**
     * The output directory.
     */
    readonly outDir: string;
}


/**
 * The default name of an entity file.
 */
export const DEFAULT_ENTITY_FILE = 'entities.json';

// data types
export const TYPE__DEFAULT = '';
export const TYPE_BIGINT = 'bigint';
export const TYPE_FLOAT = 'float';
export const TYPE_DECIMAL = 'decimal';
export const TYPE_INT = 'int';
export const TYPE_INT16 = 'int16';
export const TYPE_INT32 = 'int32';
export const TYPE_INTEGER = 'integer';
export const TYPE_INT64 = 'int64';
export const TYPE_JSON = 'json';
export const TYPE_SMALLINT = 'smallint';
export const TYPE_STR = 'str';
export const TYPE_STRING = 'string';

/**
 * An entity compiler.
 */
export class EntityCompiler {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {EntityCompilerOptions} [options] Options for compilation operations.
     */
    constructor(public readonly options?: EntityCompilerOptions) {
        if (!this.options) {
            this.options = <any>{};
        }
    }

    /**
     * Compiles entities.
     * 
     * @return {Promise<EntityCompilerResult>} The promise with the result.
     */
    public async compile(): Promise<EntityCompilerResult> {
        const RESULT: EntityCompilerResult = {};

        let cwd = eb_lib_helpers.toStringSafe(this.options.cwd);
        if (eb_lib_helpers.isEmptyString(cwd)) {
            cwd = process.cwd();
        }
        if (!Path.isAbsolute(cwd)) {
            cwd = Path.join(process.cwd(), cwd);
        }
        cwd = Path.resolve(cwd);

        let outDir = eb_lib_helpers.toStringSafe(this.options.outDir);
        if (eb_lib_helpers.isEmptyString(cwd)) {
            outDir = cwd;
        }
        if (!Path.isAbsolute(outDir)) {
            outDir = Path.join(cwd, outDir);
        }
        outDir = Path.resolve(outDir);

        const FILE = this.options.file;
        if (eb_lib_helpers.isObj<EntityFile>(FILE)) {
            const NAMESPACE = eb_lib_helpers.toStringSafe(FILE['namespace']).split('.').map(x => {
                return x.trim();
            }).filter(x => {
                return '' !== x;
            });

            const ENTITIES = FILE.entities;
            if (eb_lib_helpers.isObj<EntityDescriptions>(ENTITIES)) {
                let callbacks = this.options.callbacks;
                if (!callbacks) {
                    callbacks = <any>{};
                }

                await this.compileEntities(
                    NAMESPACE,
                    ENTITIES,
                    callbacks,
                    outDir,
                );
            }
        }

        return RESULT;
    }

    /**
     * Compiles entities.
     * 
     * @param {string[]} ns The namespace without dots.
     * @param {EntityDescriptions} entities The entities.
     * @param {CompilerCallbacks} callbacks Callbacks.
     * @param {string} outDir The output directory.
     */
    protected async compileEntities(
        ns: string[],
        entities: EntityDescriptions,
        callbacks: CompilerCallbacks,
        outDir: string,
    ) {
        for (const E in entities) {
            if (callbacks.onBeforeGenerateClass) {
                await Promise.resolve(
                    callbacks.onBeforeGenerateClass(E, this.options.target)
                );
            }

            let err: any;
            try {
                const CLASS_NAME = parseForClass(E);
                if (false === CLASS_NAME) {
                    throw new Error(`The class name '${E}' is invalid!`);
                }
    
                const ENTITY_CLASS = entities[E];
                if (!eb_lib_helpers.isObj<EntityClass>(ENTITY_CLASS)) {
                    continue;
                }

                const COLUMNS: EntityColumnStorage = {};
                if (eb_lib_helpers.isObj<EntityColumnDescriptions>(ENTITY_CLASS.columns)) {
                    for (const C in ENTITY_CLASS.columns) {
                        const COLUMN_NAME = parseForClass(C);
                        if (false === COLUMN_NAME) {
                            throw new Error(`The column name '${C}' is invalid!`);
                        }

                        if (eb_lib_helpers.isObj<EntityColumn>(COLUMNS[ COLUMN_NAME ])) {
                            throw new Error(`The column '${COLUMN_NAME}' has already been defined!`);
                        }

                        let colEntry = ENTITY_CLASS.columns[C];
                        if (!eb_lib_helpers.isObj<EntityColumn>(colEntry)) {
                            colEntry = {
                                type: eb_lib_helpers.normalizeString(colEntry),
                            };
                        }

                        COLUMNS[ COLUMN_NAME ] = colEntry;
                    }
                }

                const METHODS: EntityClassMethodNames = {};
                for (const C in COLUMNS) {
                    let wordsOfColumn = eb_lib_helpers.replaceAll(C, '_', ' ');
                    wordsOfColumn = eb_lib_helpers.replaceAll(C, '-', ' ');
                    wordsOfColumn = eb_lib_helpers.replaceAll(C, "\t", '    ');

                    const WORDS = Enumerable.from( wordsOfColumn.split(' ') ).select(w => {
                        return w.trim();
                    }).where(w => {
                        return '' !== w;
                    }).select(w => {
                        return w[0].toUpperCase() + w.substr(1).trim();
                    }).toArray();

                    METHODS[C] = WORDS.join('');
                }

                let generator: (context: GenerateClassContext) => void | PromiseLike<void>;
                let generatorThisArg: any = this;

                const TARGET = this.options.target;
                switch (TARGET) {
                    case EntityFramework.Doctrine:
                        generator = eb_lib_doctrine.generateClassForDoctrine;
                        break;
                    
                    case EntityFramework.EntityFramework:
                        generator = eb_lib_ef.generateClassForEntityFramework;
                        break;

                    case EntityFramework.EntityFrameworkCore:
                        generator = eb_lib_ef_core.generateClassForEntityFrameworkCore;
                        break;
                }

                if (!generator) {
                    throw new Error(`Target ${eb_lib_helpers.toStringSafe(TARGET)} is not supported!`);
                }

                const CTX: GenerateClassContext = {
                    columnNames: Object.keys(COLUMNS).sort((x, y) => {
                        return eb_lib_helpers.compareValuesBy(x, y, c => {
                            return eb_lib_helpers.normalizeString(c);
                        });
                    }),
                    columns: COLUMNS,
                    entity: ENTITY_CLASS,
                    methods: METHODS,
                    name: CLASS_NAME,
                    'namespace': ns,
                    options: this.options,
                    outDir: outDir,
                };

                await Promise.resolve(
                    generator.apply(generatorThisArg,
                                    [ CTX ])
                );
            }
            catch (e) {
                err = e;
            }
            finally {
                if (callbacks.onClassGenerated) {
                    await Promise.resolve(
                        callbacks.onClassGenerated(err, E, this.options.target)
                    );
                }
            }
        }
    }
}


/**
 * Compiles entities.
 * 
 * @param {EntityCompilerOptions} [opts] Options for the operation.
 * 
 * @return {Promise<EntityCompilerResult>} The promise with the result.
 */
export async function compile(opts?: EntityCompilerOptions) {
    const COMPILER = new EntityCompiler(opts);

    return await COMPILER.compile();
}

/**
 * Returns the PHP type for an entity type.
 * 
 * @param {string} entityType The entity type.
 * 
 * @return {string} The PHP type.
 */
export function getPHPDataType(entityType: string) {
    switch (eb_lib_helpers.normalizeString(entityType)) {
        case TYPE__DEFAULT:
        case TYPE_STR:
        case TYPE_STRING:
            return 'string';

        case TYPE_BIGINT:
        case TYPE_INT:
        case TYPE_INT32:
        case TYPE_INT64:
        case TYPE_INTEGER:
            return 'integer';

        default:
            return 'mixed';
    }
}

/**
 * Parses a value for a class or for use in a class.
 * 
 * @param {any} val The input value.
 * 
 * @return {string|false} The parsed name or (false) if invalid.
 */
export function parseForClass(val: any): string | false {
    val = eb_lib_helpers.toStringSafe(val).trim();

    if (/^([a-z|A-Z|0-9|_]+)$/i.test(val) &&
        !/^([0-9]+)/i.test(val)) {
        return val;
    }

    return false;
}

/**
 * Converts a data type from a entity file to a CLR type.
 * 
 * @param {string} type The entity type.
 * @param {Function} canBeNull The function that provides if value can be (null) or not.
 * @param {Function} isID The function that provides if value is an ID value or not.
 * 
 * @return {string} The CLR type.
 */
export function toClrType
(
    type: string,
    canBeNull: () => boolean,
    isID: () => boolean
)
{
    type = eb_lib_helpers.normalizeString(type);
    switch (type) {
        case TYPE_BIGINT:
        case TYPE_INT64:
            type = 'long';
            break;

        case TYPE_DECIMAL:
            type = 'decimal';
            break;

        case TYPE_FLOAT:
            type = 'float';
            break;

        case TYPE_INT:
        case TYPE_INT32:
        case TYPE_INTEGER:
            type = 'int';
            break;

        case TYPE_INT16:
        case TYPE_SMALLINT:
            type = 'short';
            break;

        case TYPE_JSON:
            type = 'dynamic';
            break;

        case TYPE_STR:
        case TYPE_STRING:
            type = 'string';
            break;

        case TYPE__DEFAULT:
            type = 'string';
            if (isID()) {
                type = 'int';
            }
            break;

        default:
            throw new Error(`The data type '${type}' is not supported by CLR!`);
    }

    if (canBeNull()) {
        switch (type) {
            case 'decimal':
            case 'float':
            case 'int':
            case 'long':
            case 'short':
                type += '?';
                break;
        }
    }

    return type;
}
