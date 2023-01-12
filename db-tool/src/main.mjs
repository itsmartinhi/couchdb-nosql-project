import fetch from "node-fetch";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const URL = "http://localhost:5984";

async function main() {
  const command = process.argv[2] || "";
  const subcommand = process.argv[3] || "";

  switch (command) {
    case "insert":
      await insertData();
      break;
    case "drop":
      await dropDatabases();
      break;
    case "select":
      await runSelect(subcommand);
      break;
    case "update":
      await runUpdate(subcommand);
      break;
    case "delete":
      await runDelete(subcommand);
      break;
    case "reset":
      await resetDatabase();
      break;
    default:
      _printUsage();
      break;
  }
}

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

const SELECT_TASKS_MAP = {
  a: selectA,
  b: getAttendeesFromAugsburg,
  c: getEmployeesWithSalaryBetween3kAnd4k,
  d: selectD,
  e: selectE,
  f: selectF,
  g: selectG,
  h: getCoursesWithNoAttendees,
  i: selectI,
  j: selectJ,
  k: getCourseTitlesWithCountOfOffers,
  l: selectL,
  m: selectM,
  n: getEmployeesWithTheSameCourse,
};

async function runSelect(task) {
  const fn = SELECT_TASKS_MAP[task];

  if (fn === undefined) {
    console.error(`unknown select: "${task || "-empty-"}"`);
    console.error(`available selects: ${_formatTasksList(SELECT_TASKS_MAP)}`);
    return;
  }

  await fn();
}

const UPDATE_TASKS_MAP = {
  a: updateA,
  b: updateB,
};

async function runUpdate(task) {
  const fn = UPDATE_TASKS_MAP[task];

  if (fn === undefined) {
    console.error(`unknown update: "${task || "-empty-"}"`);
    console.error(`available updates: ${_formatTasksList(UPDATE_TASKS_MAP)}`);
    return;
  }

  await fn();
}

const DELETE_TASKS_MAP = {
  a: deleteA,
  b: deleteB,
};

async function runDelete(task) {
  const fn = DELETE_TASKS_MAP[task];

  if (fn === undefined) {
    console.error(`unknown delete: "${task || "-empty-"}"`);
    console.error(`available delete: ${_formatTasksList(DELETE_TASKS_MAP)}`);
    return;
  }

  await fn();
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

async function resetDatabase() {
  console.log(
    "Resetting the DBs by dropping them all and re-inserting the data...\n"
  );

  await dropDatabases();
  await insertData();

  console.log("\n✔︎ Done!");
}

function _printUsage() {
  console.log(`Usage: node src/main.mjs {command}
    Commands:
    - insert: Create databases and insert data from data.json
    - drop: Delete all databases specified in data.json
    - reset: Delete all databases specified in data.json and create databases and insert data from data.json
    - select {task}: Run a select task (available: ${_formatTasksList(
      SELECT_TASKS_MAP
    )})
    - update {task}: Run an update task (available: ${_formatTasksList(
      UPDATE_TASKS_MAP
    )})
    - delete {task}: Run a delete task (available: ${_formatTasksList(
      DELETE_TASKS_MAP
    )})`);
}

function _formatTasksList(tasks) {
  return Object.keys(tasks).join(", ");
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
    const data = (await response.json()).docs;
    _printTask("b", "die Teilnehmer aus Augsburg");
    console.table(data);
  }
}

async function getEmployeesWithSalaryBetween3kAnd4k() {
  const saleryBody = JSON.stringify({
    selector: { salery: { $gt: 3000, $lt: 4000 } },
    execution_stats: true,
    use_index: "name",
    fields: ["_id", "_rev", "salery", "name"],
    sort: [{ name: "asc" }],
  });

  // index is needed for sorting
  const indexBody = JSON.stringify({
    index: {
      fields: ["name"],
    },
    name: "name-index",
    type: "json",
  });
  await fetch(`${URL}/employees/_index`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: indexBody,
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
    const data = (await response.json()).docs;
    //ToDo sort
    _printTask(
      "c",
      "die Kursleiter mit einem Gehalt zwischen 3000 € und 4000 €, sortiert nach Namen."
    );
    console.table(data);
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
    _printTask(
      "h",
      "alle Kursangebote (Kurstitel und Angebotsnummer), zu denen es noch keine Teilnehmer gibt"
    );
    console.table(result);
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
  _printTask("k", "die Kurstitel mit der jeweiligen Anzahl der Angebote.");
  console.table(result);
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
  _printTask(
    "n",
    "alle Paare von Kursleitern, die denselben Kurs halten, und den entsprechenden Kurstitel. Geben Sie jedes Paar nur einmal aus."
  );
  console.table(Object.keys(pairs).map((key) => Array.from(pairs[key])));
}

async function selectF() {
  const body = JSON.stringify({
    selector: { _id: { $exists: true } },
    execution_stats: true,
    fields: ["_id", "title", "preconditions"],
  });
  const response = await fetch(`${URL}/courses/_find`, {
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
  const data = (await response.json()).docs;
  const mappedData = data
    .map((row) => {
      const preconditionNames = row.preconditions.map(
        (id) => data.find((obj) => obj._id === id).title
      );
      console.log(preconditionNames, row);
      return {
        Kurs: row.title,
        Vorbedingung:
          preconditionNames.length > 0 ? preconditionNames.join(", ") : "NULL",
      };
    })
    .sort((a, b) => a.Kurs.localeCompare(b.Kurs));
  _printTask(
    "f",
    "alle Kurstitel mit den Titeln der Kurse, die dafür Voraussetzung sind. Hat ein Kurs keine Voraussetzungen, so soll dieses Feld NULL sein. Achten Sie auf vernünftige Spaltenüberschriften. Die Ausgabe soll nach Kursen sortiert erfolgen."
  );
  console.table(mappedData);
}

async function _find(db, query) {
  const response = await fetch(`${URL}/${db}/_find`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });
  if (!response.ok) {
    const error = await response.json();

    console.error(error);
    throw new Error("failed to execute query");
  }

  return response.json();
}

async function selectD() {
  // fetch all available offers
  const offersRes = await _find("offers", {
    selector: {},
    fields: ["courseId", "city", "date"],
  });

  // get the unique course ids
  const courseIds = Array.from(
    new Set(offersRes.docs.map((doc) => doc.courseId))
  );

  // fetch all available courses matching the courseIds
  const coursesRes = await _find("courses", {
    selector: {
      _id: {
        $in: courseIds,
      },
    },
    fields: ["_id", "name"],
  });

  const offerData = offersRes.docs;

  // create a course name map
  const courseNameMap = {};
  coursesRes.docs.forEach(({ _id, name }) => {
    courseNameMap[_id] = name;
  });

  // create the results by combining the data
  const results = offerData.map(({ courseId, city, date }) => ({
    name: courseNameMap[courseId],
    city,
    date,
  }));

  _printTask("d", "die Kurstitel mit Datum und Ort, an dem sie stattfinden");
  console.table(results);
}

async function selectE() {
  // fetch all available offers
  const offersRes = await _find("offers", {
    selector: {},
    fields: ["_id", "courseId", "city", "date"],
  });

  // get the unique course ids
  const courseIds = Array.from(
    new Set(offersRes.docs.map((doc) => doc.courseId))
  );

  // fetch all available courses matching the courseIds
  const coursesRes = await _find("courses", {
    selector: {
      _id: {
        $in: courseIds,
      },
    },
    fields: ["_id", "name"],
  });

  // fetch all available employees
  const employeesRes = await _find("employees", {
    selector: {},
    fields: ["name", "offerIds"],
  });

  const offerData = offersRes.docs;

  // create a course name map
  const courseNameMap = {};
  coursesRes.docs.forEach(({ _id, name }) => {
    courseNameMap[_id] = name;
  });

  // create a employee name map
  const employeeNameMap = {};
  employeesRes.docs.forEach(({ name, offerIds }) => {
    offerIds.forEach((id) => {
      employeeNameMap[id] = name;
    });
  });

  // create the results by combining the data
  const results = offerData.map(({ _id, courseId, city, date }) => ({
    name: courseNameMap[courseId],
    city,
    date,
    instructor: employeeNameMap[_id],
  }));

  _printTask("e", "Anfrage d) mit zusätzlicher Ausgabe der Kursleiter");
  console.table(results);
}

async function selectJ() {
  // fetch all matching attendees
  const attendeesRes = await _find("attendees", {
    selector: {
      name: {
        $regex: "Meier",
      },
    },
    fields: ["_id", "name"],
  });

  // fetch all matching attendees
  const employeesRes = await _find("employees", {
    selector: {
      name: {
        $regex: "Meier",
      },
    },
    fields: ["_id", "name"],
  });

  const result = [];
  result.push(
    ...attendeesRes.docs.map((res) => {
      return { ...res, type: "attendee" };
    })
  );
  result.push(
    ...employeesRes.docs.map((res) => {
      return { ...res, type: "employee" };
    })
  );

  _printTask("j", "alle Meier, sowohl Teilnehmer wie auch Kursleiter");
  console.table(result);
}

async function selectM() {
  // fetch all courses with _id and name
  const coursesRes = await _find("courses", {
    selector: {},
    fields: ["_id", "title"],
  });

  const courseData = coursesRes.docs;
  const courseIds = courseData.map((res) => res._id);

  // fetch all offers ids matching the available course ids
  const offersRes = await _find("offers", {
    selector: {
      courseId: {
        $in: courseIds,
      },
    },
    fields: ["_id", "courseId"],
  });

  const offerIdMap = {};
  offersRes.docs.forEach(({ _id, courseId }) => {
    offerIdMap[_id] = courseId;
  });
  const offerIds = offersRes.docs.map((res) => res._id);

  // fetch all employee salaries for the each offer
  const employeeRes = await _find("employees", {
    selector: {
      offerIds: {
        $in: offerIds,
      },
    },
    fields: ["salary", "offerIds"],
  });

  // match salaries to courses
  const salaryData = employeeRes.docs.map((res) => {
    const matchingCourses = new Set();
    res.offerIds.forEach((id) => matchingCourses.add(offerIdMap[id]));

    return {
      ...res,
      matchingCourses,
    };
  });

  // combine salary and course data
  const result = courseData.map(({ _id, title }) => {
    const salaries = [];

    // aggregate matching salaries per course
    salaryData.forEach(({ salary, matchingCourses }) => {
      if (matchingCourses.has(_id)) {
        salaries.push(salary);
      }
    });

    // calculate the average salary
    const avgSalary = salaries.reduce((a, b) => a + b) / salaries.length;

    return {
      courseTitle: title,
      courseId: _id,
      avgSalary,
    };
  });

  _printTask(
    "m",
    "für alle Kurse (Titel ausgeben) das durchschnittliche Gehalt der Kursleiter, die ein Angebot dieses Kurses durchführen (nach diesem Durchschnitt aufsteigend sortiert"
  );
  console.table(result);
}

async function selectA() {
  const res = await _find("offers", {
    selector: {},
    fields: ["city"],
  });

  const cities = Array.from(new Set(res.docs.map((doc) => doc.city)));

  _printTask("a", "alle Orte, an denen Kurse durchgeführt werden");
  const results = cities.map((city) => ({
    city,
  }));
  console.table(results);
}

async function selectG() {
  const attendeesRes = await _find("attendees", {
    selector: {},
    fields: ["_id", "city", "name"],
  });

  const attendees = [];
  for (const attendee of attendeesRes.docs) {
    const offersRes = await _find("offers", {
      selector: {
        city: attendee.city,
        attendeeIds: {
          $in: [attendee._id],
        },
      },
      limit: 1,
    });

    if (offersRes.docs.length > 0) {
      attendees.push(attendee);
    }
  }

  _printTask(
    "g",
    "alle Teilnehmer, die einen Kurs am eigenen Wohnort gebucht haben"
  );
  const results = attendees.map((attendee) => ({
    name: attendee.name,
    city: attendee.city,
  }));
  console.table(results);
}

async function selectI() {
  const offersRes = await _find("offers", {
    selector: {},
    fields: ["courseId", "attendeeIds"],
  });

  const offers = offersRes.docs.filter((doc) => {
    return doc.attendeeIds.length >= 2;
  });

  const courseIds = Array.from(new Set(offers.map((offer) => offer.courseId)));

  const coursesRes = await _find("courses", {
    selector: {
      _id: {
        $in: courseIds,
      },
    },
    fields: ["title"],
  });

  _printTask(
    "i",
    "alle Kurse (egal welches Angebot) mit mindestens 2 Teilnehmern"
  );
  const results = coursesRes.docs.map((course) => ({
    title: course.title,
  }));
  console.table(results);
}

async function selectL() {
  const coursesRes = await _find("courses", {
    selector: {},
    fields: ["title", "preconditions"],
  });

  const courses = coursesRes.docs
    .filter((doc) => {
      return doc.preconditions.length >= 2;
    })
    .sort((a, b) => {
      return b.preconditions.length - a.preconditions.length;
    });

  _printTask(
    "l",
    "die Kurstitel mit der Anzahl der Voraussetzungen, die mindestens 2 Voraussetzungen haben. Die Ausgabe soll so erfolgen, dass die Kurse mit den meisten Voraussetzungen zuerst kommen"
  );
  const results = courses.map((course) => ({
    title: course.title,
    preconditionsCount: course.preconditions.length,
  }));
  console.table(results);
}

function _printTask(task, description) {
  console.log("-".repeat(50));
  console.log(`${task}) ${description}`);
  console.log("-".repeat(50));
}

async function updateA() {
  const loadOffers = () => {
    return _find("offers", {
      selector: {
        date: {
          $regex: "2023",
        },
      },
    });
  };

  const offersResBefore = await loadOffers();
  const allOffersBefore = await _find("offers", { selector: {} });

  _printTask("a", "alle Angebote vom Jahr 2023 auf das Jahr 2024");
  console.log("Offers in 2023 before update:");
  const before = offersResBefore.docs.map((doc) => ({
    _id: doc._id,
    date: doc.date,
  }));
  console.table(before);

  const updates = [];
  for (const offer of offersResBefore.docs) {
    const newDate = offer.date.replace("2023", "2024");

    const update = fetch(`${URL}/offers/${offer._id}`, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
        "If-Match": offer._rev,
      },
      body: JSON.stringify({
        ...offer,
        date: newDate,
      }),
    });
    updates.push(update);
  }

  await Promise.all(updates);

  const offersResAfter = await loadOffers();
  console.log("Offers in 2023 after update:");
  const after = offersResAfter.docs.map((doc) => ({
    _id: doc._id,
    date: doc.date,
  }));
  console.table(after);

  // print all offers before and after
  const allOffersAfter = await _find("offers", { selector: {} });
  console.log("All offers before update:");
  console.table(allOffersBefore.docs);
  console.log("All offers after update:");
  console.table(allOffersAfter.docs);
}

async function updateB() {
  const offersRes = await _find("offers", {
    selector: {
      city: {
        $regex: "Wedel",
      },
    },
  });

  const allOffersBefore = await _find("offers", { selector: {} });

  _printTask(
    "b",
    "alle Angebote, die bisher in Wedel angeboten wurden, sollen jetzt in Augsburg stattfinden"
  );
  console.log('offers in "Wedel" (before the update):');
  console.table(offersRes.docs);

  const updates = [];
  offersRes.docs.forEach((offer) => {
    // const newValue = offer.date.replace("Wedel", "Augsburg")

    const update = fetch(`${URL}/offers/${offer._id}`, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
        "If-Match": offer._rev,
      },
      body: JSON.stringify({
        ...offer,
        city: "Augsburg",
      }),
    });
    updates.push(update);
  });

  await Promise.all(updates);

  const offersResAfter = await _find("offers", {
    selector: {
      city: {
        $regex: "Wedel",
      },
    },
  });

  console.log('offers in "Wedel" (after the update):');
  console.table(offersResAfter.docs);

  // print all offers before and after
  const allOffersAfter = await _find("offers", { selector: {} });
  console.log("All offers before update:");
  console.table(allOffersBefore.docs);
  console.log("All offers after update:");
  console.table(allOffersAfter.docs);
}

async function deleteA() {
  const coursesRes = await _find("courses", {
    selector: {
      title: {
        $regex: "C-Programmierung",
      },
    },
  });

  _printTask("a", 'die Kursliteratur für den Kurs "C-Programmierung"');
  console.log('courses with title "C-Programmierung" (before)');
  console.table(coursesRes.docs);

  // we're not deleting, we're actually updating because we're working with documents
  const updates = [];
  coursesRes.docs.forEach((course) => {
    const update = fetch(`${URL}/courses/${course._id}`, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
        "If-Match": course._rev,
      },
      body: JSON.stringify({
        ...course,
        literature: null,
      }),
    });
    updates.push(update);
  });

  await Promise.all(updates);

  const coursesResAfter = await _find("courses", {
    selector: {
      title: {
        $regex: "C-Programmierung",
      },
    },
  });

  console.log('courses with title "C-Programmierung" (after)');
  console.table(coursesResAfter.docs);
}

async function deleteB() {
  const offersRes = await _find("offers", {
    selector: {},
    fields: ["courseId", "attendeeIds"],
  });

  const whitelistedOffers = offersRes.docs.filter((doc) => {
    return doc.attendeeIds.length >= 2;
  });
  const whitelistedCourseIds = new Set(
    whitelistedOffers.map((doc) => doc.courseId)
  );

  const blacklistedOffers = offersRes.docs.filter((doc) => {
    return doc.attendeeIds.length < 2;
  });

  const deleteableCourseIds = new Set();
  for (const offer of blacklistedOffers) {
    if (whitelistedCourseIds.has(offer.courseId)) {
      continue;
    }

    deleteableCourseIds.add(offer.courseId);
  }

  const coursesResBefore = await loadCourses(deleteableCourseIds);

  _printTask("b", "alle Kurse mit weniger als zwei Teilnehmern");
  console.log("Courses with less than two attendees before delete:");
  const before = coursesResBefore.docs.map((doc) => ({
    _id: doc._id,
    title: doc.title,
  }));
  console.table(before);

  const deletes = [];
  for (const course of coursesResBefore.docs) {
    const deleteOp = fetch(`${URL}/courses/${course._id}`, {
      method: "DELETE",
      headers: {
        ...getAuthHeaders(),
        "If-Match": course._rev,
      },
    });
    deletes.push(deleteOp);
  }

  await Promise.all(deletes);

  const coursesResAfter = await loadCourses(deleteableCourseIds);
  console.log("Courses with less than two attendees after delete:");
  const after = coursesResAfter.docs.map((doc) => ({
    _id: doc._id,
    title: doc.title,
  }));
  console.table(after);
}

main();
