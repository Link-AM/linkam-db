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

    /**
     * Execute SQL from a file
     * @param {Object} query - Query object
     * @param {string} query.sql - SQL filename (without .sql extension) or relative path from sqlDirectory
     * @param {Object} [query.params] - Query parameters
     * @returns {Promise<Array>} Query results
     */
    knex.run = async function (query)  {
        const sqlPath = query.sql.endsWith('.sql') ? query.sql : `${query.sql}.sql`
        const fullPath = path.isAbsolute(sqlPath) ? sqlPath : path.join(sqlDir, sqlPath)
        let sql = fs.readFileSync(fullPath, `utf8`)
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