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

import * as eb_lib_compiler from './lib/compiler';
import * as eb_lib_helpers from './lib/helpers';
import * as Enumerable from 'node-enumerable';
import * as FS from 'fs';
import * as Minimist from 'minimist';
import * as Path from 'path';


interface AppSettings {
    doctrine: boolean;
    entityFramework: boolean;
    entityFrameworkCore: boolean;
    inputFiles: string[];
    outDirs: string[];
}


const SETTINGS: AppSettings = {
    doctrine: false,
    entityFramework: false,
    entityFrameworkCore: false,
    inputFiles: [],
    outDirs: [],
};

const CMD_ARGS = Minimist( process.argv.slice(2) );
for (const A in CMD_ARGS) {
    const ARGS = eb_lib_helpers.asArray(CMD_ARGS[A]);

    switch (A) {
        case '_':
            eb_lib_helpers.pushMany(
                SETTINGS.inputFiles,
                ARGS.filter(a => {
                    return !eb_lib_helpers.isEmptyString(a);
                }).map(x => {
                    return eb_lib_helpers.toStringSafe(x);
                }),
            );
            break;

        case 'o':
        case 'out':
            // output directory
            eb_lib_helpers.pushMany(
                SETTINGS.outDirs,
                ARGS.filter(a => {
                    return !eb_lib_helpers.isEmptyString(a);
                }).map(x => {
                    return eb_lib_helpers.toStringSafe(x);
                }),
            );
            break;

        case 'd':
        case 'doctrine':
            SETTINGS.doctrine = Enumerable.from(ARGS).all(a => eb_lib_helpers.toBooleanSafe(a));
            break;

        case 'ef':
        case 'entity-framework':
            SETTINGS.entityFramework = Enumerable.from(ARGS).all(a => eb_lib_helpers.toBooleanSafe(a));
            break;

        case 'efc':
        case 'ef-core':
        case 'entity-framework-core':
            SETTINGS.entityFrameworkCore = Enumerable.from(ARGS).all(a => eb_lib_helpers.toBooleanSafe(a));
            break;
    }
}

SETTINGS.inputFiles = eb_lib_helpers.distinctArray(SETTINGS.inputFiles);
if (SETTINGS.inputFiles.length < 1) {
    SETTINGS.inputFiles
            .push(eb_lib_compiler.DEFAULT_ENTITY_FILE);
}

SETTINGS.outDirs = eb_lib_helpers.distinctArray(SETTINGS.outDirs);
if (SETTINGS.outDirs.length < 1) {
    SETTINGS.outDirs
            .push('./out');
}

// entity files
let entityFiles: string[] = [];
for (const FP of SETTINGS.inputFiles) {
    const MATCHING_FILES = eb_lib_helpers.globSync(FP, {
        cwd: process.cwd(),
        nosort: false,
        root: process.cwd(),
    });

    eb_lib_helpers.pushMany(entityFiles, MATCHING_FILES);
}
entityFiles = Enumerable.from(entityFiles).distinct().orderBy(x => {
    return eb_lib_helpers.normalizeString( Path.dirname(x) ).length;
}).thenBy(x => {
    return eb_lib_helpers.normalizeString( Path.dirname(x) );
}).thenBy(x => {
    return eb_lib_helpers.normalizeString( Path.basename(x) );
}).toArray();

// output directories
let outDirs = Enumerable.from(SETTINGS.outDirs).select(x => {
    if (!Path.isAbsolute(x)) {
        x = Path.join(process.cwd(), x);
    }

    return Path.resolve(x);
}).distinct().orderBy(x => {
    return eb_lib_helpers.normalizeString( Path.dirname(x) ).length;
}).thenBy(x => {
    return eb_lib_helpers.normalizeString( Path.dirname(x) );
}).thenBy(x => {
    return eb_lib_helpers.normalizeString( Path.basename(x) );
}).toArray();


// targets
let frameworks: eb_lib_compiler.EntityFramework[] = [];
if (SETTINGS.doctrine) {
    frameworks.push(eb_lib_compiler.EntityFramework.Doctrine);
}
if (SETTINGS.entityFramework) {
    frameworks.push(eb_lib_compiler.EntityFramework.EntityFramework);
}
if (SETTINGS.entityFrameworkCore) {
    frameworks.push(eb_lib_compiler.EntityFramework.EntityFrameworkCore);
}


const COMPLETED = (err: any) => {
    eb_lib_helpers.write_ln();

    if (err) {
        eb_lib_helpers.write_err_ln(`[ERROR] '${eb_lib_helpers.toStringSafe(err)}'`);
        process.exit(1);
    }
    else {
        process.exit(0);
    }
};


const ENTITY_FILES = entityFiles.map(f => f);
const NEXT_FILE = function (err?: any) {
    if (arguments.length > 0) {
        if (err) {
            eb_lib_helpers.write_ln(`[ERROR] '${eb_lib_helpers.toStringSafe(err)}'`);
        }
        else {
            eb_lib_helpers.write_ln(`[OK]`);
        }
    }

    if (ENTITY_FILES.length < 1) {
        COMPLETED(null);
        return;
    }

    const DIR_COMPLETED = (err: any) => {
        if (err) {                    
            eb_lib_helpers.write_ln(`\t[ERROR] '${eb_lib_helpers.toStringSafe(err)}'`);
        }
        else {
            eb_lib_helpers.write_ln(`\t[OK]`);
        }

        NEXT_FILE(null);
    };

    try {
        const EF = ENTITY_FILES.shift();

        const ENTITY_FILE_OBJ: eb_lib_compiler.EntityFile = JSON.parse(
            FS.readFileSync(EF, 'utf8')
        );
        if (!eb_lib_helpers.isObj<eb_lib_compiler.EntityFile>(ENTITY_FILE_OBJ)) {
            NEXT_FILE(null);
            return;
        }

        eb_lib_helpers.write_ln(`Compiling entities of '${EF}'... `);
        try {
            const OUT_DIRS = outDirs.map(d => d);
            const NEXT_DIR = () => {
                if (OUT_DIRS.length < 1) {
                    DIR_COMPLETED(null);
                    return;
                }

                try {
                    const OD = OUT_DIRS.shift();
                    
                    const ENTITY_FRAMEWORKS = frameworks.map(f => f);
                    const NEXT_TARGET = () => {
                        if (ENTITY_FRAMEWORKS.length < 1) {
                            DIR_COMPLETED(null);
                            return;
                        }

                        const TARGET_COMPLETED = (err: any) => {
                            if (err) {                    
                                eb_lib_helpers.write_ln(`\t[ERROR] '${eb_lib_helpers.toStringSafe(err)}'`);
                            }
                            else {
                                eb_lib_helpers.write_ln(`\t[OK]`);
                            }
                    
                            NEXT_DIR();
                        };

                        try {
                            const EF = ENTITY_FRAMEWORKS.shift();

                            let outDir = OD;
                            if (frameworks.length > 1) {
                                switch (EF) {
                                    case eb_lib_compiler.EntityFramework.Doctrine:
                                        outDir = Path.join(outDir, 'doctrine');
                                        break;

                                    case eb_lib_compiler.EntityFramework.EntityFramework:
                                        outDir = Path.join(outDir, 'ef');
                                        break;

                                    case eb_lib_compiler.EntityFramework.EntityFrameworkCore:
                                        outDir = Path.join(outDir, 'ef-core');
                                        break;
                                }
                            }
                            outDir = Path.resolve(outDir);

                            let frameworkName = eb_lib_compiler.EntityFramework[EF];

                            eb_lib_helpers.write_ln(`\tWriting ${frameworkName} entities to '${OD}'... `);
                            eb_lib_compiler.compile({
                                cwd: process.cwd(),
                                file: ENTITY_FILE_OBJ,
                                outDir: outDir,
                                target: EF,
        
                                callbacks: {
                                    onBeforeGenerateClass: (className, target) => {
                                        eb_lib_helpers.write(`\t\tGenerating class '${className}'... `);
                                    },
        
                                    onClassGenerated: (err, className, target) => {
                                        if (err) {
                                            eb_lib_helpers.write_ln(`[ERROR: '${eb_lib_helpers.toStringSafe(err)}']`);
                                        }
                                        else {
                                            eb_lib_helpers.write_ln(`[OK]`);
                                        }
                                    }
                                }
                            }).then(() => {
                                DIR_COMPLETED(null);
                            }, (err) => {                        
                                DIR_COMPLETED(err);
                            });
                        }
                        catch (e) {
                            TARGET_COMPLETED(e);
                        }
                    };

                    NEXT_TARGET();
                }
                catch (e) {
                    DIR_COMPLETED(e);
                }
            };

            NEXT_DIR();
        }
        catch (e) {
            NEXT_FILE(e);
        }
    }
    catch (e) {
        COMPLETED(e);
    }
};

NEXT_FILE();