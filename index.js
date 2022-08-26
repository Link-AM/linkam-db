const oracledb = require(`oracledb`)
const path = require(`path`)
const fs = require(`fs`)
const camelcase = require(`./camelcase`)
const authorize = require(`./authorize`)
const log = require(`linkam-logs`)

const libDir = path.resolve(__dirname, `instantclient_12_1`)
oracledb.initOracleClient({ libDir: libDir })


async function init(db) {
    let credentials = authorize.getCredentials(db)
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
        let sql = fs.readFileSync(`${path.resolve(__dirname, '..')}/${query.sql}.sql`, `utf8`)
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