import index from "./index.json" assert { type: "json" }
import { readFileSync, writeFileSync } from "fs"
import { exit } from "process"

/** @type {{changed: string[], errors: string[]}} */
const res = {
    changed: [],
    errors: []
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
 * Checks how many parameters are in source and translations
 * so we can check if they match
 * @param {string} source The source value
 * @param {string} translation The translation value
 * @returns {{source: number, translation: number}}
 */
const validateParams = (source, translation) => { return { source: count(source, "{}"), translation: count(translation, "{}") } }

const default_lang_file = `${index.default_lang}.json`
const default_lang = translationToObj(default_lang_file)
const translations = Object.values(index.translations).map(x => x.file).filter(x => x != default_lang_file)

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
            const paramInfo = validateParams(default_lang[key], translation_obj[key])
            if (paramInfo.source != paramInfo.translation) {
                res.errors.push(`${translation}[${key}]: incorrect number of parameters (${paramInfo.source}:${paramInfo.translation})`)
            }

            res_obj[key] = translation_obj[key];
        }
    }

    if (Object.keys(res_obj).length !== Object.keys(translation_obj).length) {
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
            const paramInfo = validateParams(default_lang[key], translation_obj[key])
            if (paramInfo.source != paramInfo.translation) {
                res.errors.push(`${translation}[${key}]: incorrect number of parameters (${paramInfo.source}:${paramInfo.translation})`)
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
    translations.forEach(translation => {
        commands[command](translation)
    })
}

console.log(res)
writeFileSync(".result.json", objToTranslation(res))
