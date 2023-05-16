# North Texas Evictions Data Dictionary

## Filing data (CSV)

All eviction filing data will be provided in a **single** CSV file.

**CSV Data Structure ([NTEP_eviction_cases.csv](https://github.com/childpovertyactionlab/cpal-evictions/blob/main/filing%20data/NTEP_eviction_cases.csv))**

| column      | type      | notes                                                    |
| :---------- | :-------- | :------------------------------------------------------- |
| case_number | `text`    | unique identifier for the filing                         |
| date        | `date`    | ISO 8601 format (yyyy-mm-dd)                             |
| amount      | `numeric` | filing amount                                            |
| precinct_id | `text`    | identifier for the precinct this filing belongs to       |
| subprecinct_id | `text` | identifier for the subprecinct this filing belongs to    |
| council_id  | `text`    | identifier for the council regions the filing belongs to |
| tract_id    | `text`    | identifier for tract this filing belongs to              |
| zip_id      | `text`    | identifier for the zip code this filing belongs to       |
| city_id     | `text`    | identifier for city that this filing belongs to          |
| county_id   | `text`    | identifier for county this filing belongs to             |
| elem_id     | `text`    | identifier for the elem school the filing belongs to     |
| midd_id     | `text`    | identifier for the middle school the filing belongs to   |
| high_id     | `text`    | identifier for the high school the filing belongs to     |
| lon         | `numeric` | longitude (might not be used, but include just in case)  |
| lat         | `numeric` | latitude (might not be used, but include just in case)   |

> note: an identifier will need to be added for each level of geography that will be mapped (e.g. zip_id, city_council_id, etc.). Each identifier should be string that only includes numbers that can be cast to an integer.

### Demographic Data + Geometry (GeoJSON)

These GeoJSON files will be used for displaying choropleths on the map. For each level of geography that will be mapped, a GeoJSON file should be provided that contains a feature for each geographic entity. Each feature will contain the geometry (polygons) of the geographic entity and a series of data properties.

**Feature Properties**

| property | type      | notes                                                                                                   |
| :------- | :-------- | :------------------------------------------------------------------------------------------------------ |
| id       | `varchar` | a unique identifier (usually GEOID or FIPS), should correspond to a location identifier in the CSV data |
| name     | `text`    | name corresponding to the geographic area                                                               |
| pvr      | `numeric` | poverty rate                                                                                            |
| prh      | `numeric` | % renter homes                                                                                          |
| mgr      | `numeric` | media gross rent                                                                                        |
| mpv      | `numeric` | median property value                                                                                   |
| rb       | `numeric` | rent burden                                                                                             |
| mhi      | `numeric` | median household income                                                                                 |
| pca      | `numeric` | percent Asian                                                                                           |
| pcb      | `numeric` | percent Black                                                                                           |
| pcl      | `numeric` | percent Latinx                                                                                          |
| pc\*     | `numeric` | replace \* with appropriate character for any additional race/ethnicity metrics                         |

> Note: ideally feature properties are limited to 3 characters to reduce overall file size.

### Bubble Data + Geometry (GeoJSON)

These GeoJSON files will be used in conjunction with the eviction filings data to display bubble overlays on the map. For each level of geography that will be mapped, a GeoJSON file is required that contains a feature for each geographic entity. Each feature will contain a geometry attribute that contains the center point for a given geographic entity and a series of data properties.

**Feature Properties**

| property | type      | notes                                                                                                                              |
| :------- | :-------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| id       | `varchar` | a unique identifier (usually GEOID or FIPS), should correspond to a location identifier in the CSV data                            |
| name     | `text`    | name corresponding to the geographic area                                                                                          |
| pop      | `numeric` | a population metric (number of renting households) that is used to calculate rates based on the # of eviction filings for the area |



## Data Consumers (Front-end)

This section outlines where the data dashboard will pull data from for the various components that require data.

### Overall Summary

Data:

- total eviction filings, eviction filing rate, median filing amount for entire data set for a given time range
  - provided by endpoint (`/summary?start={START_DATE}&end={END_DATE}`)
  - we will need an overall population value for calculating the overall filing rate (could be retrieved by summing population value on all GeoJSON features)
- overall time series of eviction filings
  - provided by endpoint (`filings?start={START_DATE}&end={END_DATE})

Questions:

- will the values remain the same regardless of selected geography? assuming yes, but should confirm (e.g. if viewing cities some eviction filings may not fall within a city boundary, should these filings be included in the overall summary?)

### Map

Data:

- bubbles: eviction filing count, rate, median filing amound for each geographic entity for a given time range
  - pulled from endpoint (`/summary?region={REGION}&start={START_DATE}&end={END_DATE})
  - GeoJSON property containing population will be used for filing rate (population or # of renters?)
- choropleths: demographic data (poverty rate, % renter homes, etc)
  - pulled from GeoJSON feature property

### Location Details

Data:

- all demographic metrics for a location
  - pulled from GeoJSON properties
- time series data for a location (filings, filing rate?, median filing amount?)
  - pulled from endpoint (`/filings?region=tracts&id=48113003400`)

### Search

- all available place names and associated identifiers
  - loaded from static file (TBD)
- Mapbox geocoding API used to map searched addresses to lat/lon
