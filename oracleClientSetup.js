const path = require('path')
const fs = require('fs')
const log = require('linkam-logs')

/**
 * Helper function to copy directory recursively
 */
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

/**
 * Determines the Oracle Client library directory path.
 * When running in a PKG executable, extracts DLLs to the system temp directory
 * because Windows DLL loader cannot load from PKG's virtual filesystem.
 * 
 * @returns {string} The path to the Oracle Instant Client libraries
 */
function getOracleClientPath() {
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
                    copyDirSync(sourcePath, targetPath)
                } else {
                    fs.copyFileSync(sourcePath, targetPath)
                }
            })
            log.info(`Oracle Client extracted to: ${tempDir}`)
        }
        
        return tempDir
    } else {
        // Normal execution - use __dirname
        return path.resolve(__dirname, 'instantclient_12_1')
    }
}

module.exports = {
    getOracleClientPath
}
