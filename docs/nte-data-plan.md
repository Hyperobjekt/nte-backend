# NTE Data Plan

## Data Sources

These data sources will be provided by the CPAL team.

### Filing data (CSV)

All eviction filing data will be provided in a **single** CSV file.

**CSV Data Structure**

| column      | type      | notes                                                   |
| :---------- | :-------- | :------------------------------------------------------ |
| case_number | `text`    | unique identifier for the filing                        |
| county_id   | `text`    | identifier for county this filing belongs to            |
| tract_id    | `text`    | identifier for tract this filing belongs to             |
| city_id     | `text`    | identifier for city that this filing belongs to         |
| date        | `date`    | ISO 8601 format (yyyy-mm-dd)                            |
| amount      | `numeric` | filing amount                                           |
| lat         | `numeric` | latitude (might not be used, but include just in case)  |
| lon         | `numeric` | longitude (might not be used, but include just in case) |

> note: an identifier will need to be added for each level of geography that will be mapped (e.g. zip_id, city_council_id, etc.)

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

| property | type      | notes                                                                                                   |
| :------- | :-------- | :------------------------------------------------------------------------------------------------------ |
| id       | `varchar` | a unique identifier (usually GEOID or FIPS), should correspond to a location identifier in the CSV data |
| name     | `text`    | name corresponding to the geographic area                                                               |
| pop      | `numeric` | a population metric that is used to calculate rates based on the # of eviction filings for the area     |

## Data Infrastructure + Providers

The following data infrastructure will be built by the Hyperobjekt team under an AWS account owned by the CPAL team.

### Eviction Filings Database

The CSV filings data will be loaded into a PostgreSQL compatible database provided by AWS Aurora Serverless. A scheduled task will be configured that reloads the database with the latest data from a CSV every day. Location of the CSV data file is TBD (could be github or AWS S3, see static file storage below).

### REST API

The REST API will provide public endpoints for querying eviction filing data. The rest API will be built using AWS Lambda and AWS API Gateway. An endpoint will be provided for queries, with the following optional query parameters:

- `region`: a region identifier (e.g. tracts). if no region is provided, an overall summary of the data will be provided.
- `start`: a start date for the date range in ISO 8601 format (e.g. 2021-07-11). if no start date is provided, 30 days prior to the current date will be used.
- `end`: an end date for the date range in ISO 8601 format (e.g. 2021-07-25). if no end date is provided, the current date will be used.

**Sample query URL:**

`https://domain.com/summary?region=tracts&start=2021-07-11&end=2021-07-25`

**Sample Response:**

```json
[
  {
    "id": "48113003400",
    "filings": 214,
    "median_amount": 560.00
  },
  {
    "id": "48113002701",
    "filings": 94,
    "median_amount": 920.50
  },
  ...
]
```

In addition to the base endpoint, there will be an additional endpoint for retrieving time series data. The query parameters remain the same, with the addition of one parameter:

- `id`: a location identifier to retrieve data for. if no id is provided, data will consist of totals for the entire region.

**Sample query URL:**

`https://domain.com/filings?region=tracts&start=2021-07-11&end=2021-07-25&id=48113003400`

**Sample Response:**

```json
[
  {
    "id": "48113003400",
    "date": "2021-07-11",
    "filings": 3,
    "median_amount": 290.00
  },
  {
    "id": "48113003400",
    "date": "2021-07-12",
    "filings": 6,
    "median_amount": 450.50
  },
  ...
]
```

### Static File Storage

Static file storage will be required for storing source CSVs, GeoJSON files, and any other required data (e.g. search data). The location of where these files is still to be determined, but the most preferrable options would be Github (if file size does no exceed thresholds) or AWS S3 if larger file storage is required.

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
