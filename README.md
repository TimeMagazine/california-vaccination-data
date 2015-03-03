California Vaccine Data
=====

The California Department of Public Health publishes [data](http://www.cdph.ca.gov/programs/immunize/pages/immunizationlevels.aspx) on the vaccination levels for child care centers, kindergarten students and seventh grade students. These are the scripts that TIME used to collate the data for [these infographics](http://time.com/3728434/california-vaccination-rates/).

##Can I use this however I want?

Yes, while you should always check our work, these scripts use data in the public domain and are [MIT licensed](LICENSE.md). That said, we politely encourage you to link to the above article if you do make use of this data.

##I don't care how you did it, just show me the data

No problem. Would you like [JSON](/data/json/california_vaccine_data.json) or [CSV](/data/csv/california_vaccine_data.csv)?

##Are you interested in my own analysis of the data?
Absolutely! Feel free to open issues, submit PRs, or fire a note to Chris Wilson at <mailto:chris.wilson@time.com>. We would love to publish your own insights (with full credit and consultation, of course).

##Actually, I'd like to recreate this data from scratch.

Great! The Excel files in `/raw/` are unmodified from the source. The CSV files in `/formatted/` are hand-modified to get rid of nasty Excel formatting and ungainly joined columns but are otherwise unchanged.

###Data source files

+ **2014-15 CA Kindergarten Data.csv**: The [vaccination data](http://www.cdph.ca.gov/programs/immunize/pages/immunizationlevels.aspx) for all California kindergarten students.

+ **pubschls.csv**: The [location data](http://www.cde.ca.gov/ds/si/ds/fspubschls.asp) for every public school in California

+ **privateschools1314.csv**: The [location data](http://www.cde.ca.gov/ds/si/ps/) for private schools

+ **frpm1314.csv**: Free and reduced meal counts from [California DoE](http://www.cde.ca.gov/ds/sd/sd/filessp.asp)

###Building from scratch

You need to have Node.js installed and a local instance of MongoDB running. Then:

	npm install
	node import.js 	#ingest all of the CSV files into a clear, semantically named Mongo database called "vaccines"
	node geocode.js #geocode the ~1100 schools that don't already have lat/lng coordinates.
	node classify.js export #write the data to CSV and JSON files

Before geocoding, we strongly recommend you get a [free API key from Google](https://console.developers.google.com) for geocoding and store it in `api.json` in the root directory of this repo, like so:

	{
		"apiKey": "AopiuasdfAn;lkfdsanfqldasf"
	}

###Classification

The `classify.js` tool also has some nifty functions for slicing and dicing schools by different characteristics and looking at vaccination rates by group. For example:

	node classify.js charter
	# wrote data/csv/charter.csv and data/json/charter.json
	cat data/json/charter.json

	###
	[
	  {
	    "classification": "Non-charter",
	    "schools": 5067,
	    "students": 454621,
	    "personal_belief_exemption": 8047,
	    "rate": 0.017700458183849844
	  },
	  {
	    "classification": "Charter",
	    "schools": 577,
	    "students": 38977,
	    "personal_belief_exemption": 3246,
	    "rate": 0.08327988300792775
	  }
	]
	###

