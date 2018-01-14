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

import * as eb_lib_helpers from './helpers';
import * as Enumerable from 'node-enumerable';
import * as FS from 'fs';
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
     * Stored list of column names.
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
export const TYPE_INT = 'int';
export const TYPE_INT32 = 'int32';
export const TYPE_INTEGER = 'integer';
export const TYPE_INT64 = 'int64';
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
                const CLASS_NAME = this.parseForClass(E);
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
                        const COLUMN_NAME = this.parseForClass(C);
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
                        generator = this.generateClassForDoctrine;
                        break;
                    
                    case EntityFramework.EntityFramework:
                        break;

                    case EntityFramework.EntityFrameworkCore:
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

    /**
     * Generates a class for Doctrine.
     * 
     * @param {GenerateClassContext} context
     */
    protected async generateClassForDoctrine(context: GenerateClassContext) {
        const CLASS_NAME = context.name;
        const PHP_NAMESPACE = context['namespace'].join("\\");
        const TRAIT_NAME = CLASS_NAME;        
        const TRAIT_NAMESPACE = context['namespace'].map(n => n)
                                                    .concat([ 'Extensions' ])
                                                    .join("\\");

        const PHP_FULL_CLASS_NAME = "\\" + PHP_NAMESPACE + 
                                    ('' === PHP_NAMESPACE ? '' : "\\") + 
                                    CLASS_NAME;

        const TO_DOCTRINE_TYPE = (type: any): string => {
            type = eb_lib_helpers.normalizeString(type);

            switch (type) {
                case TYPE__DEFAULT:
                case TYPE_STR:
                case TYPE_STRING:
                    type = 'string';
                    break;

                case TYPE_INT:
                case TYPE_INT32:
                case TYPE_INTEGER:
                    type = 'integer';
                    break;

                case TYPE_BIGINT:
                case TYPE_INT64:
                    type = 'bigint';
                    break;

                default:
                    throw new Error(`The data type '${type}' is not supported by Doctrine!`);
            }

            return type;
        };

        const IS_AUTO = (col: string) => {
            return eb_lib_helpers.toBooleanSafe(
                context.columns[col].auto
            );
        };

        const IS_ID = (col: string) => {
            return eb_lib_helpers.toBooleanSafe(
                context.columns[col].id
            );
        };

        let dbTable = eb_lib_helpers.toStringSafe(context.entity.table).trim();
        if ('' === dbTable) {
            dbTable = CLASS_NAME;
        }

        let classFile = '';
        
        classFile += `<?php

/**
 * AUTO GENERATED FILE
 * 
 * Generated by node-entity-baker (https://www.npmjs.com/package/entity-baker)
 **/

`;

        let outDir = context.outDir;

        if (context['namespace'].length > 0) {
            for (const NS of context['namespace']) {
                outDir = Path.join(outDir, NS);
            }

            classFile += `namespace ${PHP_NAMESPACE};

`;
        }

        outDir = Path.resolve(outDir);

        if (!(await eb_lib_helpers.exists(outDir))) {
            await FSExtra.mkdirs(outDir);
        }

        const CLASS_FILENAME = `${CLASS_NAME}.php`;
        const CLASS_FILE_PATH = Path.resolve(
            Path.join(outDir,
                      CLASS_FILENAME)
        );

        const EXTENSIONS_DIR = Path.resolve(
            Path.join(outDir,
                      'Extensions')
        );
        if (!(await eb_lib_helpers.exists(EXTENSIONS_DIR))) {
            await FSExtra.mkdirs(EXTENSIONS_DIR);
        }

        const TRAIT_FILENAME = `${TRAIT_NAME}.php`;
        const TRAIT_FILE_PATH = Path.resolve(
            Path.join(EXTENSIONS_DIR,
                      TRAIT_FILENAME)
        );

        classFile += `/**
 * @Entity @Table(name="${dbTable}")
 **/
class ${CLASS_NAME} {
    /**
     * @see ./Extensions/${TRAIT_FILENAME}
     */
    use Extensions\\${TRAIT_NAME};

    /**
     * Initializes a new instance of the
     * '${PHP_FULL_CLASS_NAME}'
     * class.
     * 
     * @param mixed $arg,... One or more arguments for the object.
     **/
    public function __construct() {
        // check if we have a
        // 'onConstructor()'
        // method in './Extensions/${TRAIT_FILENAME}'
        if (\\method_exists($this, 'onConstructor')) {
            \\call_user_func_array(
                [ $this, 'onConstructor' ],
                \\func_get_args(),
            );
        }
    }
`;

        for (const C of context.columnNames) {
            const COLUMN = context.columns[C];

            classFile += `
    /**${IS_ID(C) ? ' @Id' : ''} @Column(type="${TO_DOCTRINE_TYPE(COLUMN.type)}")${IS_AUTO(C) ? ' @GeneratedValue' : ''} **/
    protected $` + C+ `;`;
        }

        const GETTERS: { [columnName: string]: string } = {};
        const SETTERS: { [columnName: string]: string } = {};
        for (const C of context.columnNames) {
            const COLUMN = context.columns[C];
            const METHOD_SUFFIX = context.methods[C];

            let hasGetter = true;
            let hasSetter = !IS_AUTO(C);

            if (hasGetter || hasSetter) {
                classFile += `
`;                                
            }

            if (hasGetter) {
                const GETTER_NAME = `get${METHOD_SUFFIX}`;
                GETTERS[C] = GETTER_NAME;

                classFile += `
    /**
     * Gets the value of '${C}' column.
     * 
     * @return ${this.getPHPDataType(COLUMN.type)} The value of '${C}'.
     **/
    public function ${GETTER_NAME}() {
        $valueToReturn = $this->${C};

        // check if we have a
        // 'onBeforeGet($columnName, &$valueToReturn)'
        // method in './Extensions/${TRAIT_FILENAME}'
        if (\\method_exists($this, 'onBeforeGet')) {
            $this->onBeforeGet('${C}', $valueToReturn);
        }

        return $valueToReturn;
    }`;
            }
            if (hasSetter) {
                const SETTER_NAME = `set${METHOD_SUFFIX}`;
                SETTERS[C] = SETTER_NAME;

                classFile += `
    /**
     * Sets the value for '${C}' column.
     * 
     * @param ${this.getPHPDataType(COLUMN.type)} $newValue The new value.
     * 
     * @return ${PHP_FULL_CLASS_NAME} That instance.
     * 
     * @chainable
     **/
    public function ${SETTER_NAME}($newValue) {
        $oldValue = $this->${C};

        $doSet = true;

        // 'onBeforeSet($columnName, &$newValue)'
        // method in './Extensions/${TRAIT_FILENAME}'?
        if (\\method_exists($this, 'onBeforeSet')) {
            $doSet = FALSE !== $this->onBeforeSet('${C}', $newValue);
        }        

        if ($doSet) {
            $this->${C} = $newValue;

            // 'onSet($columnName, $newValue, $oldValue)'
            // method in './Extensions/${TRAIT_FILENAME}'?
            if (\\method_exists($this, 'onSet')) {
                $this->onSet('${C}', $newValue, $oldValue);
            }
        }
        
        // 'onSetComplete($columnName, $hasBeenSet, $currentValue, $oldValue, $newValue)'
        // method in './Extensions/${TRAIT_FILENAME}'?
        if (\\method_exists($this, 'onSetComplete')) {
            $this->onSetComplete('${C}', $doSet, $this->${C}, $oldValue, $newValue);
        }        

        return $this;
    }`;                
            }
        }

        classFile += `
`;

        // get_getters()
        {
            classFile += `
    /**
     * Returns all getters as array.
     * 
     * @return callable[] The getters.
     **/
    public function get_getters() {
        return array(`;

            for (const C of context.columnNames) {
                const G = GETTERS[C];
                if (!G) {
                    continue;
                }

                classFile += `
            '${C}' => array($this, '${G}'),`;
            }

            classFile += `
        );
    }`;
        }
        
        // get_setters()
        {
            classFile += `
    /**
     * Returns all setters as array.
     * 
     * @return callable[] The setters.
     **/
    public function get_setters() {
        return array(`;

            for (const C of context.columnNames) {
                const S = SETTERS[C];
                if (!S) {
                    continue;
                }

                classFile += `
            '${C}' => array($this, '${S}'),`;
            }

            classFile += `
        );
    }`;
        }

        classFile += `
`;

        // get_columns()
        {
            classFile += `
    /**
     * Returns columns (and their values) as array.
     * 
     * @return array The columns and their values.
     **/
    public function get_columns() {
        return array(`;

        for (const C in context.columns) {
            const G = GETTERS[C];
            if (!G) {
                continue;
            }

            classFile += `
            '${C}' => $this->${G}(),`;
        }
        
        classFile += `
        );
    }`;
        }

        // set_columns_array()
        {
            classFile += `
    /**
     * Sets one or more column values at onces.
     * 
     * @param array|\\Traversable $columnsToSet The columns to set, by using the keys as column names.
     * 
     * @return ${PHP_FULL_CLASS_NAME} That instance.
     * 
     * @chainable
     **/
    public set_columns_array($columnsToSet) {
        $setters = $this->get_setters();

        if ($columnsToSet) {
            foreach ($columnsToSet as $columnName => $newValue) {
                $setters[ \\trim($columnName) ]( $newValue );
            }
        }

        return $this;
    }`;
        }

        classFile += `
}
`;

        await eb_lib_helpers.writeFile(CLASS_FILE_PATH, classFile, 'utf8');

        if (!(await eb_lib_helpers.exists(TRAIT_FILE_PATH))) {
            let traitFile = '';

            traitFile += `<?php

`;

            traitFile += `namespace ${TRAIT_NAMESPACE};

`;

            traitFile += `/**
 * Extensions for
 * '${PHP_FULL_CLASS_NAME}'
 * class.
 **/
trait ${TRAIT_NAME} {
    /**
     * Optional method for the logic for the constructor of
     * '${PHP_FULL_CLASS_NAME}'
     * class.
     * 
     * This is a default logic. It can be overwritten and can
     * have another number and kind of parameters has shown here.
     */
    protected function onConstructor($columnsToSet = null) {
        $this->set_columns_array($columnsToSet);
    }

    /**
     * An optional method, that is invoked in a getter
     * BEFORE a value is returned.
     * 
     * @param string $columnName The name of the column.
     * @param mixed &$valueToReturn The value to return.
     **/
    protected function onBeforeGet($columnName, &$valueToReturn) {
    }
    
    /**
     * An optional method, that is invoked in a setter
     * BEFORE a value is going to be set / changed.
     * 
     * @param string $columnName The name of the column.
     * @param mixed &$valueToSet The value to set.
     * @param mixed $currentValue The current value.
     * 
     * @return void|false If FALSE, the value will NOT be set.
     **/
    protected function onBeforeSet($columnName, &$valueToSet, $currentValue) {        
    }
    
    /**
     * An optional method, that is invoked in a setter
     * if a column value has been set / changed.
     * 
     * @param string $columnName The name of the column.
     * @param mixed $newValue The new value.
     * @param mixed $oldValue The old value.
     **/
    protected function onSet($columnName, $newValue, $oldValue) {
    }

    /**
     * An optional method, that is invoked in a setter
     * after its operation has been finished.
     * 
     * @param string $columnName The name of the column.
     * @param boolean $hasBeenSet The value has been set / changed or not.
     * @param mixed $currentValue The current column value.
     * @param mixed $oldValue The old value.
     * @param mixed $newValue The current value of $newValue parameter of setter.
     **/
    protected function onSetComplete($columnName, $hasBeenSet, $currentValue, $oldValue, $newValue) {
    }
`;
            
            traitFile += `}
`;

            await eb_lib_helpers.writeFile(TRAIT_FILE_PATH, traitFile, 'utf8');
        }
    }

    /**
     * Returns the PHP type for an entity type.
     * 
     * @param {string} entityType The entity type.
     * 
     * @return {string} The PHP type.
     */
    protected getPHPDataType(entityType: string) {
        switch ( eb_lib_helpers.normalizeString(entityType) ) {
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
    protected parseForClass(val: any): string | false {
        val = eb_lib_helpers.toStringSafe(val).trim();

        if (/^([a-z|A-Z|0-9|_]+)$/i.test(val) &&
            !/^([0-9]+)/i.test(val)) {
            return val;
        }

        return false;
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
