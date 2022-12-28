# a. alle Orte, an denen Kurse durchgeführt werden.
# create a view for offers with a function that picks unique
# b. die Teilnehmer aus Augsburg.
curl -X POST -F '{
    "selector": {
        "city": {"$eq": "Augsburg"}
    },
}' http://127.0.0.1:5984/couchsurfer/attendees/_find
# c. die Kursleiter mit einem Gehalt zwischen 3000 € und 4000 €, sortiert nach Namen.
curl -X POST -F '{
    "selector": {
          "salary": {
          "$in": [3000, 4000]
        }
    },
}' http://127.0.0.1:5984/couchsurfer/employees/_find
# d. die Kurstitel mit Datum und Ort, an dem sie stattfinden.
# create View? 