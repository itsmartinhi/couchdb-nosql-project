import fetch from "node-fetch";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const URL = "http://localhost:5984";

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "insert":
      await insertData();
      break;
    case "drop":
      await dropDatabases();
      break;
    case "select":
      await selectDataFromCouchBase();
      break;
    default:
      printUsage();
      break;
  }
}
main();

function getHTTPBasicHeaderValue() {
  const credentials = {
    user: process.env.COUCHDB_USER,
    password: process.env.COUCHDB_PASSWORD,
  };

  if (!credentials.user || !credentials.password) {
    throw new Error(
      "must specify database credentials as environment variables COUCHDB_USER and COUCHDB_PASSWORD"
    );
  }

  const b64 = Buffer.from(
    `${credentials.user}:${credentials.password}`
  ).toString("base64");
  return b64;
}

async function selectDataFromCouchBase() {
  // getAttendeesFromAugsburg(); // B)
  // getEmployeesWithSaleryBetween3kAnd4k(); // C)
  // getCoursesWithNoAttendees(); // H)
  // getCourseTitlesWithCountOfOffers(); // K)
  getEmployeesWithTheSameCourse(); // H)
}

export function getAuthHeaders() {
  return {
    Authorization: `Basic ${getHTTPBasicHeaderValue()}`,
  };
}

async function createDatabase(database) {
  const response = await fetch(`${URL}/${database}`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();

    if (error.error === "file_exists") {
      console.log(`Database "${database}" already exists. Skipping`);
      return;
    }

    console.error(error);
    throw new Error(`failed to create database "${database}"`);
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
  });

  if (!response.ok) {
    const error = await response.json();

    console.error(error);
    throw new Error(`failed to insert into "${database}"`);
  }
}

async function loadInsertData() {
  const path = resolve(__dirname, "../../data.json");
  const raw = await readFile(path);

  return JSON.parse(raw);
}

async function insertData() {
  const data = await loadInsertData();

  for (const [database, items] of Object.entries(data)) {
    await createDatabase(database);

    for (const item of items) {
      await insertInto(database, item);
    }

    console.log(`✔︎ inserted ${items.length} documents to "${database}"`);
  }
}

async function dropDatabase(database) {
  const response = await fetch(`${URL}/${database}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();

    if (error.error === "not_found") {
      console.log(`database "${database}" does not exist. Skipping`);
      return;
    }

    console.error(error);
    throw new Error(`failed to delete database "${database}"`);
  }

  console.log(`✔︎ deleted database "${database}"`);
}

async function dropDatabases() {
  const data = await loadInsertData();
  const databases = Object.keys(data);

  for (const database of databases) {
    await dropDatabase(database);
  }

  console.log(`✔︎ deleted ${databases.length} databases`);
}

function printUsage() {
  console.log(`Usage: node src/main.mjs {command}
Commands:
    - insert: Create databases and insert data from data.json
    - drop: Delete all databases specified in data.json`);
}

async function getAttendeesFromAugsburg() {
  const attendeesCityIsAugsburg = JSON.stringify({
    selector: {
      city: { $eq: "Augsburg" },
    },
    execution_stats: true,
    fields: ["_id", "_rev", "city", "name"],
  });
  const response = await fetch(`${URL}/attendees/_find`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: attendeesCityIsAugsburg,
  });
  if (!response.ok) {
    const error = await response.json();

    console.error(error);
    throw new Error(`failed to select from database`);
  } else {
    response
      .json()
      .then((success) =>
        console.log("Employees where City is Augsburg", success.docs)
      );
  }
}

async function getEmployeesWithSaleryBetween3kAnd4k() {
  const saleryBody = JSON.stringify({
    selector: { salery: { $gt: 3000, $lt: 4000 } },
    execution_stats: true,
    fields: ["_id", "_rev", "salery", "name"],
  });
  const response = await fetch(`${URL}/employees/_find`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: saleryBody,
  });
  if (!response.ok) {
    const error = await response.json();

    console.error(error);
    throw new Error(`failed to select from database`);
  } else {
    response
      .json()
      .then((success) =>
        console.log("salery between 3000 and 4000: ", success.docs)
      );
  }
}

async function getCoursesWithNoAttendees() {
  const body = JSON.stringify({
    selector: { attendeeIds: { $eq: [] } },
    execution_stats: true,
    fields: ["_id", "courseId"],
  });
  const response = await fetch(`${URL}/offers/_find`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: body,
  });
  if (!response.ok) {
    const error = await response.json();

    console.error(error);
    throw new Error(`failed to select from database`);
  } else {
    const data = (await response.json()).docs;
    const getTitleForId = await fetch(`${URL}/courses/_bulk_get`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        docs: Array.from(new Set(data.map((row) => ({ id: row["courseId"] })))),
      }),
    });
    const courses = (await getTitleForId.json()).results
      .map((result) => result.docs.map((doc) => doc.ok))
      .flat();
    const result = courses.map((course) => ({
      offerId: data.find((data) => data.courseId === course._id)._id,
      courseName: course.name,
    }));
    console.log("Offers and the Course Title with no Attendees", result);
  }
}

async function getCourseTitlesWithCountOfOffers() {
  const body = JSON.stringify({
    selector: { courseId: { $exists: true } },
    execution_stats: true,
    fields: ["_id", "courseId"],
  });
  const response = await fetch(`${URL}/offers/_find`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: body,
  });
  const body2 = JSON.stringify({
    selector: { name: { $exists: true } },
    execution_stats: true,
    fields: ["_id", "name"],
  });
  const response2 = await fetch(`${URL}/courses/_find`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: body2,
  });
  if (!response.ok) {
    const error = await response.json();
    console.error(error);
    throw new Error(`failed to select from database`);
  }
  if (!response2.ok) {
    const error = await response.json();
    console.error(error);
    throw new Error(`failed to select from database`);
  }
  const offers = (await response.json()).docs;
  const courses = (await response2.json()).docs;
  const result = courses.map((course) => ({
    name: course.name,
    count: offers.filter((offer) => offer.courseId === course._id).length,
  }));
  console.log(result);
}

async function getEmployeesWithTheSameCourse() {
  const body = JSON.stringify({
    selector: { courseId: { $exists: true } },
    execution_stats: true,
    fields: ["_id", "courseId"],
  });
  const response = await fetch(`${URL}/offers/_find`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: body,
  });
  if (!response.ok) {
    const error = await response.json();
    console.error(error);
    throw new Error(`failed to select from database`);
  }
  const body2 = JSON.stringify({
    selector: { name: { $exists: true } },
    execution_stats: true,
    fields: ["name", "offerIds"],
  });
  const response2 = await fetch(`${URL}/employees/_find`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: body2,
  });
  if (!response2.ok) {
    const error = await response.json();
    console.error(error);
    throw new Error(`failed to select from database`);
  }
  const offers = (await response.json()).docs;
  const employees = (await response2.json()).docs;
  const employeesWithCourseIds = employees.map((employee) => ({
    ...employee,
    courseIds: employee.offerIds.map(
      (id) => offers.find((offer) => offer._id === id).courseId
    ),
  }));
  const pairs = {};
  employeesWithCourseIds.map((employee) => {
    employee.courseIds.forEach((id) => {
      employeesWithCourseIds.forEach((employee) => {
        if (!!employee.courseIds.find((idToCompare) => idToCompare === id)) {
          pairs[id] = !!pairs[id]
            ? pairs[id].add(employee.name)
            : new Set([employee.name]);
        }
      });
    });
  });
  Object.keys(pairs).forEach((key) => {
    if (pairs[key].size < 2) {
      delete pairs[key];
    }
  });
  console.log(pairs);
}
