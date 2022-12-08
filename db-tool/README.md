# db-tool

## Setup

Make sure to run `npm install` once within this directory to install required dependencies (currently only `node-fetch` is used to provide a polyfill for `fetch` in Node.js)

## Usage

```bash
COUCHDB_USER=admin COUCHDB_PASSWORD=password node src/main.mjs {insert | drop}
```
