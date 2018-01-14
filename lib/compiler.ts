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

/**
 * Options for an entity compiler.
 */
export interface EntityCompilerOptions {
}

/**
 * Result of a compile operation of an entity compiler.
 */
export interface EntityCompilerResult {
}


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

        return RESULT;
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
