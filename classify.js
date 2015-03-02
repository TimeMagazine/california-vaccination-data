/*
Subdivide the schools into groups and look at the average vaccinate rates for each group

A classification function accepts a record for an individual schools and returns:
	- `null` if that school doesn't belong in any category; or
	- a value that represents the group the school belongs to

For example, looking at just private schools and classifying them by religious/non-religious:

function is_religious(doc) {
	if (doc.type === "PUBLIC") {
		return null;
	}
	if (doc.status.religious === "" || doc.status.religious === "Non-religious") {
		return "Non-religious";
	}
	return "Religious";
}

*/

var MongoClient = require('mongodb').MongoClient;
var argv = require('minimist')(process.argv.slice(2));
var fs = require("fs");
var d3 = require("d3");

var classification_functions = {
	every_school: function(d) { return 1; },
	public_private: function(d) { return toTitleCase(d.type); },
	is_religious: is_religious,
	religion: religion,
	frpm: frpm,
	school_size: school_size,
	charter: charter,
	by_keyword: by_keyword
}

// Connect to the db
MongoClient.connect("mongodb://localhost:27017/vaccines", function(err, db) {
	if (err) {
		return;
	}

	if (argv._[0] === "export") {
		write_csv(db);
		return;
	}

	if (argv._[0] === "all") {
		var count = 0,
			output = {};

		Object.keys(classification_functions).forEach(function(classification_function) {
			count += 1;
			classify(db, classification_function, function(data) {
				data = data.filter(function(d) {
					return d.students >= 100 && d.schools >= 10;
				});
				output[classification_function] = data;
				console.log("Ran " + Object.keys(output).length + " of " + count + " classification functions.");
				if (Object.keys(output).length === count) {
					// this looks sloppy, but we legtimately want to sort differently depending on the classification type
					// this is mainly for having a legible order of labels on the eventual y axis

					output.public_private.sort(function(a, b) { return d3.ascending(a.classification, b.classification); });
					output.charter.sort(function(a, b) { return d3.ascending(a.classification, b.classification); });
					output.is_religious.sort(function(a, b) { return d3.descending(a.classification, b.classification); });
					output.religion.sort(function(a, b) { return d3.descending(a.classification, b.classification); });
					output.school_size.sort(function(a, b) { return parseInt(b.classification.split("-")[0]) - parseInt(a.classification.split("-")[0]); });
					output.frpm.sort(function(a, b) { return d3.descending(a.classification, b.classification); });
					output.by_keyword.sort(function(a, b) { return d3.descending(a.classification, b.classification); });

					fs.writeFileSync("data/json/vaccination_by_classification.json", JSON.stringify(output, null, 2));
					console.log("wrote vaccination_by_classification.json");
					db.close();
				}
			});
		});
	}

	if (classification_functions[argv._[0]]) {
		classify(db, argv._[0], function(data) {
			fs.writeFileSync("./data/json/" + argv._[0] + ".json", JSON.stringify(data, null, 2));
			fs.writeFileSync("./data/csv/" + argv._[0] + ".csv", d3.csv.format(data));
			console.log("wrote data/csv/" + argv._[0] + ".csv and data/json/" + argv._[0] + ".json");
			db.close();
		})
	}

});

function write_csv(db) {
	var collection = db.collection("california");

	collection.find({ "coordinates": { $ne: null }, reported: "Y" }).toArray(function(err, docs) {
		var output = docs.map(function(doc) {
			return {
				id: doc._id,
				name: doc.name,
				district: doc.district,
				city: doc.city,
				enrollment: doc.enrollment,

				up_to_date_count: doc.vaccination_status.up_to_date.value,
				conditional_count: doc.vaccination_status.conditional.value,
				personal_belief_exemption_count: doc.vaccination_status.personal_belief_exemption.value,
				permanent_medical_exemption_count: doc.vaccination_status.permanent_medical_exemption.value,

				up_to_date_percent: doc.vaccination_status.up_to_date.percent,
				conditional_percent: doc.vaccination_status.conditional.percent,
				personal_belief_exemption_percent: doc.vaccination_status.personal_belief_exemption.percent,
				permanent_medical_exemption_percent: doc.vaccination_status.permanent_medical_exemption.percent,

				type: doc.type,
				is_religious: is_religious(doc),
				religion: religion(doc),
				frpm_percent: doc.free_reduced_lunch? doc.free_reduced_lunch.percent : null,
				latitude: doc.coordinates.latitude,
				longitude: doc.coordinates.longitude
			}	
		});
		fs.writeFileSync("./data/csv/california_vaccine_data.csv", d3.csv.format(output));
		fs.writeFileSync("./data/json/california_vaccine_data.json", JSON.stringify(output, null, 2));
		console.log("Wrote data to data/json/california_vaccine_data.json and data/csv/california_vaccine_data.csv");
		db.close();
	});
}

function classify(db, classification_function_name, callback) {
	var collection = db.collection("california"),
		classification_function = classification_functions[classification_function_name],
		data = {};

	collection.find({ reported: "Y", status: { $ne: null } }).toArray(function(err, docs) {
		docs.forEach(function(doc) {
			var classifications = classification_function(doc);
			if (classifications === null) {
				return;
			}
			if (typeof classifications === "string" || typeof classifications === "number") {
				classifications = [classifications];
			}
			classifications.forEach(function(classification) {
				data[classification] = data[classification] || { classification: classification, schools: 0, students: 0, personal_belief_exemption: 0 };
				data[classification].schools += 1;
				data[classification].students += doc.enrollment;
				data[classification].personal_belief_exemption += doc.vaccination_status.personal_belief_exemption.value;
			});
		});

		data = d3.values(data).sort(function(a, b) { return b.schools - a.schools; });

		data.forEach(function(d) {
			d.rate = d.personal_belief_exemption / d.students
		});

		callback(data);
	});
}

function religion(doc) {
	// some simplification, in consultation with TIME religion experts
	var map = {
		"Assembly of God": "Pentecostal",
		"Charismatic": "Pentecostal",
		"Church of the Four Square Gospel": "Pentecostal",
		"Apostolic": "Pentecostal",
		"Interdenominational": "Other/Interdenominational",
		"Other": "Other/Interdenominational",
		"Not affiliated with any denominationZ": "Not affiliated with any denomination"
	}

	if (doc.type === "PUBLIC") {
		return null;
	}
	if (doc.status.religious === "" || doc.status.religious === "Non-religious") {
		return null;
	}
	return map[doc.status.denomination] || doc.status.denomination;
}

function is_religious(doc) {
	if (doc.type === "PUBLIC") {
		return null;
	}
	if (doc.status.religious === "" || doc.status.religious === "Non-religious") {
		return "Non-religious";
	}
	return "Religious";
}

function frpm(doc) {
	if (!doc.free_reduced_lunch) {
		return null;
	}
	var quantile = Math.floor(doc.free_reduced_lunch.percent / 20);
	return [
		"0-20%",
		"21-40%",
		"41-60%",
		"61-80%",
		"81-100%",
		"81-100%"
	][quantile];
}

function school_size(doc) {
	if (doc.type === "PRIVATE") {
		return null;
	}

	if (doc.enrollment >= 200) {
		return "200+";
	}
	var quartile = Math.floor(doc.enrollment / 25);

	return ((25 * quartile + 1) + "-" + (quartile + 1) * 25);
}

function charter(doc) {
	if (doc.type === "PRIVATE") {
		return null;
	}
	return doc.status.charter === "Y"? "Charter": "Non-charter"
}

function by_keyword(doc) {
	var names = [
		"MONTESSORI",
		"ARTS",
		"INTERNATIONAL",
		"SCIENCE",
		"TECHNOLOGY",
		"WALDORF",
		"ALTERNATIVE"
	];

	var keywords = [];
	names.forEach(function(name) {
		if (doc.name.indexOf(name) != -1) {
			keywords.push(name);
		}
	});
	return (keywords.length > 0? keywords : null);
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}