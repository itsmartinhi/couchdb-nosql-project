import fetch from "node-fetch"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const URL = "http://localhost:5984"

async function main() {
    const command = process.argv[2] || ""
    const subcommand = process.argv[3] || ""

    switch (command) {
        case "insert":
            await insertData()
            break
        case "drop":
            await dropDatabases()
            break
        case "task":
            await runTask(subcommand)
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
        throw new Error(
            "must specify database credentials as environment variables COUCHDB_USER and COUCHDB_PASSWORD",
        )
    }

    const b64 = Buffer.from(`${credentials.user}:${credentials.password}`).toString("base64")
    return b64
}

async function runTask(task) {
    const tasksMap = {
        a: selectA,
        b: getAttendeesFromAugsburg,
        c: getEmployeesWithSaleryBetween3kAnd4k,
        g: selectG,
        h: getCoursesWithNoAttendees,
        i: selectI,
        k: getCourseTitlesWithCountOfOffers,
        l: selectL,
        n: getEmployeesWithTheSameCourse,
    }

    const fn = tasksMap[task]

    if (fn === undefined) {
        console.error(`unknown task: "${task || "-empty-"}"`)
        console.error(`available tasks: ${Object.keys(tasksMap).join(",")}`)
        return
    }

    await fn()
}

export function getAuthHeaders() {
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
    - drop: Delete all databases specified in data.json
    - task: Run a predefined task`)
}

async function getAttendeesFromAugsburg() {
    const attendeesCityIsAugsburg = JSON.stringify({
        selector: {
            city: { $eq: "Augsburg" },
        },
        execution_stats: true,
        fields: ["_id", "_rev", "city", "name"],
    })
    const response = await fetch(`${URL}/attendees/_find`, {
        method: "POST",
        headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
        },
        body: attendeesCityIsAugsburg,
    })
    if (!response.ok) {
        const error = await response.json()

        console.error(error)
        throw new Error(`failed to select from database`)
    } else {
        response
            .json()
            .then(success => console.log("Employees where City is Augsburg", success.docs))
    }
}

async function getEmployeesWithSaleryBetween3kAnd4k() {
    const saleryBody = JSON.stringify({
        selector: { salery: { $gt: 3000, $lt: 4000 } },
        execution_stats: true,
        fields: ["_id", "_rev", "salery", "name"],
    })
    const response = await fetch(`${URL}/employees/_find`, {
        method: "POST",
        headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
        },
        body: saleryBody,
    })
    if (!response.ok) {
        const error = await response.json()

        console.error(error)
        throw new Error(`failed to select from database`)
    } else {
        response.json().then(success => console.log("salery between 3000 and 4000: ", success.docs))
    }
}

async function getCoursesWithNoAttendees() {
    const body = JSON.stringify({
        selector: { attendeeIds: { $eq: [] } },
        execution_stats: true,
        fields: ["_id", "courseId"],
    })
    const response = await fetch(`${URL}/offers/_find`, {
        method: "POST",
        headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
        },
        body: body,
    })
    if (!response.ok) {
        const error = await response.json()

        console.error(error)
        throw new Error(`failed to select from database`)
    } else {
        const data = (await response.json()).docs
        const getTitleForId = await fetch(`${URL}/courses/_bulk_get`, {
            method: "POST",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                docs: Array.from(new Set(data.map(row => ({ id: row["courseId"] })))),
            }),
        })
        const courses = (await getTitleForId.json()).results
            .map(result => result.docs.map(doc => doc.ok))
            .flat()
        const result = courses.map(course => ({
            offerId: data.find(data => data.courseId === course._id)._id,
            courseName: course.name,
        }))
        console.log("Offers and the Course Title with no Attendees", result)
    }
}

async function getCourseTitlesWithCountOfOffers() {
    const body = JSON.stringify({
        selector: { courseId: { $exists: true } },
        execution_stats: true,
        fields: ["_id", "courseId"],
    })
    const response = await fetch(`${URL}/offers/_find`, {
        method: "POST",
        headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
        },
        body: body,
    })
    const body2 = JSON.stringify({
        selector: { name: { $exists: true } },
        execution_stats: true,
        fields: ["_id", "name"],
    })
    const response2 = await fetch(`${URL}/courses/_find`, {
        method: "POST",
        headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
        },
        body: body2,
    })
    if (!response.ok) {
        const error = await response.json()
        console.error(error)
        throw new Error(`failed to select from database`)
    }
    if (!response2.ok) {
        const error = await response.json()
        console.error(error)
        throw new Error(`failed to select from database`)
    }
    const offers = (await response.json()).docs
    const courses = (await response2.json()).docs
    const result = courses.map(course => ({
        name: course.name,
        count: offers.filter(offer => offer.courseId === course._id).length,
    }))
    console.log(result)
}

async function getEmployeesWithTheSameCourse() {
    const body = JSON.stringify({
        selector: { courseId: { $exists: true } },
        execution_stats: true,
        fields: ["_id", "courseId"],
    })
    const response = await fetch(`${URL}/offers/_find`, {
        method: "POST",
        headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
        },
        body: body,
    })
    if (!response.ok) {
        const error = await response.json()
        console.error(error)
        throw new Error(`failed to select from database`)
    }
    const body2 = JSON.stringify({
        selector: { name: { $exists: true } },
        execution_stats: true,
        fields: ["name", "offerIds"],
    })
    const response2 = await fetch(`${URL}/employees/_find`, {
        method: "POST",
        headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
        },
        body: body2,
    })
    if (!response2.ok) {
        const error = await response.json()
        console.error(error)
        throw new Error(`failed to select from database`)
    }
    const offers = (await response.json()).docs
    const employees = (await response2.json()).docs
    const employeesWithCourseIds = employees.map(employee => ({
        ...employee,
        courseIds: employee.offerIds.map(id => offers.find(offer => offer._id === id).courseId),
    }))
    const pairs = {}
    employeesWithCourseIds.map(employee => {
        employee.courseIds.forEach(id => {
            employeesWithCourseIds.forEach(employee => {
                if (!!employee.courseIds.find(idToCompare => idToCompare === id)) {
                    pairs[id] = !!pairs[id]
                        ? pairs[id].add(employee.name)
                        : new Set([employee.name])
                }
            })
        })
    })
    Object.keys(pairs).forEach(key => {
        if (pairs[key].size < 2) {
            delete pairs[key]
        }
    })
    console.log(pairs)
}

async function _find(db, query) {
    const response = await fetch(`${URL}/${db}/_find`, {
        method: "POST",
        headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
        },
        body: JSON.stringify(query),
    })
    if (!response.ok) {
        const error = await response.json()

        console.error(error)
        throw new Error("failed to execute query")
    }

    return response.json()
}

async function selectA() {
    const res = await _find("offers", {
        selector: {},
        fields: ["city"],
    })

    const cities = Array.from(new Set(res.docs.map(doc => doc.city)))

    _printTask("a", "alle Orte, an denen Kurse durchgeführt werden")
    const results = cities.map(city => ({
        city,
    }))
    console.table(results)
}

async function selectG() {
    const attendeesRes = await _find("attendees", {
        selector: {},
        fields: ["city", "name"],
    })

    const attendees = []
    for (const attendee of attendeesRes.docs) {
        const offersRes = await _find("offers", {
            selector: {
                city: attendee.city,
            },
            limit: 1,
        })

        if (offersRes.docs.length > 0) {
            attendees.push(attendee)
        }
    }

    _printTask("g", "alle Teilnehmer, die einen Kurs am eigenen Wohnort gebucht haben")
    const results = attendees.map(attendee => ({
        name: attendee.name,
        city: attendee.city,
    }))
    console.table(results)
}

async function selectI() {
    const offersRes = await _find("offers", {
        selector: {},
        fields: ["courseId", "attendeeIds"],
    })

    const offers = []
    for (const offer of offersRes.docs) {
        if (offer.attendeeIds.length >= 2) {
            offers.push(offer)
        }
    }

    const courseIds = Array.from(new Set(offers.map(offer => offer.courseId)))

    const coursesRes = await _find("courses", {
        selector: {
            _id: {
                $in: courseIds,
            },
        },
        fields: ["title"],
    })

    _printTask("i", "alle Kurse (egal welches Angebot) mit mindestens 2 Teilnehmern")
    const results = coursesRes.docs.map(course => ({
        title: course.title,
    }))
    console.table(results)
}

async function selectL() {
    const coursesRes = await _find("courses", {
        selector: {},
        fields: ["title", "preconditions"],
    })

    const courses = coursesRes.docs
        .filter(doc => {
            return doc.preconditions.length >= 2
        })
        .sort((a, b) => {
            return b.preconditions.length - a.preconditions.length
        })

    _printTask(
        "l",
        "die Kurstitel mit der Anzahl der Voraussetzungen, die mindestens 2 Voraussetzungen haben. Die Ausgabe soll so erfolgen, dass die Kurse mit den meisten Voraussetzungen zuerst kommen",
    )
    const results = courses.map(course => ({
        title: course.title,
        preconditionsCount: course.preconditions.length,
    }))
    console.table(results)
}

function _printTask(task, description) {
    console.log("-".repeat(50))
    console.log(`${task}) ${description}`)
    console.log("-".repeat(50))
}
