# Data API + Infrastructure

The following data infrastructure will be built by the Hyperobjekt team under an AWS account owned by the CPAL team.

## Eviction Filings Database

The CSV filings data will be loaded into a PostgreSQL compatible database provided by AWS Aurora Serverless. A Github action is configured on the [cpal-evictions](https://github.com/childpovertyactionlab/cpal-evictions) repository that refreshes the database whenever new data is committed.

## REST API

The REST API will provide public endpoints for querying eviction filing data. The rest API utilizes the AWS Aurora Servelss Database, AWS Lambda, and AWS API Gateway. The infrastructure is created using the

### Evictions Summary Endpoint

- **URL:** https://cnvdr1v7ki.execute-api.us-east-1.amazonaws.com/summary
- **Query Params:**
  - `region`: a region identifier (e.g. tracts). if no region is provided, an overall summary of the data will be provided.
  - `start`: a start date for the date range in ISO 8601 format (e.g. 2021-07-11). if no start date is provided, 30 days prior to the current date will be used.
  - `end`: an end date for the date range in ISO 8601 format (e.g. 2021-07-25). if no end date is provided, the current date will be used.
- **Result:**
  - `id`: identifier corresponding to the region
  - `ef`: the number of eviction filings within the region in the given time range
  - `mfa`: the median filing amount for the region in the given time range
  - `tfa`: the total filing amount for the region in the given time range

**Example Query:** county level summary from 2021-07-11 to 2021-07-25

https://cnvdr1v7ki.execute-api.us-east-1.amazonaws.com/summary?region=counties&start=2021-07-11&end=2021-07-25

**Response:**

```json
{
  "start": "2021-07-11",
  "end": "2021-07-25",
  "region": "counties",
  "result": [
    { "id": "48113", "ef": 1121, "mfa": 1559, "tfa": 2502094.29 },
    { "id": "48439", "ef": 710, "mfa": null, "tfa": null },
    { "id": "48085", "ef": 244, "mfa": null, "tfa": null },
    { "id": "48121", "ef": 237, "mfa": null, "tfa": null }
  ]
}
```

### Evictions Time Series Endpoint

- **URL:** https://cnvdr1v7ki.execute-api.us-east-1.amazonaws.com/filings
- **Query Params:**
  - `region` (optional): a region identifier (e.g. tracts). if no region is provided, an overall time series of the data will be provided.
  - `start`: a start date for the date range in ISO 8601 format (e.g. 2021-07-11). if no start date is provided, January 1, 2021 will be used.
  - `end`: an end date for the date range in ISO 8601 format (e.g. 2021-07-25). if no end date is provided, the current date will be used.
- `location` (optional): a location identifier to retrieve data for. if no id is provided, data will consist of totals for the entire region.
- **Result:** the result is an array containing an entry for each day in the given time range
  - `id`: identifier for the region
  - `date`: the day the values correspond to
  - `ef`: the number of eviction filings within the region in the given time range
  - `mfa`: the median filing amount for the region in the given time range
  - `tfa`: the total filing amount for the region in the given time range

**Example Query URL:** Data by day for Dallas County (48113) starting July 1, 2021

`https://cnvdr1v7ki.execute-api.us-east-1.amazonaws.com/filings?region=counties&location=48113&start=2021-07-01`

**Response:**

```json
{
  "start": "2021-07-01",
  "end": "2021-07-23",
  "region": "counties",
  "location": "48113",
  "result": [
    {
      "id": "48113",
      "date": "2021-07-23",
      "ef": 58,
      "mfa": 1589,
      "tfa": 158349.47
    },
    {
      "id": "48113",
      "date": "2021-07-22",
      "ef": 82,
      "mfa": 1832,
      "tfa": 186186.26
    },
    {
      "id": "48113",
      "date": "2021-07-21",
      "ef": 97,
      "mfa": 1923.5,
      "tfa": 245518.51
    },
    {
      "id": "48113",
      "date": "2021-07-20",
      "ef": 89,
      "mfa": 1315,
      "tfa": 158882.51
    },
    {
      "id": "48113",
      "date": "2021-07-19",
      "ef": 106,
      "mfa": 1407.145,
      "tfa": 229764.66
    },
    {
      "id": "48113",
      "date": "2021-07-16",
      "ef": 142,
      "mfa": 1280,
      "tfa": 333074.39
    },
    {
      "id": "48113",
      "date": "2021-07-15",
      "ef": 137,
      "mfa": 1499.74,
      "tfa": 273755.06
    },
    {
      "id": "48113",
      "date": "2021-07-14",
      "ef": 143,
      "mfa": 1790,
      "tfa": 312064.76
    },
    {
      "id": "48113",
      "date": "2021-07-13",
      "ef": 141,
      "mfa": 1588,
      "tfa": 304161.33
    },
    {
      "id": "48113",
      "date": "2021-07-12",
      "ef": 126,
      "mfa": 1546.08,
      "tfa": 300337.34
    },
    {
      "id": "48113",
      "date": "2021-07-09",
      "ef": 140,
      "mfa": 1962.78,
      "tfa": 355141.59
    },
    {
      "id": "48113",
      "date": "2021-07-08",
      "ef": 68,
      "mfa": 849.5,
      "tfa": 138166.99
    },
    {
      "id": "48113",
      "date": "2021-07-07",
      "ef": 73,
      "mfa": 2490,
      "tfa": 179076.9
    },
    {
      "id": "48113",
      "date": "2021-07-06",
      "ef": 83,
      "mfa": 2054.83,
      "tfa": 192442.27
    },
    {
      "id": "48113",
      "date": "2021-07-02",
      "ef": 59,
      "mfa": 1185,
      "tfa": 139111.91
    },
    {
      "id": "48113",
      "date": "2021-07-01",
      "ef": 56,
      "mfa": 1145,
      "tfa": 120261.95
    }
  ]
}
```

### Static File Storage

Static file storage is used for storing source CSVs, GeoJSON files, and any other required data (e.g. search data). Currently, these files are stored in the [cpal-evictions repo](https://github.com/childpovertyactionlab/cpal-evictions)
