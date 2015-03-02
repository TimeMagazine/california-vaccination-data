// Many California public schools are already geocoded, but we need to get coordinates for the schools without pre-supplied coordinates

// did you give us an API key in api.json? It should look like this:
/*
{
	"apiKey": "AopiuasdfAn;lkfdsanfqldasf"
}

Oh, and you really should. It's free: https://console.developers.google.com
*/

var fs = require("fs");

fs.readFile("./api.json", function(err, apiFile) {
	if (err) {
		var geocoder = require('node-geocoder').getGeocoder("google", "https");		
	} else {
		var apiKey = JSON.parse(apiFile).apiKey;
		var geocoder = require('node-geocoder').getGeocoder("google", "https", {
		 	apiKey: apiKey
		});
	}

	var MongoClient = require('mongodb').MongoClient;

	// Connect to the db
	MongoClient.connect("mongodb://localhost:27017/vaccines", function(err, db) {
		if (err) {
			return;
		}

		var collection = db.collection("california"),
			count = 0,
			found = 0,
			missed = 0;

		collection.find({ $or: [ { "coordinates.latitude": null }, { "coordinates.latitude": "" } ], address: { $ne: null }, reported: "Y" }).limit(1100).toArray(function(err, docs) {
			count = docs.length;
			console.log("Found " + count + " schools in need of geocoding.");

			var batches = [],
				BATCH_SIZE = 10;

			// let's be kind to the Google API and send it addresses in batches of 10
			for (var c = 0; c < docs.length; c += BATCH_SIZE) {
				batches.push(docs.slice(c, c + BATCH_SIZE));
			}

			batches.forEach(function(docs, b) {
				var addresses = docs.map(function(doc) {
					return doc.address.street + ", " + doc.address.city + ", " + doc.address.state + " " + doc.address.zip;
				});

				// lazy rate limiting
				setTimeout(function() {
					geocoder.batchGeocode(addresses, function(err, response) {
						if (err) {
							console.log(err);
							missed += BATCH_SIZE;
							return;
						}

						response.forEach(function(address, index) {
							var doc = docs[index];
							//console.log(doc.name, doc.address.street, address.value[0].streetName);
							if (!address.error) {
								found += 1;
								collection.update({ _id: doc._id }, { $set: { coordinates: address.value[0] }}, function(err, success) {
									process.stdout.write("Found coordinates for " + found + " schools. Couldn't find them for " + missed + ").\r");
									if ((missed + found) === count) {
										db.close();
									}
								});
							} else {
								missed += 1;
							}
						});
					});							
				}, b * 1200);
			});
		});
	});
});
