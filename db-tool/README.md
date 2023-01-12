# db-tool

## Setup

- Make sure to run `npm install` once within this directory to install required dependencies (currently only `node-fetch` is used to provide a polyfill for `fetch` in Node.js)
- run the cli insert command (if this failes, the db is already inserted/initialized)

## Usage

```bash
COUCHDB_USER=admin COUCHDB_PASSWORD=password node src/main.mjs {insert | drop | select | update | delete | reset}
```

- __insert__: to initialize the DBs with the given data
- __drop__: to drop all DBs
- __select__ _assignment_letter_: to execute a specific select with the given assigment letter
- __update__ _assignment_letter_: to execute a specific update with the given assigment letter
- __delete__ _assignment_letter_: to execute a specific delete with the given assigment letter
- __reset__: to both drop and re-initialize the DBs with the given data
