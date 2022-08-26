const camelCase = require(`camelcase`)

function convert(o) {
    let newO
    let origKey
    let newKey 
    let value
    if (o instanceof Array) {
        return o.map(function (value) {
            if (typeof value === "object") {
                value = convert(value)
            }
            return value
        })
    } else {
        newO = {}
        for (origKey in o) {
            if (o.hasOwnProperty(origKey)) {
                newKey = (camelCase(origKey).toString())
                value = o[origKey]
                if (value instanceof Array || (value !== null && value.constructor === Object)) {
                    value = convert(value)
                }
                newO[newKey] = value
            }
        }
    }
    return newO
}

module.exports = {
    convert: convert
}