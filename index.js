const oracledb = require(`oracledb`)
const path = require(`path`)
const fs = require(`fs`)
const camelcase = require(`./camelcase`)
const authorize = require(`./authorize`)
const log = require(`linkam-logs`)
const oracleClientSetup = require(`./oracleClientSetup`)

// Initialize Oracle Client with the appropriate library directory
const libDir = oracleClientSetup.getOracleClientPath()
oracledb.initOracleClient({ libDir: libDir })

/**
 * Initialize database connection with knex
 * @param {string} db - Database name from credentials file
 * @param {string} [credentialsFile] - Optional path to credentials file (default: db.ini or personal.db.ini)
 * @param {string} [sqlDirectory] - Optional directory path for SQL files (default: process.cwd())
 * @returns {Promise<import('knex').Knex>} Configured knex instance
 */
async function init(db, credentialsFile, sqlDirectory) {
    // Set default SQL directory to current working directory
    const sqlDir = sqlDirectory || process.cwd()
    
    let creds = authorize.getCredentials(db, credentialsFile)
    
    // Validate required credentials
    const client = creds[`${db}.client`]
    if (!client) {
        throw new Error(`Missing required credential: client for database '${db}'`)
    }
    
    let credentials = {
        client: client,
        user: creds[`${db}.username`],
        password: creds[`${db}.password`],
        connectString: creds[`${db}.connectString`],
        host: creds[`${db}.host`],
        database: creds[`${db}.database`]
    }
    
    // Validate client-specific required fields
    if (credentials.client === 'oracledb') {
        if (!credentials.user || !credentials.password || !credentials.connectString) {
            throw new Error(`Missing required Oracle credentials for database '${db}': user, password, and connectString are required`)
        }
    } else if (credentials.client === 'pg') {
        if (!credentials.user || !credentials.password || !credentials.host || !credentials.database) {
            throw new Error(`Missing required PostgreSQL credentials for database '${db}': user, password, host, and database are required`)
        }
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

    /**
     * Execute SQL from a file
     * @param {Object} query - Query object
     * @param {string} query.sql - SQL filename (without .sql extension) or relative path from sqlDirectory
     * @param {Object} [query.params] - Query parameters
     * @returns {Promise<Array>} Query results
     * @throws {Error} If SQL file not found or query execution fails
     */
    knex.run = async function (query)  {
        if (!query || !query.sql) {
            throw new Error('Query object with sql property is required')
        }
        
        const sqlPath = query.sql.endsWith('.sql') ? query.sql : `${query.sql}.sql`
        const fullPath = path.isAbsolute(sqlPath) ? sqlPath : path.join(sqlDir, sqlPath)
        
        // Check if file exists before trying to read
        if (!fs.existsSync(fullPath)) {
            throw new Error(`SQL file not found: ${fullPath}`)
        }
        
        let sql
        try {
            sql = fs.readFileSync(fullPath, `utf8`)
        } catch (err) {
            log.error(`Failed to read SQL file: ${fullPath}`)
            throw err
        }
        
        log.debug(formatSqlForLogs(sql, query.params))
        
        try {
            const response = await knex.raw(sql, query.params)
            if (this.client.config.client === `oracledb`) {
                return response
            } else if (this.client.config.client === `pg`) {
                return response.rows
            }
            return response
        } catch (err) {
            log.error(`Query execution failed for file: ${query.sql}`, err)
            throw err
        }
    }

    /**
     * Execute SQL from a file and return rows with logging
     * @param {string} sqlFile - SQL filename (without .sql extension) or relative path from sqlDirectory
     * @param {Object} [params] - Query parameters
     * @returns {Promise<Array>} Query results
     */
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
    if (params && Object.keys(params).length > 0) {
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