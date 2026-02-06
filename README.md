# linkam-db

A database wrapper for `knex` that simplifies database connection and querying. It includes built-in Oracle Instant Client, automatic camelCase conversion of query results, and credential management via `db.ini` configuration. Currently supports Oracle and PostgreSQL databases.

## Features

- Pre-bundled Oracle Instant Client 12.1
- Automatic credential management via `db.ini`
- Query result camelCase conversion
- **PKG executable support** - Works in bundled Node.js executables

## Installation

```bash
npm install linkam-db
```

## PKG Compatibility (v1.0.6+)

When your application is bundled into a standalone executable using [`pkg`](https://github.com/yao-pkg/pkg), linkam-db automatically handles Oracle Client DLL extraction.

### How It Works

1. **Detection**: Checks for `process.pkg` environment
2. **Extraction**: On first run, extracts Oracle Client DLLs from pkg's virtual filesystem to Windows temp directory
3. **Caching**: DLLs remain in temp for subsequent runs (no extraction delay)
4. **Loading**: Initializes `oracledb` with the real filesystem path (Windows requirement)

### Why This Is Needed

Windows `LoadLibrary()` API cannot load native DLLs from memory or virtual filesystems. PKG bundles assets into a virtual filesystem that JavaScript can read, but native DLLs must exist as physical files on disk.

### Configuration

No configuration needed! Just include linkam-db's assets in your pkg config:

```json
{
  "pkg": {
    "assets": [
      "node_modules/linkam-db/instantclient_12_1/**/*",
      "node_modules/oracledb/build/Release/*.node",
      "node_modules/linkam-db/db.ini"
    ]
  }
}
```

### Temp Directory Location

DLLs are extracted to: `%TEMP%\linkam-db-oracle-client\instantclient_12_1`

Example: `C:\Users\username\AppData\Local\Temp\linkam-db-oracle-client\instantclient_12_1`

## Usage

```javascript
const db = require('linkam-db');

async function example() {
    // Initialize with default db.ini location and current directory for SQL files
    const knex = await db.init('myDatabase');
    
    // Specify custom credentials file path
    const knex2 = await db.init('myDatabase', '/path/to/custom/credentials.ini');
    
    // Specify custom SQL directory (third parameter)
    const knex3 = await db.init('myDatabase', undefined, './sql');
    
    // Or both
    const knex4 = await db.init('myDatabase', '/path/to/creds.ini', './sql');
    
    // Run raw SQL query
    const results = await knex.raw('SELECT * FROM my_table WHERE id = ?', [123]);
    
    // Run SQL from file (reads from sqlDirectory, default: process.cwd())
    const fileResults = await knex.run({ 
        sql: 'queries/myQuery',  // reads queries/myQuery.sql
        params: { id: 123 }
    });
    
    // Or use getRows helper for logging
    const rows = await knex.getRows('queries/myQuery', { id: 123 });
    
    // Results are automatically converted to camelCase
    console.log(results);
}
```

## Database Configuration

Create a `db.ini` file in your project root (copy from `node_modules/linkam-db/db.ini` as template):

```ini
[myDatabase]
client = oracledb
username = your_username
password = your_password
connectString = hostname:port/servicename
```

By default, linkam-db looks for `personal.db.ini` first, then falls back to `db.ini` in your project root. You can also specify a custom credentials file path as the second parameter to `db.init()`.

## SQL File Methods

linkam-db includes convenience methods for executing SQL from files:

### `knex.run(query)`
Executes SQL from a file in your configured SQL directory (default: `process.cwd()`).

```javascript
const results = await knex.run({
    sql: 'queries/getUsers',  // reads queries/getUsers.sql
    params: { status: 'active' }
});
```

### `knex.getRows(sqlFile, params)`
Similar to `run()` but with additional logging of row counts and first values.

```javascript
const users = await knex.getRows('queries/getUsers', { status: 'active' });
// Logs: "5 rows returned. userId: 1,2,3,4,5"
```

**Note**: SQL filenames can omit the `.sql` extension. Paths are relative to the `sqlDirectory` parameter set during `init()` (default: `process.cwd()`).
