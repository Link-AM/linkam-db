# linkam-db

Oracle database wrapper using `oracledb` and `knex` with built-in Oracle Instant Client.

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
    const knex = await db.init('myDatabase');
    
    // Run raw SQL query
    const results = await knex.raw('SELECT * FROM my_table WHERE id = ?', [123]);
    
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

## License

ISC
