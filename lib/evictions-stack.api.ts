import db from "./db";

interface EvictionLocationSummaryParams {
  start: string;
  end: string;
  zips?: string;
  counties?: string;
  tracts?: string;
  cities?: string;
  districts?: string;
  courts?: string;
  attendanceel?: string;
  attendancemi?: string;
  attendancehi?: string;
  format?: string;
}

interface EvictionQueryParams {
  start: string;
  end: string;
  region?: string;
  location?: string;
  format?: string;
}

interface EvictionQueryResult {
  id: string;
  filings: number;
  median_filed_amount: number;
  date?: string;
}

const REGION_MAP: any = {
  counties: "county",
  tracts: "tract",
  cities: "city",
  zips: "zip",
  districts: "council",
  courts: "precinct",
  attendanceel: "elem",
  attendancemi: "midd",
  attendancehi: "high",
  subprecints: "subprecinct",
};

const TABLE_NAME = `evictions_${process.env.STAGE}`;

/**
 * Parses the request parameters, and sets defaults if none are provided
 */
const getQueryParams = (params: any = {}): any => {
  return {
    ...params,
    start: params.start || "2021-01-01",
    end: params.end || new Date().toISOString().split("T")[0],
  };
};

/**
 * Checks if params are valid, and returns an error message if not
 * returns true if params are valid
 */
const areParamsValid = (params: any) => {
  const { region, start, end, location } = params;
  const validRegion = !region || region;
  if (!validRegion) return "invalid region";

  const validLocation =
    !location || (typeof location === "string" && /^\d+$/.test(location));
  if (!validLocation) return "invalid location";
  const validStart = !start || /^\d{4}-\d{2}-\d{2}$/.test(start);
  if (!validStart) return "invalid start date";
  const validEnd = !end || /^\d{4}-\d{2}-\d{2}$/.test(end);
  if (!validEnd) return "invalid end date";
  return true;
};

/**
 * Returns an SQL query string for the given parameters
 */
const getSummarySqlQuery = (params: EvictionQueryParams) => {
  const { region: regionParam } = params;
  const region = REGION_MAP[regionParam] || regionParam;
  let sqlQuery = region
    ? `
    SELECT
      region_ids->>'${region}_id' as ${region}_id,
      COUNT(case_number) as filings,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY amount) as median_filed_amount,
      SUM(amount) as total_filed_amount
    FROM ${TABLE_NAME}
    WHERE date BETWEEN :start AND :end
    GROUP BY ${region}_id
    ORDER BY filings DESC`
    : `
    SELECT
      COUNT(case_number) as filings,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY amount) as median_filed_amount,
      SUM(amount) as total_filed_amount
    FROM ${TABLE_NAME}
    WHERE date BETWEEN :start AND :end
    ORDER BY filings DESC`;
  return sqlQuery;
};

/**
 * Returns total counts of filings and overall median for the given parameters
 */
const getSummary = async (params: EvictionQueryParams) => {
  const { format, ...restParams } = params;
  const region = restParams.region;
  const sqlQuery = getSummarySqlQuery(restParams);
  console.log("performing query: %s", sqlQuery);
  const result = await query(sqlQuery, restParams);
  console.log("received records");
  const rows = Array.isArray(result)
    ? result.map(
      ({
        filings,
        median_filed_amount,
        total_filed_amount,
        ...rest
      }: any) => ({
        id: region ? rest[(REGION_MAP[region] || region) + "_id"] : "all",
        ef: filings,
        mfa: median_filed_amount && Number(median_filed_amount),
        tfa: total_filed_amount && Number(total_filed_amount),
      })
    )
    : result;
  if (format === "csv") return objectArrayToCsv(rows);
  return {
    ...restParams,
    result: rows,
  };
};

/**
 * Creates an SQL query for querying values by date for a collection of locations
 */
const getLocationsSummarySqlQuery = (params: any) => {
  const regions = [
    "zips",
    "county",
    "tracts",
    "cities",
    "districts",
    "attendanceel",
    "attendancemi",
    "attendancehi",
    "courts",
  ];
  const locationsQuery = regions
    .reduce((query: Array<string>, region) => {
      if (params.hasOwnProperty(region)) {
        const column = region + "_id";
        // wrap location IDs in quotes
        const values = params[region]
          .split(",")
          .map((v: any) => `'${v}'`)
          .join(",");
        query.push(`region_ids->>'${column}' IN (${values})`);
      }
      return query;
    }, [])
    .join(" OR ");

  let sqlQuery = `
    SELECT
      date,
      COUNT(case_number) as filings,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY amount) as median_filed_amount,
      SUM(amount) as total_filed_amount
    FROM ${TABLE_NAME}
    WHERE (date BETWEEN :start AND :end) AND (${locationsQuery})
    GROUP BY date
    ORDER BY date DESC`;
  console.log("locations query", sqlQuery, params);
  return sqlQuery;
};

/**
 * Gets the filings, median filing amount, and total filed amount by day
 * for a collection of locations.
 */
const getLocations = async (params: any) => {
  const { format, ...restParams } = params;
  const sqlQuery = getLocationsSummarySqlQuery(restParams);
  const result = await query(sqlQuery, restParams);
  const rows = result.map(
    ({ date, filings, median_filed_amount, total_filed_amount }: any) => ({
      date: date,
      ef: filings,
      mfa: median_filed_amount && Number(median_filed_amount),
      tfa: total_filed_amount && Number(total_filed_amount),
    })
  );
  if (format === "csv") return objectArrayToCsv(rows);
  return {
    ...restParams,
    result: rows,
  };
};

/**
 * Returns an SQL query for the given params
 */
const getFilingsSqlQuery = (params: EvictionQueryParams) => {
  const { region: regionParam, location } = params;
  const region = REGION_MAP[regionParam] || regionParam;

  let sqlQuery = region
    ? `
    SELECT
      region_ids->>'${region}_id' as ${region}_id,
      date,
      COUNT(case_number) as filings,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY amount) as median_filed_amount,
      SUM(amount) as total_filed_amount
    FROM ${TABLE_NAME}
    WHERE date BETWEEN :start AND :end
    GROUP BY ${region}_id,date
    ORDER BY date DESC`
    : `
    SELECT
      date,
      COUNT(case_number) as filings,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY amount) as median_filed_amount,
      SUM(amount) as total_filed_amount
    FROM ${TABLE_NAME}
    WHERE date BETWEEN :start AND :end
    GROUP BY date
    ORDER BY date DESC`;
  if (region && location)
    sqlQuery = sqlQuery.replace(
      /WHERE /g,
      `WHERE region_ids->>'${region}_id' = :location AND `
    );
  console.log("filings query", sqlQuery);
  return sqlQuery;
};

/**
 * Returns time series filing data for the given params
 */
const getFilings = async (params: EvictionQueryParams) => {
  const { format, ...restParams } = params;
  const sqlQuery = getFilingsSqlQuery(restParams);
  const region = restParams["region"] || "county";
  const result = await query(sqlQuery, restParams);
  const rows = result.map(
    ({
      date,
      filings,
      median_filed_amount,
      total_filed_amount,
      ...rest
    }: any) => ({
      id: rest[(REGION_MAP[region] || "county") + "_id"],
      date: date,
      ef: filings,
      mfa: median_filed_amount && Number(median_filed_amount),
      tfa: total_filed_amount && Number(total_filed_amount),
    })
  );
  if (format === "csv") return objectArrayToCsv(rows);
  return {
    ...restParams,
    result: rows,
  };
};

/**
 * Gets the total number of records along with min / max date
 * @returns
 */
const getMeta = async () => {
  const sqlQuery = `
    SELECT
      COUNT(case_number) as filings,
      MAX(date) as last_filing,
      MIN(date) as first_filing
    FROM ${TABLE_NAME}`;
  try {
    const { records } = await db.query(sqlQuery);
    console.log("got results: %j", records.length);
    return records;
  } catch (error) {
    return error.message;
  }
};

/**
 * Gets the total number of records along with min / max date
 * @returns
 */
const getPrecincts = async () => {
  const sqlQuery = `
    SELECT DISTINCT(precinct_id) FROM ${TABLE_NAME} ORDER BY precinct_id`;
  try {
    const { records } = await db.query(sqlQuery);
    console.log("got results: %j", records.length);
    return records;
  } catch (error) {
    return error.message;
  }
};

/**
 * Runs the query and returns the result
 */
async function query(sqlQuery: string, params: EvictionQueryParams) {
  // cast date strings to date objects for query
  const queryParams: any = {
    ...params,
    start: new Date(params.start),
    end: new Date(params.end),
  };
  try {
    const { records } = await db.query(sqlQuery, queryParams);
    console.log("got results: %j", records.length);
    return records;
  } catch (error) {
    console.error(error.message);
    // workaround for 1MB result limit: https://github.com/jeremydaly/data-api-client/issues/59#issuecomment-749793078
    if (
      error.message.includes(
        "Database returned more than the allowed response size limit"
      )
    ) {
      const getCount = async (_query: string) => {
        const query = `SELECT COUNT(*) FROM (${_query}) sub`;
        console.log("retrieving total amount of records: %s", query);
        const {
          records: [{ count }],
        } = await db.query(query, queryParams);
        return count;
      };
      let result: any = [];
      // Get result count
      const count = await getCount(sqlQuery);
      console.log("total number of records to retrieve: %s", count);
      // Define limit based on your average record size
      const limit = 10000;
      // Use limits and offsets to page through the query
      for (let page = 1; page <= Math.ceil(count / limit); page++) {
        const limitQuery = sqlQuery.replace(
          /;?$/,
          `\nLIMIT ${limit} OFFSET ${(page - 1) * limit};`
        );
        console.log("running limited query: %s", limitQuery);
        const { records } = await db.query(limitQuery, queryParams);
        result = [...result, ...records];
      }
      return result;
    }
    return error.message;
  }
}

/** Covert data array to CSV string */
const objectArrayToCsv = (data: object[]) => {
  const header = Object.keys(data[0]).join(",");
  const body = data.map((d) => Object.values(d).join(",")).join("\n");
  return `${header}\n${body}`;
};

exports.handler = async (event: any) => {
  switch (event.requestContext.http.method) {
    case "GET": {
      console.log("GET:", event.rawPath, event.queryStringParameters);
      const params = getQueryParams(event.queryStringParameters);
      const path = event.rawPath;
      const validateParams = areParamsValid(params);
      if (typeof validateParams === "string") {
        console.error("invalid params", validateParams);
        return sendRes(
          400,
          JSON.stringify({ error: validateParams }),
          "application/json"
        );
      }
      console.log("fetching result:", path, params);
      let result;
      switch (path) {
        case "/summary":
          console.log("fetching summary");
          result = await getSummary(params);
          break;
        case "/filings":
          console.log("fetching filings by day");
          result = await getFilings(params);
          break;
        case "/locations":
          console.log("fetching filings by for locations", params);
          result = await getLocations(params);
          break;
        case "/meta":
          console.log("fetching meta");
          result = await getMeta();
          break;
        case "/precincts":
          console.log("fetching precincts");
          result = await getPrecincts();
          break;
        default:
          result = null;
      }
      if (!result) {
        return sendRes(
          405,
          JSON.stringify({ error: "invalid API path" }),
          "application/json"
        );
      } else {
        console.log("success!");
        const type = params.format === "csv" ? "text/csv" : "application/json";
        return sendRes(200, JSON.stringify(result), type);
      }
    }
    default:
      return sendRes(
        405,
        JSON.stringify({ error: "invalid API path" }),
        "application/json"
      );
  }
};

const sendRes = (status: number, body: any, type: string = "text/html") => {
  var response = {
    statusCode: status,
    headers: {
      "Content-Type": type,
    },
    body: body,
  };
  return response;
};
