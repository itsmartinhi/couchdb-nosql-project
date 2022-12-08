if [[ -z "${COUCHDB_USER}" || -z "${COUCHDB_PASSWORD}" ]]; then
    echo "Missing environment variable COUCHDB_USER and/or COUCHDB_PASSWORD"
    echo ""
    echo "Set them either before running this script (1) or export them for the current shell session (2):"
    echo "1) COUCHDB_USER=... COUCHDB_PASSWORD=... ./start-db.sh"
    echo ""
    echo "2) export COUCHDB_USER=..."
    echo "export COUCHDB_PASSWORD=..."
    echo "./start-db.sh"
else
    res=$(docker start hsa-couchsurfer 2> /dev/null)

    if [[ -z $res ]]; then
        docker run -e COUCHDB_USER=${COUCHDB_USER} -e COUCHDB_PASSWORD=${COUCHDB_PASSWORD} -p 5984:5984 --name hsa-couchsurfer -d couchdb:latest
    fi
fi
