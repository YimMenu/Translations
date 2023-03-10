/**
 * node .github/util.mjs <command> [file]
 * file can be a translation file you want to run the <command> against
 * or a previous index.json to only run the <command> on the new added
 * translations
 * 
 * e.g. node .github/util.mjs validate ./old_version/index.json
 */

import index from "../index.json" assert { type: "json" }
import { readFileSync, writeFileSync, existsSync } from "fs"
import { exit } from "process"

/** @type {{changed: string[], errors: string[]}} */
const res = {
    changed: [],
    errors: [],
    warnings: []
}

/**
 * Reads the translation_file and returns it as an object
 * @param {string} translation_file Translation file with extension (e.g. .json)
 * @returns {object}
 */
const translationToObj = (translation_file) => JSON.parse(readFileSync(`./${translation_file}`, { encoding: "utf-8" }))

/**
 * Stringifies the translation_obj with 4-space indent
 * @param {object} translation_obj The translation object
 * @returns {string}
 */
const objToTranslation = (translation_obj) => JSON.stringify(translation_obj, null, 4)

/**
 * Counts how many times sub occurs in str
 * @param {string} str The source string
 * @param {string} sub The substring
 * @returns {number}
 */
const count = (str, sub) => str.split(sub).length - 1

/**
 * Checks how many of `pattern` are in source and translations
 * so we can check if they match
 * @param {string} source The source value
 * @param {string} translation The translation value
 * @param {string} pattern The pattern string to check (default: '{}')
 * @returns {{source: number, translation: number}}
 */
const patternCheck = (source, translation, pattern = "{}") => { return { source: count(source, pattern), translation: count(translation, pattern) } }

const default_lang_file = `${index.default_lang}.json`
const default_lang = translationToObj(default_lang_file)
const translations = Object.values(index.translations).map(x => x.file).filter(x => x != default_lang_file)

/**
 * Finds new translations based on an old index.json
 * @param {string} oldTranslationFile The old index.json
 * @returns {string[]}
 */
const newTranslations = (oldTranslationFile) => {
    if (!existsSync(oldTranslationFile)) return translations
    const oldTranslations = Object.values(translationToObj(oldTranslationFile).translations).map(x => x.file).filter(x => x != default_lang_file)
    const uniq = translations.filter(x => !oldTranslations.includes(x))

    if (uniq.length === 0) return translations

    return uniq
}

/**
 * Checks if two 1 level objects' keys are the same
 * @param {object} x First object
 * @param {object} y Second object
 * @returns {boolean}
 */
const objHasAllKeys = (x, y) => Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(z => y.hasOwnProperty(z))

const patterns = ["{}", "%"]

/**
 * Merges (and validates) translations based on the default one,
 * so if keys get removed or added they also do in all the other
 * translations
 * @param {string} translation The translation file name including its extension
 */
const mergeFunc = (translation) => {
    const translation_obj = translationToObj(translation)
    const res_obj = { ...default_lang }

    for (let key in translation_obj) {
        if (key in res_obj) {
            patterns.forEach(pattern => {
                const paramInfo = patternCheck(default_lang[key], translation_obj[key], pattern)
                if (paramInfo.source != paramInfo.translation) {
                    res.errors.push(`${translation}[${key}]: incorrect number of \`${pattern}\` found (${paramInfo.source}:${paramInfo.translation})`)
                }
            })

            res_obj[key] = translation_obj[key];
        }
    }

    if (!objHasAllKeys(res_obj, translation_obj)) {
        writeFileSync(translation, objToTranslation(res_obj))
        res.changed.push(translation)
    }
}

/**
 * Validates the translation against the default on
 * @param {string} translation The translation file name including its extension
 */
const validateFunc = (translation) => {
    const translation_obj = translationToObj(translation)

    for (let key in translation_obj) {
        if (key in default_lang) {
            patterns.forEach(pattern => {
                const paramInfo = patternCheck(default_lang[key], translation_obj[key], pattern)
                if (paramInfo.source != paramInfo.translation) {
                    res.errors.push(`${translation}[${key}]: incorrect number of \`${pattern}\` found (${paramInfo.source}:${paramInfo.translation})`)
                }
            })

            if (default_lang[key] === translation_obj[key]) {
                res.warnings.push(`${translation}[${key}]: might be untranslated`)
            }
        }
    }
}

const commands = {
    merge: mergeFunc,
    validate: validateFunc
}

/** @type {string?} */
const command = process.argv[2]?.toLowerCase()
const commandNames = Object.keys(commands)
if (command === undefined || !commandNames.includes(command)) {
    const msg = command === undefined ? "No command provided" : `Command "${command}" does not exist`
    console.log(`${msg}\nAvailable commands: ${commandNames.join(", ")}`)
    exit(1)
}

/** @type {string?} */
const arg = process.argv[3]
if (!!arg && translations.includes(arg)) {
    commands[command](arg)
} else {
    (!!arg ? newTranslations(arg) : translations).forEach(translation => {
        commands[command](translation)
    })
}

console.log(res)
writeFileSync(".result.json", objToTranslation(res))
