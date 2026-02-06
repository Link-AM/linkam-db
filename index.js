const oracledb = require(`oracledb`)
const path = require(`path`)
const fs = require(`fs`)
const camelcase = require(`./camelcase`)
const authorize = require(`./authorize`)
const log = require(`linkam-logs`)

// Handle pkg executable - extract Oracle Client to real filesystem
let libDir
if (process.pkg) {
    // When running in pkg, extract DLLs to temp directory
    // Windows DLL loader can't load from pkg's virtual filesystem
    const os = require('os')
    const tempDir = path.join(os.tmpdir(), 'linkam-db-oracle-client', 'instantclient_12_1')
    
    // Extract DLLs if not already present
    if (!fs.existsSync(tempDir)) {
        log.info('Extracting Oracle Client libraries to temp directory...')
        fs.mkdirSync(tempDir, { recursive: true })
        
        const sourceDir = path.resolve(__dirname, 'instantclient_12_1')
        const files = fs.readdirSync(sourceDir)
        
        files.forEach(file => {
            const sourcePath = path.join(sourceDir, file)
            const targetPath = path.join(tempDir, file)
            
            const stats = fs.statSync(sourcePath)
            if (stats.isDirectory()) {
                // Copy directory recursively
                copyDirSync(sourcePath, targetPath)
            } else {
                fs.copyFileSync(sourcePath, targetPath)
            }
        })
        log.info(`Oracle Client extracted to: ${tempDir}`)
    }
    
    libDir = tempDir
} else {
    // Normal execution - use __dirname
    libDir = path.resolve(__dirname, `instantclient_12_1`)
}

// Helper function to copy directory recursively
function copyDirSync(source, target) {
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true })
    }
    const files = fs.readdirSync(source)
    files.forEach(file => {
        const sourcePath = path.join(source, file)
        const targetPath = path.join(target, file)
        const stats = fs.statSync(sourcePath)
        if (stats.isDirectory()) {
            copyDirSync(sourcePath, targetPath)
        } else {
            fs.copyFileSync(sourcePath, targetPath)
        }
    })
}

oracledb.initOracleClient({ libDir: libDir })


async function init(db) {
    let creds = authorize.getCredentials(db)
    let credentials = {
        client: creds[`${db}.client`],
        user: creds[`${db}.username`],
        password: creds[`${db}.password`],
        connectString: creds[`${db}.connectString`]
    }
    let connection = setConnection(credentials)
    const knex = require(`knex`)({
        //debug: true,
        client: credentials.client,
        connection: connection,
        postProcessResponse: (result, queryContext) => {
            let response = camelcase.convert(result)
            //log.debug(queryContext)
            return response
        }
    })

    knex.run = async function (query)  {
        let sql = fs.readFileSync(path.join(__dirname, `..`, `..`, `${query.sql}.sql`), `utf8`)
        log.debug(formatSqlForLogs(sql, query.params))
        
        let results = await knex.raw(sql, query.params)
            .then( (response) => {
                if (this.client.config.client === `oracledb`) {
                    return response
                } else if (this.client.config.client === `pg`) {
                    return response.rows
                }
            })
            .catch(function (err) {
                log.error(err)
            })

        return results
    }

    knex.getRows = async function getRows(sqlFile, params) {
        if (!params) params = {}
        let query = {
            sql: sqlFile,
            params: params
        }
        let response = await knex.run(query)
        if (response && response.length > 0) {
            let arr = []
            for (var i in response) {
                arr.push(`${response[i][Object.keys(response[i])[0]]}`)
            }
            log.debug(`${response.length} rows returned.  ${response[0][Object.keys(response[0])[0]]}: ${arr.toString()}`)
            return response
        } else {
            log.warn(`No rows returned - file: ${query.sql}.  params: ${query.params}`)
        }
    }

    return knex
}

function setConnection(credentials) {
    let connection
    if (credentials.client === `oracledb`) {
        connection = {
            user: credentials.user,
            password: credentials.password,
            connectString: credentials.connectString
        }
    } else if (credentials.client === `pg`) {
        connection = {
            user: credentials.user,
            password: credentials.password,
            host: credentials.host,
            //port: credentials.port,
            database: credentials.database
        }   
    }
    return connection
}

function formatSqlForLogs(sql, params) {
    if (Object.keys(params).length > 0) {
        for (let [key, value] of Object.entries(params)) {
            sql = sql.replace(`:${key}`, value)
        }
    }
    sql = sql.replace(/(\r\n|\n|\r|\t)/gm, ` `)
    sql = sql.replace(/\s+/g, ` `).trim()
    return sql
}

module.exports = {
    init: init,
}