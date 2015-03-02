var MongoClient = require('mongodb').MongoClient;

var streamCSV = require("node-stream-csv"),
	fs = require("fs");

var argv = require('minimist')(process.argv.slice(2));

// just mapping valid arguments to functions here
var commands = {
	all: vaccines,
	vaccines: vaccines,
	public_addresses: public_addresses,
	private_addresses: private_addresses,
	frpm: frpm
}

// Connect to the db
MongoClient.connect("mongodb://localhost:27017/vaccines", function(err, db) {
	if (err) {
		console.log(err);
		return;
	}

	if (commands.hasOwnProperty(argv._[0])) {
		commands[argv._[0]](db, argv._[0]);
	}
});

function vaccines(db, command) {
	var collection = db.collection("california"),
		count = 0;
	
	streamCSV(__dirname + "/formatted/2014-15 CA Kindergarten Data.csv", function(line) {
		// let's bundle a bit for legibility

		// these are the rates of individual vaccinations
		line.vaccinations = {};
		["DTP", "Polio", "MMR", "HEPB", "VARI"].forEach(function(vaccine) {
			line.vaccinations[vaccine] = {
				value: line[vaccine],
				percent: line[vaccine + "_percent"]
			};
			delete line[vaccine];
			delete line[vaccine + "_percent"];
		});

		// these are the percentages to 
		line.vaccination_status = {};
		["up_to_date", "conditional", "permanent_medical_exemption", "personal_belief_exemption"].forEach(function(status) {
			line.vaccination_status[status] = {
				value: line[status],
				percent: line[status + "_percent"]
			};
			delete line[status];
			delete line[status + "_percent"];
		});

		line.personal_belief_exemption = {};
		["personal_belief_exemption_PreJan", "personal_belief_exemption_HC", "personal_belief_exemption_religious"].forEach(function(personal_belief_exemption_type) {
			line.personal_belief_exemption[personal_belief_exemption_type.replace("personal_belief_exemption_", "")] = {
				value: line[personal_belief_exemption_type],
				percent: line[personal_belief_exemption_type + "_percent"]
			};
			delete line[personal_belief_exemption_type];
			delete line[personal_belief_exemption_type + "_percent"];
		});

		line._id = line.school_code;

		collection.save(line, { continueOnError: true }, function(err, success) {
			if (success) {
				count += 1;
				process.stdout.write("Imported vaccination data for " + count + " schools.\r");
			}
		});
	}, function() {
		process.stdout.clearLine();
		console.log("Imported vaccination data for " + count + " schools.\r");
		if (command === "all") {
			public_addresses(db, command);
		} else {
			db.close();			
		}
	});	
}

function public_addresses(db, command) {
	var collection = db.collection("california"),
		count = 0;
	
	streamCSV(__dirname + "/formatted/pubschls.csv", function(line) {
		var _id = String(line.CDSCode).slice(-7);

		var address = {
			street: line.Street,
			city: line.City,
			state: line.State,
			zip: line.Zip
		};

		var coordinates = {
			latitude: line.Latitude,
			longitude: line.Longitude			
		};

		var contact = {
			phone: line.Phone,
			name: line.AdmFName1 + " " + line.AdmLName1,
			email: line.AdmEmail1			
		};

		// might as well import this bureaucratic info in case we ever need it
		var status = {
			charter: line.Charter,
			grades: line.GSoffered,
			funding: line.FundingType,
			virtual: line.Virtual,
			DOC: {
				code: line.DOC,
				type: line.DOCType
			},
			SOC: {
				code: line.SOC,
				type: line.SOCType
			},
			EdOps: {
				code: line.EdOpsCode,
				type: line.EdOpsName
			}
		}

		// add to records
		collection.update({ _id: parseInt(_id, 10) }, {
			$set: {
				district_id: line["NCESDist"],
				contact: contact,
				address: address,
				coordinates: coordinates,
				status: status
			}
		}, function(err, success) {
			if (success) {
				count += 1;
			}
			process.stdout.write("Imported location data for " + count + " public schools.\r");
		});
	}, function() {
		process.stdout.clearLine();
		console.log("Matched addresses for", count, "public schools in the vaccine database.");
		if (command === "all") {
			private_addresses(db, command);
		} else {
			db.close();			
		}
	});
}

function private_addresses(db, command) {
	var collection = db.collection("california"),
		count = 0;
	
	streamCSV(__dirname + "/formatted/privateschools1314.csv", function(line) {
		var _id = String(line.CDSCode).slice(-7);

		var address = {
			street: line.Street,
			city: line.City,
			state: line.State,
			zip: line.Zip
		};

		var contact = {
			phone: line.Telephone,
			name: line.AdmFName1 + " " + line.AdmLName1,
			email: line.AdmEmail1			
		};

		var status = {
			coeducation: line.School_Type,
			accommodations: line.Accommodations,
			tax_exempt: line["Tax Exempt"],
			religious: line["Religious Classification"],
			denomination: line.Denomination
		}

		collection.update({ _id: parseInt(_id, 10) }, {
			$set: {
				contact: contact,
				address: address,
				status: status,
				district: line.Public_District
			}
		}, function(err, success) {
			if (success) {
				process.stdout.write("Imported location data for " + count + " private schools.\r");
				count += 1;
			}
		});
	}, function() {
		process.stdout.clearLine();
		console.log("\rMatched addresses for", count, "private schools");
		if (command === "all") {
			frpm(db, command);
		} else {
			db.close();			
		}
	});
}

function frpm(db, command) {
	var collection = db.collection("california"),
		count = 0;

	streamCSV(__dirname + "/formatted/frpm1314.csv", function(line) {
		var free_reduced_lunch = {
			unadjusted: line.frpm_count_unadjusted,
			adjusted: line.frpm_count_adjusted,
			percent: parseFloat(line.frpm_count_adjusted_percent)
		};

		collection.update({ _id: line.school_code }, {
			$set: {
				free_reduced_lunch: free_reduced_lunch
			}
		}, function(err, success) {
			if (success) {
				process.stdout.write("Imported free/reduced lunch data for " + count + " public schools.\r");
				count += 1;
			}
		});		
	}, function() {
		process.stdout.clearLine();
		console.log("\rMatched free/reduced for", count, "public schools");
		db.close();
	});
}