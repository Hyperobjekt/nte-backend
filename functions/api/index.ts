import db from "./db";

interface NtepQueryParams {
  start: string;
  end: string;
  region?: string;
  location?: string;
  format?: string;
}

interface NtepQueryResult {
  id: string;
  filings: number;
  median_filed_amount: number;
  filed_date?: {
    value: string;
  };
}

// List of valid regions
const REGION_MAP: any = {
  counties: "county",
  tracts: "tract",
  cities: "city",
  zips: "zip",
};

/**
 * Parses the request parameters, and sets defaults if none are provided
 */
const getQueryParams = (params: any = {}): NtepQueryParams => {
  const result: NtepQueryParams = {
    start: params.start || "2021-01-01",
    end: params.end || new Date().toISOString().split("T")[0],
  };
  if (params.region) result.region = params.region;
  if (params.location) result.location = params.location;
  if (params.format) result.format = params.format;
  return result;
};

/**
 * Checks if params are valid, and returns an error message if not
 * returns true if params are valid
 */
const areParamsValid = (params: any) => {
  const { region, start, end, location } = params;
  const validRegion = !region || REGION_MAP[region];
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
const getSummarySqlQuery = (params: NtepQueryParams) => {
  const { region = "counties" } = params;
  const sqlQuery = `
    SELECT
      ${REGION_MAP[region]}_id as id,
      COUNT(case_number) as filings,
      median(amount) as median_filed_amount
    FROM evictions
    WHERE date BETWEEN :start AND :end
    GROUP BY id
    ORDER BY filings DESC`;
  return sqlQuery;
};

/**
 * Returns total counts of filings and overall median for the given parameters
 */
const getSummary = async (params: NtepQueryParams) => {
  const { format, ...restParams } = params;
  const sqlQuery = getSummarySqlQuery(restParams);
  console.log("performing query: %s", sqlQuery);
  const result = await query(sqlQuery, restParams);
  console.log("received result: %j", result);
  const rows = result.map(
    ({ id, filings, median_filed_amount }: NtepQueryResult) => ({
      id,
      ef: filings,
      mfa: Number(median_filed_amount),
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
const getFilingsSqlQuery = (params: NtepQueryParams) => {
  const { region = "counties", location } = params;
  let sqlQuery = `
    SELECT
      ${REGION_MAP[region]}_id as id,
      COUNT(case_number) as filings,
      median(amount) as median_filed_amount
    FROM evictions
    WHERE date BETWEEN :start AND :end
    GROUP BY id,date
    ORDER BY date DESC`;
  if (location)
    sqlQuery = sqlQuery.replace(
      /WHERE date/g,
      `WHERE ${REGION_MAP[region]}_id = :location AND date`
    );
  console.log("filings query", sqlQuery);
  return sqlQuery;
};

/**
 * Returns time series filing data for the given params
 */
const getFilings = async (params: NtepQueryParams) => {
  const { format, ...restParams } = params;
  const sqlQuery = getFilingsSqlQuery(restParams);
  const result = await query(sqlQuery, restParams);
  const rows = result.map(
    ({ filed_date, id, filings, median_filed_amount }: NtepQueryResult) => ({
      date: filed_date?.value,
      id,
      ef: filings,
      mfa: Number(median_filed_amount),
    })
  );
  if (format === "csv") return objectArrayToCsv(rows);
  return {
    ...restParams,
    result: rows,
  };
};

/**
 * Runs the query and returns the result
 */
async function query(sqlQuery: string, params: NtepQueryParams) {
  try {
    const queryParams: any = {
      ...params,
      start: new Date(params.start),
      end: new Date(params.end),
    };
    const results = await db.query(sqlQuery, queryParams);
    console.log("got results: %j", results);
    return results.records;
  } catch (error) {
    console.error(error);
    return [];
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
