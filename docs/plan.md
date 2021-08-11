## Data Required by Front-end

based on time ranges we need:

### Summary

- total eviction filings for selected geography
  - sum all filing counts from map data (done on front-end)
  - OR query total from database (should remain the same regardless of region?)
- total eviction filing rate for selected geography
  - average all filing rates from map data
  - OR query total from database (should remain the same regardless of region?)

### Map

- eviction filing count for each geographic entity
  - pulled from database
- eviction filing rate for each geographic entity
  - total filings in range fetched from database
  - GeoJSON property containing the denominator (population)

### Location

- all demographic metrics for a location
  - pulled from GeoJSON properties
- eviction filings per day for a location
  - pulled from database


## Data Sources

### Filing data (CSV)

Filing data will be loaded into a PostgreSQL compatible database (AWS Aurora Serverless), that is accessed via REST API (see API endpoints for more).  A scheduled task will be configured that reloads the database with the latest data from a CSV every day.  Location of the CSV data file is TBD (could be github or AWS S3).

**CSV Data Structure**

| column      | type          | notes                        |
| :---------- | :------------ | :--------------------------- |
| case_number | `text`  | unique identifier for the filing
| county_id   | `text`  | identifier for county this filing belongs to
| tract_id    | `text` | identifier for tract this filing belongs to
| city_id     | `text` | identifier for city that this filing belongs to
| date        | `date`        | ISO 8601 format (yyyy-mm-dd) |
| amount      | `numeric`     | filing amount
| lat | `numeric` | latitude (might not be used, but include just in case) |
| lon | `numeric` | longitude (might not be used, but include just in case)  |

> note: an identifier will need to be added for each level of geography that will be mapped (e.g. zip_id, city_council_id, etc.)

### Demographic Data + Geometry (GeoJSON)

For each level of geography that will be mapped, a GeoJSON file is required that contains a feature for each geographic entity.  Each feature will contain the geometry of the geographic entity and a series of data properties.

**Feature Properties**

| property      | type          | notes                        |
| :---------- | :------------ | :--------------------------- |
| id          | `varchar`     | a unique identifier (usually GEOID or FIPS), should correspond to a location identifier in the CSV data
| name | `text` | name corresponding to the geographic area
| pop   | `numeric`  | population for the geographic area.  this will be used to calculate filing rates
| pvr    | `numeric` | poverty rate
| prh     | `numeric` | % renter homes
| mgr        | `numeric` | media gross rent |
| mpv      | `numeric`     | median property value
| rb | `numeric` | rent burden |
| mhi | `numeric` | median household income
| pca |  `numeric` | percent Asian
| pcb |  `numeric` | percent Black
| pcl | `numeric` | percent Latinx
| pc* | `numeric` | replace * with appropriate character for any additional race/ethnicity metrics

> Note: feature properties are limited to 3 character to reduce file size.

## API Endpoints

- `/median`
- `/evictions`


## Unknowns

- rate calculations: use population, or # of renters?
- which race/ethnicity groups?