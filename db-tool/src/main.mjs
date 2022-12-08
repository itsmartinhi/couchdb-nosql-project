import fetch from "node-fetch"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const URL = "http://localhost:5984"

async function main() {
    const command = process.argv[2]

    switch (command) {
        case "insert":
            await insertData()
            break
        case "drop":
            await dropDatabases()
            break
        default:
            printUsage()
            break
    }
}
main()

function getHTTPBasicHeaderValue() {
    const credentials = {
        user: process.env.COUCHDB_USER,
        password: process.env.COUCHDB_PASSWORD,
    }

    if (!credentials.user || !credentials.password) {
        throw new Error("must specify database credentials as environment variables COUCHDB_USER and COUCHDB_PASSWORD")
    }

    const b64 = Buffer.from(`${credentials.user}:${credentials.password}`).toString("base64")
    return b64
}

function getAuthHeaders() {
    return {
        Authorization: `Basic ${getHTTPBasicHeaderValue()}`,
    }
}

async function createDatabase(database) {
    const response = await fetch(`${URL}/${database}`, {
        method: "PUT",
        headers: getAuthHeaders(),
    })

    if (!response.ok) {
        const error = await response.json()

        if (error.error === "file_exists") {
            console.log(`Database "${database}" already exists. Skipping`)
            return
        }

        console.error(error)
        throw new Error(`failed to create database "${database}"`)
    }
}

async function insertInto(database, data) {
    const response = await fetch(`${URL}/${database}`, {
        method: "POST",
        headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    })

    if (!response.ok) {
        const error = await response.json()

        console.error(error)
        throw new Error(`failed to insert into "${database}"`)
    }
}

async function loadInsertData() {
    const path = resolve(__dirname, "../../data.json")
    const raw = await readFile(path)

    return JSON.parse(raw)
}

async function insertData() {
    const data = await loadInsertData()

    for (const [database, items] of Object.entries(data)) {
        await createDatabase(database)

        for (const item of items) {
            await insertInto(database, item)
        }

        console.log(`✔︎ inserted ${items.length} documents to "${database}"`)
    }
}

async function dropDatabase(database) {
    const response = await fetch(`${URL}/${database}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    })

    if (!response.ok) {
        const error = await response.json()

        if (error.error === "not_found") {
            console.log(`database "${database}" does not exist. Skipping`)
            return
        }

        console.error(error)
        throw new Error(`failed to delete database "${database}"`)
    }

    console.log(`✔︎ deleted database "${database}"`)
}

async function dropDatabases() {
    const data = await loadInsertData()
    const databases = Object.keys(data)

    for (const database of databases) {
        await dropDatabase(database)
    }

    console.log(`✔︎ deleted ${databases.length} databases`)
}

function printUsage() {
    console.log(`Usage: node src/main.mjs {command}
Commands:
    - insert: Create databases and insert data from data.json
    - drop: Delete all databases specified in data.json`)
}
