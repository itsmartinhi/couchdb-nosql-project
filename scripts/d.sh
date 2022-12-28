#!/bin/bash

# select every course title with date and location

BASE_URL="http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@localhost:5984"
DB="courses"

QUERY_URL=$BASE_URL/$DB/_find

curl -X POST $QUERY_URL \
    -H "Content-Type: application/json" \
    -d '{"selector":{} "fields": ["name"]}'