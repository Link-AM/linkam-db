const log = require(`linkam-logs`)
const path = require(`path`)
const fs = require(`fs`)
const propReader = require('properties-reader')

function getCredentials(app, credentialsFile) {
    log.debug(`getCredentials called.  app=${app}`)
    const props = propReader(getPropFile(credentialsFile)).getAllProperties()
    let credentials = props
    if (credentials) {
        return credentials
    } else {
        log.warn(`nodeToolsCredentials missing for app ${app}`)
    }
}

function getPropFile(credentialsFile) {
    if (credentialsFile) {
        // Use provided credentials file path
        if (fs.existsSync(credentialsFile)) {
            return credentialsFile
        } else {
            log.error(`Provided credentials file does not exist: ${credentialsFile}`)
            throw new Error(`Credentials file not found: ${credentialsFile}`)
        }
    }
    
    // Default behavior: look for personal.db.ini, then db.ini
    let criteria = path.join(__dirname, `..`, `..`, `db.ini`)
    let personal = path.join(__dirname, `..`, `..`, `personal.db.ini`)
    let propFile = fs.existsSync(personal) ? personal : criteria
    return propFile
}

module.exports= {
    getCredentials: getCredentials
}