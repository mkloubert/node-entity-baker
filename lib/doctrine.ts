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

import * as eb_lib_compiler from './compiler';
import * as eb_lib_helpers from './helpers';
import * as Enumerable from 'node-enumerable';
import * as FSExtra from 'fs-extra';
import * as Path from 'path';


/**
 * Generates a class for Doctrine.
 * 
 * @param {GenerateClassContext} context
 */
export async function generateClassForDoctrine(context: eb_lib_compiler.GenerateClassContext) {
    const ME: eb_lib_compiler.EntityCompiler = this;

    const CLASS_NAME = context.name;
    const PHP_NAMESPACE = context['namespace'].join("\\");
    const TRAIT_NAME = CLASS_NAME;        
    const TRAIT_NAMESPACE = context['namespace'].map(n => n)
                                                .concat([ 'Extensions' ])
                                                .join("\\");

    const PHP_FULL_CLASS_NAME = "\\" + PHP_NAMESPACE + 
                                ('' === PHP_NAMESPACE ? '' : "\\") + 
                                CLASS_NAME;

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

    const IS_JSON = (col: string) => {
        return eb_lib_compiler.TYPE_JSON === eb_lib_helpers.normalizeString(
            context.columns[col].type
        );
    };

    const TO_DOCTRINE_TYPE = (col: string): string => {
        let type = eb_lib_helpers.normalizeString( context.columns[col].type );

        switch (type) {
            case eb_lib_compiler.TYPE_BIGINT:
            case eb_lib_compiler.TYPE_INT64:
                type = 'bigint';
                break;

            case eb_lib_compiler.TYPE_DECIMAL:
                type = 'decimal';
                break;

            case eb_lib_compiler.TYPE_FLOAT:
                type = 'float';
                break;

            case eb_lib_compiler.TYPE_INT:
            case eb_lib_compiler.TYPE_INT32:
            case eb_lib_compiler.TYPE_INTEGER:
                type = 'integer';
                break;

            case eb_lib_compiler.TYPE_INT16:
            case eb_lib_compiler.TYPE_SMALLINT:
                type = 'smallint';
                break;

            case eb_lib_compiler.TYPE_JSON:
                type = 'string';
                break;

            case eb_lib_compiler.TYPE_STR:
            case eb_lib_compiler.TYPE_STRING:
                type = 'string';
                break;

            case eb_lib_compiler.TYPE__DEFAULT:
                type = 'string';
                if (IS_ID(col)) {
                    type = 'integer';
                }
                break;

            default:
                throw new Error(`The data type '${type}' is not supported by Doctrine!`);
        }

        return type;
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

    const XML_FILENAME = `${context.namespace.concat(CLASS_NAME).join('.')}.dcm.xml`;

    let xmlOutDir: string;
    if (context.options.doctrine) {
        xmlOutDir = context.options.doctrine.xmlOutDir;
    }
    if (eb_lib_helpers.isEmptyString(xmlOutDir)) {
        xmlOutDir = context.outDir;
    }
    else {
        if (!Path.isAbsolute(xmlOutDir)) {
            xmlOutDir = Path.join(context.outDir, xmlOutDir);
        }
    }

    const XML_FILE_PATH = Path.resolve(
        Path.join(xmlOutDir,
                  XML_FILENAME)
    );

    classFile += `/**
 * @Entity @Table(name="${dbTable}")
 **/
class ${CLASS_NAME} implements \\ArrayAccess {
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
                \\func_get_args()
            );
        }
    }
`;

    for (const C of context.columnNames) {
        const COLUMN = context.columns[C];

        classFile += `
    /**${IS_ID(C) ? ' @Id' : ''} @Column(type="${TO_DOCTRINE_TYPE(C)}")${IS_AUTO(C) ? ' @GeneratedValue' : ''} **/
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
     * @return ${eb_lib_compiler.getPHPDataType(COLUMN.type)} The value of '${C}'.
     **/
    public function ${GETTER_NAME}() {
        $valueToReturn = $this->${C};
`;

    if (IS_JSON(C)) {
        classFile += `
        if (null !== $valueToReturn) {
            $valueToReturn = \\json_decode($valueToReturn, true);
        }
`;
    }

    classFile += `
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
     * @param ${eb_lib_compiler.getPHPDataType(COLUMN.type)} $newValue The new value.
     * 
     * @return ${PHP_FULL_CLASS_NAME} That instance.
     * 
     * @chainable
     **/
    public function ${SETTER_NAME}($newValue) {
        $oldValue = $this->${C};
`;

            if (IS_JSON(C)) {
                classFile += `
        if (null !== $newValue) {
            $newValue = \\json_encode($newValue);
        }
`;
            }

            classFile += `
        $doSet = true;

        // 'onBeforeSet($columnName, &$newValue)'
        // method in './Extensions/${TRAIT_FILENAME}'?
        if (\\method_exists($this, 'onBeforeSet')) {
            $doSet = FALSE !== $this->onBeforeSet('${C}', $newValue, $this->${C});
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
     * Writes columns and their values to an array (-like object).
     * 
     * @param array|\\ArrayAccess &$target The target where to write the columns to.
     * @param string|callable [$columnFilter] An optional filter for the columns as regular expression or callable function.
     * 
     * @return ${PHP_FULL_CLASS_NAME} That instance.
     * 
     * @chainable
     **/
    public function copy_columns_to(&$target, $columnFilter = null) {
        if (null !== $columnFilter) {
            $columnFilter = (string)$columnFilter;

            if (!\\is_callable($columnFilter)) {
                $r = $columnFilter;

                $columnFilter = function($columnName) use ($r) {
                    return 1 === \\preg_match($r, $columnName);
                };
            }
        }

        if (null === $target) {
            $target = array();
        }

        foreach ($this->get_columns() as $columnName => $columnValue) {
            $writeColumn = true;
            if (null !== $columnFilter) {
                $writeColumn = FALSE !== \\call_user_func_array(
                    $columnFilter,
                    array($columnName, $columnValue)
                );
            }

            if ($writeColumn) {
                $target[ $columnName ] = $columnValue;
            }
        }

        return $this;
    }
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

    // set_columns()
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
    public function set_columns($columnsToSet) {
        $setters = $this->get_setters();

        if ($columnsToSet) {
            foreach ($columnsToSet as $columnName => $newValue) {
                \\call_user_func($setters[ \\trim($columnName) ], 
                                $newValue);
            }
        }

        return $this;
    }`;
        }

    classFile += `

    /** @inheritdoc **/
    public function offsetExists($columnName) {
        return FALSE !== \\array_search(
            \\trim($columnName),
            array(${Object.keys(context.columns).map(k => "'" + k + "'").join(', ')})
        );
    }
    /** @inheritdoc **/
    public function offsetGet($columnName) {
        return $this->get_columns()[ \\trim($columnName) ];
    }
    /** @inheritdoc **/
    public function offsetSet($columnName, $newValue) {
        $this->set_columns(
            array(
                $columnName => $newValue,
            )
        );
    }
    /** @inheritdoc **/
    public function offsetUnset($columnName) {
        $this->set_columns(
            array(
                $columnName => null,
            )
        );
    }
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
        $this->set_columns($columnsToSet);
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

    const COLUMNS_FOR_XML = Enumerable.from( context.columnNames ).orderBy(cn => {
        return IS_ID(cn) ? 0 : 1;
    }).thenBy(cn => {
        return eb_lib_helpers.normalizeString(cn);
    }).toArray();

    let xmlFile = '';
    xmlFile += `<doctrine-mapping xmlns="http://doctrine-project.org/schemas/orm/doctrine-mapping"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xsi:schemaLocation="http://doctrine-project.org/schemas/orm/doctrine-mapping
                  http://raw.github.com/doctrine/doctrine2/master/doctrine-mapping.xsd">
    <entity name="${context.namespace.join('\\')}\\${CLASS_NAME}" table="${dbTable}">
`;

    for (const C of COLUMNS_FOR_XML) {
        const COLUMN = context.columns[C];
        const TYPE = TO_DOCTRINE_TYPE(C);

        if (IS_ID(C)) {
            xmlFile += `
        <id name="${C}" type="${TYPE}"`;

            if (IS_AUTO(C)) {
                xmlFile += `>
            <generator strategy="AUTO" />
        `;

                xmlFile += `</id>`;
            }
            else {
                xmlFile += ` />`;
            }
        }
        else {
            xmlFile += `
        <field name="${C}" type="${TYPE}" />`;
        }
    }

    xmlFile += `

    </entity>
</doctrine-mapping>`;

    await eb_lib_helpers.writeFile(XML_FILE_PATH, xmlFile, 'utf8');
}
