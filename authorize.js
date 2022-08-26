const log = require(`linkam-logs`)
const path = require(`path`)
const fs = require(`fs`)
const propReader = require('properties-reader')
const props = propReader(getPropFile()).getAllProperties()

function getCredentials(app) {
    log.debug(`getCredentials called.  app=${app}`)
    let credentials = props
    if (credentials) {
        return credentials
    } else {
        log.warn(`nodeToolsCredentials missing for app ${app}`)
    }
}

function getPropFile() {
    let criteria = path.join(__dirname, `..`, `..`, `db.ini`)
    let personal = path.join(__dirname, `..`, `..`, `personal.db.ini`)
    let propFile = fs.existsSync(personal) ? personal : criteria
    return propFile
}

module.exports= {
    getCredentials: getCredentials
}