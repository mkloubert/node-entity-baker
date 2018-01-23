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
import * as FSExtra from 'fs-extra';
import * as Path from 'path';


/**
 * Generates a class for Microsoft's Entity Framework.
 * 
 * @param {GenerateClassContext} context
 */
export async function generateClassForEntityFramework(context: eb_lib_compiler.GenerateClassContext) {
    const CLASS_NAME = context.name;

    let dbTable = eb_lib_helpers.toStringSafe(context.entity.table).trim();
    if ('' === dbTable) {
        dbTable = CLASS_NAME;
    }

    let outDir = context.outDir;

    if (context['namespace'].length > 0) {
        for (const NS of context['namespace']) {
            outDir = Path.join(outDir, NS);
        }
    }

    outDir = Path.resolve(outDir);

    if (!(await eb_lib_helpers.exists(outDir))) {
        await FSExtra.mkdirs(outDir);
    }

    const CLASS_FILENAME = `${CLASS_NAME}.cs`;
    const CLASS_FILE_PATH = Path.resolve(
        Path.join(outDir,
                  CLASS_FILENAME)
    );

    const EXTENSIONS_FILENAME = `${CLASS_NAME}.Extensions.cs`;
    const EXTENSIONS_FILE_PATH = Path.resolve(
        Path.join(outDir,
                  EXTENSIONS_FILENAME)
    );

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

    const CAN_BE_NULL = (col: string) => {
        return eb_lib_helpers.toBooleanSafe(
            context.columns[col]['null']
        );
    };

    const TO_EF_TYPE = (col: string): string => {
        let type = eb_lib_helpers.normalizeString( context.columns[col].type );

        switch (type) {
            case eb_lib_compiler.TYPE_STR:
            case eb_lib_compiler.TYPE_STRING:
                type = 'string';
                break;

            case eb_lib_compiler.TYPE_INT:
            case eb_lib_compiler.TYPE_INT32:
            case eb_lib_compiler.TYPE_INTEGER:
                type = 'int';
                break;

            case eb_lib_compiler.TYPE_JSON:
                type = 'dynamic';
                break;

            case eb_lib_compiler.TYPE_BIGINT:
            case eb_lib_compiler.TYPE_INT64:
                type = 'long';
                break;

            case eb_lib_compiler.TYPE__DEFAULT:
                type = 'string';
                if (IS_ID(col)) {
                    type = 'int';
                }
                break;

            default:
                throw new Error(`The data type '${type}' is not supported by Entity Framework!`);
        }

        if (CAN_BE_NULL(col)) {
            switch (type) {
                case 'int':
                case 'long':
                    type += '?';
                    break;
            }
        }

        return type;
    };

    let classFile = `using System.Linq;

`;

    if (context['namespace'].length > 0) {
        classFile += `namespace ${context['namespace'].join('.')}
{
`;
    }

    classFile += `        /// <summary>
    /// An enity for '${dbTable}' table.
    /// </summary>
    [global::System.Runtime.Serialization.DataContract]
    [global::System.Data.Linq.Mapping.Table(Name = "${dbTable}")]
    [global::System.Serializable]
    public partial class ${CLASS_NAME} : global::System.MarshalByRefObject, global::System.ComponentModel.INotifyPropertyChanged, global::System.ComponentModel.INotifyPropertyChanging
    {
        
        #region CLASS: _Helpers

        private static class _Helpers
        {
            internal static T ConvertTo<T>(object obj)
            {
                if (null != obj)
                {
                    if (!(obj is T))
                    {
                        return (T)global::System.Convert.ChangeType(obj, typeof(T));
                    }

                    return (T)obj;
                }

                return default(T);
            }

            internal static object[] PrepareMethodArgs(global::System.Reflection.MethodInfo method, global::System.Collections.IEnumerable args)
            {
                if (null != args)
                {
                    var p = method.GetParameters();

                    return args.Cast<object>()
                               .Take(p.Length)
                               .ToArray();
                }

                return null;
            }
        }

        #endregion

`;

    classFile += `
        #region Columns`;
    for (const C of context.columnNames) {
        const CLR_TYPE = TO_EF_TYPE(C);
        const FIELD_NAME = `_${C}`;

        classFile += `

        /// <summary>
        /// Stores value of '${C}' column.
        /// </summary>
        protected ${CLR_TYPE} ${FIELD_NAME};`;
    }
    classFile += `

        #endregion
`;    

    classFile += `
        #region Events        

        /// <inheritdoc />
        public virtual event global::System.ComponentModel.PropertyChangedEventHandler PropertyChanged;

        /// <inheritdoc />
        public virtual event global::System.ComponentModel.PropertyChangingEventHandler PropertyChanging;

        #endregion
`;    

    classFile += `
        #region Columns
`;

    const GETTERS: { [columnName: string]: string } = {};
    const SETTERS: { [columnName: string]: string } = {};
    for (const C of context.columnNames) {
        const CLR_TYPE = TO_EF_TYPE(C);
        const COLUMN = context.columns[C];
        const FIELD_NAME = `_${C}`;
        const PROPERTY_NAME = context.methods[C];

        let hasGetter = true;
        let hasSetter = !IS_AUTO(C);
        if (!hasGetter && !hasSetter) {
            continue;
        }
        
        classFile += `
        [global::System.Runtime.Serialization.DataMember(EmitDefaultValue = true, Name = "${C}")]
        public ${CLR_TYPE} ${PROPERTY_NAME}
        {`;

        if (hasGetter) {
            GETTERS[C] = PROPERTY_NAME;

            classFile += `
            get
            {
                var valueToReturn = ${FIELD_NAME};
                
                // '_OnBeforeGet(string column, ref object valueToReturn)'
                // method in './User.Extensions.cs'?
                var onBeforeGet = GetType().GetMethod("_OnBeforeGet",
                                                      global::System.Reflection.BindingFlags.Public | global::System.Reflection.BindingFlags.NonPublic | global::System.Reflection.BindingFlags.Instance);
                if (null != onBeforeGet)
                {
                    var args = _Helpers.PrepareMethodArgs(onBeforeGet,
                                                          new object[] { "${C}", valueToReturn });

                    onBeforeGet.Invoke(this, args);

                    if (args.Length > 1)
                    {
                        valueToReturn = _Helpers.ConvertTo<${CLR_TYPE}>(args[1]);
                    }
                }

                return valueToReturn;
            }`;
        }
        
        if (hasSetter) {
            SETTERS[C] = PROPERTY_NAME;

            classFile += `
            set
            {
                var oldValue = this.${FIELD_NAME};
                var valueToSet = value;

                var doSet = true;

                this.PropertyChanging?.Invoke(this,
                                              new global::System.ComponentModel.PropertyChangingEventArgs("${PROPERTY_NAME}"));

                // '_OnBeforeSet(string column, ref object valueToSet)'
                // method in './${EXTENSIONS_FILENAME}'?
                var onBeforeSet = this.GetType().GetMethod("_OnBeforeSet",
                                                           global::System.Reflection.BindingFlags.Public | global::System.Reflection.BindingFlags.NonPublic | global::System.Reflection.BindingFlags.Instance);
                if (null != onBeforeSet)
                {
                    var args = _Helpers.PrepareMethodArgs(onBeforeSet,
                                                          new object[] { "${C}", valueToSet });

                    doSet = !object.Equals(onBeforeSet.Invoke(this, args),
                                           false);

                    if (args.Length > 1)
                    {
                        valueToSet = _Helpers.ConvertTo<${CLR_TYPE}>(args[1]);
                    }
                }

                if (doSet)
                {
                    this.${FIELD_NAME} = valueToSet;

                    if (!object.Equals(oldValue, valueToSet))
                    {
                        this.PropertyChanged?.Invoke(this,
                                                     new global::System.ComponentModel.PropertyChangedEventArgs("${PROPERTY_NAME}"));

                    }

                    // '_OnSet(string column, object newValue, object oldValue)'
                    // method in './${EXTENSIONS_FILENAME}'?                        
                    var onSet = this.GetType().GetMethod("_OnSet",
                                                         global::System.Reflection.BindingFlags.Public | global::System.Reflection.BindingFlags.NonPublic | global::System.Reflection.BindingFlags.Instance);
                    if (null != onSet)
                    {
                        var args = _Helpers.PrepareMethodArgs(onSet,
                                                              new object[] { "${C}", valueToSet, oldValue });

                        onSet.Invoke(this, args);
                    }
                }

                // '_OnSetComplete(string column, bool hasBeenSet, object currentValue, object oldValue, object newValue)'
                // method in './${EXTENSIONS_FILENAME}'?                        
                var onSetComplete = this.GetType().GetMethod("_OnSetComplete",
                                                             global::System.Reflection.BindingFlags.Public | global::System.Reflection.BindingFlags.NonPublic | global::System.Reflection.BindingFlags.Instance);
                if (null != onSetComplete)
                {
                    var args = _Helpers.PrepareMethodArgs(onSetComplete,
                                                          new object[] { "${C}", doSet, this.${FIELD_NAME}, oldValue, valueToSet });

                    onSetComplete.Invoke(this, args);
                }
            }`;            
        }
        
        classFile += `
        }
`;
    }
    classFile += `
        #endregion
`;
    
    classFile += `
        #region Methods
`;

    // Copy_Columns_To()
    classFile += `
        /// <summary>
        /// Writes columns to a dictionary.
        /// </summary>
        /// <param name="target">The dictionary where to write the values to.</param>
        /// <param name="filter">The optional filter to use.</param>
        /// <returns>That instance.</returns>
        public ${CLASS_NAME} Copy_Columns_To(global::System.Collections.Generic.IDictionary<string, object> target, global::System.Func<string, object, bool> filter = null)
        {
            var columns = this.Get_Columns();

            if (null == filter)
            {
                filter = delegate { return true; };
            }

            if (null != target)
            {
                using (var e = target.GetEnumerator())
                {
                    while (e.MoveNext())
                    {
                        var entry = e.Current;

                        if (filter(entry.Key, entry.Value))
                        {
                            target[entry.Key] = entry.Value;
                        }                        
                    }
                }
            }

            return this;
        }

        /// <summary>
        /// Writes columns to a dictionary.
        /// </summary>
        /// <param name="target">The dictionary where to write the values to.</param>
        /// <param name="pattern">The regular expression to use.</param>
        /// <returns>That instance.</returns>
        public ${CLASS_NAME} Copy_Columns_To(global::System.Collections.Generic.IDictionary<string, object> target, string pattern)
        {
            return this.Copy_Columns_To(
                target,
                new global::System.Text.RegularExpressions.Regex(pattern, global::System.Text.RegularExpressions.RegexOptions.IgnoreCase)
            );
        }

        /// <summary>
        /// Writes columns to a dictionary.
        /// </summary>
        /// <param name="target">The dictionary where to write the values to.</param>
        /// <param name="regex">The regular expression to use.</param>
        /// <returns>That instance.</returns>
        public ${CLASS_NAME} Copy_Columns_To(global::System.Collections.Generic.IDictionary<string, object> target, global::System.Text.RegularExpressions.Regex regex)
        {
            return this.Copy_Columns_To(
                target,
                (columnName, columnValue) => regex.IsMatch(columnName)
            );
        }
`;

    // Get_Columns()
    classFile += `
        /// <summary>
        /// Returns all columns with their values.
        /// </summary>
        /// <returns>The columns and their values.</returns>
        public global::System.Collections.Generic.IDictionary<string, object> Get_Columns()
        {
            return new global::System.Collections.Generic.Dictionary<string, object>()
            {`;
    for (const C in context.columns)
    {
        const G = GETTERS[C];
        if (!G) {
            continue;
        }

        classFile += `
                { "${C}", this.${G} },`;
    }

    classFile += `
            };
        }
`;

    // Get_Getters()
    classFile += `
        /// <summary>
        /// Returns all getters a dictionary.
        /// </summary>
        /// <returns>The getters.</returns>
        public global::System.Collections.Generic.IDictionary<string, global::System.Func<object>> Get_Getters()
        {
            return new global::System.Collections.Generic.Dictionary<string, global::System.Func<object>>()
            {`;
    for (const C in context.columns)
    {
        const G = GETTERS[C];
        if (!G) {
            continue;
        }

        classFile += `
                { "${C}", () => this.${G} },`;
    }

    classFile += `
            };
        }
`;

    // Get_Setters()
    classFile += `
        /// <summary>
        /// Returns all setters a dictionary.
        /// </summary>
        /// <returns>The setters.</returns>
        public global::System.Collections.Generic.IDictionary<string, global::System.Func<object, ${CLASS_NAME}>> Get_Setters()
        {
            return new global::System.Collections.Generic.Dictionary<string, global::System.Func<object, ${CLASS_NAME}>>()
            {`;
    for (const C in context.columns)
    {
        const S = SETTERS[C];
        if (!S) {
            continue;
        }

        const CLR_TYPE = TO_EF_TYPE(C);

        classFile += `
                { "${C}", (v) => { this.${S} = _Helpers.ConvertTo<${CLR_TYPE}>(v); return this; } },`;
    }

    classFile += `
            };
        }
`;

    // Set_Columns()
    classFile += `
        /// <summary>
        /// Sets a list of columns with new values.
        /// </summary>
        /// <param name="columns">The columns with values.</param>
        /// <returns>That instance.</returns>
        public ${CLASS_NAME} Set_Columns(global::System.Collections.Generic.IEnumerable<global::System.Collections.Generic.KeyValuePair<string, object>> columns)
        {
            var allSetters = this.Get_Setters();

            using (var e = columns?.GetEnumerator())
            {
                while (true == e?.MoveNext())
                {
                    var columnWithValue = e.Current;

                    allSetters[columnWithValue.Key.Trim()](
                        columnWithValue.Value
                    );
                }
            }

            return this;
        }
`;

    classFile += `
        #endregion
`;

    classFile += `
        #region Properties

        /// <summary>
        /// Gets or sets a column value directly via that object.
        /// </summary>
        /// <param name="columnName">The name of the column.</param>
        public object this[string columnName]
        {
            get
            {
                return this.Get_Columns()[columnName.Trim()];
            }
            set
            {
                this.Set_Columns(
                    new global::System.Collections.Generic.Dictionary<string, object>()
                    {
                        { columnName, value }
                    }
                );
            }
        }

        #endregion
`;

    classFile += `
    }`;
    
    if (context['namespace'].length > 0) {
        classFile += `
}`;
    }

    await eb_lib_helpers.writeFile(CLASS_FILE_PATH, classFile, 'utf8');

    if (!(await eb_lib_helpers.exists(EXTENSIONS_FILE_PATH))) {
        let extensionsFile = '';

        if (context['namespace'].length > 0) {
            extensionsFile += `namespace ${context['namespace'].join('.')}
{
`;
        }

        extensionsFile += `    partial class ${CLASS_NAME}
    {

        #region Constructors

        /// <summary>
        /// Default logic to initialize a new instance of the <see cref="${CLASS_NAME}" /> class.        
        /// </summary>
        /// <param name="initialValues">The initial column values.</param>
        public ${CLASS_NAME}(global::System.Collections.Generic.IEnumerable<global::System.Collections.Generic.KeyValuePair<string, object>> initialValues = null)
        {
            this.Set_Columns(initialValues);
        }

        #endregion

        #region Getter and setter event methods

        /// <summary>
        /// Optional method that is invoked BEFORE a column value is
        /// returned in the underlying getter.
        /// </summary>
        /// <param name="column">The name of the column.</param>
        /// <param name="valueToReturn">The value to return in the getter. Can be overwritten.</param>
        protected virtual void _OnBeforeGet(string column, ref object valueToReturn)
        {
        }

        /// <summary>
        /// Optional method that is invoked BEFORE a column value is
        /// updated in the underlying setter.
        /// </summary>
        /// <param name="column">The name of the column.</param>
        /// <param name="valueToSet">The value to set. Can be overwritten.</param>
        /// <returns><c>false</c> if value should NOT be updated.</returns>
        protected virtual bool _OnBeforeSet(string column, ref object valueToSet)
        {
            return true;
        }

        /// <summary>
        /// Optional method that is invoked AFTER a column value has been updated
        /// in the underlying setter.
        /// </summary>
        /// <param name="column">The name of the column.</param>
        /// <param name="newValue">The new value.</param>
        /// <param name="oldValue">The old value.</param>
        protected virtual void _OnSet(string column, object newValue, object oldValue)
        {
        }

        /// <summary>
        /// An optional logic that is invoked AFTER setter of a column has
        /// been invoked.
        /// </summary>
        /// <param name="column">The name of the column.</param>
        /// <param name="hasBeenSet">Value has been updated or not.</param>
        /// <param name="currentValue">The current value.</param>
        /// <param name="oldValue">The old value.</param>
        /// <param name="newValue">The current value of 'value' parameter of setter.</param>
        protected virtual void _OnSetComplete(string column, bool hasBeenSet, object currentValue, object oldValue, object newValue)
        {
        }

        #endregion

    }`;

        if (context['namespace'].length > 0) {
            extensionsFile += `
}`;
        }

        await eb_lib_helpers.writeFile(EXTENSIONS_FILE_PATH, extensionsFile, 'utf8');
    }
}
