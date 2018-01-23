# node-entity-baker

[Node.js](https://nodejs.org) application / library, which generates simple and powerful entity classes for [ORM](https://en.wikipedia.org/wiki/Object-relational_mapping) systems, like [Doctrine](http://www.doctrine-project.org) and/or [Entity Framework](https://docs.microsoft.com/en-us/ef/), wriiten in [TypeScript](https://www.typescriptlang.org).

## Installation

As command line tool:

```bash
npm install -g entity-baker
```

As module:

```bash
npm install --save entity-baker
```

## Usage

First create a `entities.json` file inside your working directory (can also be in XML or YAML format, s. [examples folder](https://github.com/mkloubert/node-entity-baker/tree/master/examples)):

```json
{
    "namespace": "MarcelJoachimKloubert.Database",

    "entities": {
        "User": {
            "table": "users",

            "columns": {
                "id": {
                    "id": true,
                    "auto": true,
                    "type": "int32"
                },

                "name": "string",
                "email": "string",
                "context": "json"
            }
        }
    }
}
```

### From command line

```bash
# run it from your working directory
entity-baker --doctrine --entity-framework --entity-framework-core
```

### As module

JavaScript

```javascript
var EntityBaker = require('entity-baker');
```

TypeScript

```typescript
import * as EntityBaker from 'entity-baker';
```

#### compile

```javascript
var fs = require('fs');

var entityFile = JSON.parse(
    fs.readFileSync('./entities.json', 'utf8')
);

EntityBaker.compile({
    cwd: '/path/to/working/directory',
    file: entityFile,
    outDir: '/path/to/output/directory',
       target: 1,  // Doctrine
    // target: 2  // Entity Framework
    // target: 3  // Entity Framework Core

    callbacks: {
        onBeforeGenerateClass: function(className, target) {
        },

        onClassGenerated: function(err, className, target) {
        }
    }
}).then(function() {
    // files generated
}, function (err) {
    // error while generating files
});
```
