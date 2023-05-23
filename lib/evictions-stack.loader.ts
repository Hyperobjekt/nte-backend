const AWS = require("aws-sdk");
const parse = require("csv-parse/lib/sync");
const { mapValues } = require("lodash")

const RDS = new AWS.RDSDataService();
const s3 = new AWS.S3();

// The Lambda environment variables for the Aurora Cluster Arn, Database Name, and the AWS Secrets Arn hosting the master credentials of the serverless db
var DBSecretsStoreArn = process.env.SECRET_ARN!;
var DBAuroraClusterArn = process.env.CLUSTER_ARN!;
var DatabaseName = process.env.DB_NAME!;
var TableName = `evictions_${process.env.STAGE}`;
var TmpTableName = `evictions_tmp_${process.env.STAGE}`; // temporary table for loading data

// store for errors
var errors = [];

// create a temporary table for inserting data
const evictionTableSQL = `DROP TABLE IF EXISTS ${TmpTableName};
CREATE TABLE IF NOT EXISTS ${TmpTableName} (
  case_number VARCHAR ( 32 ) PRIMARY KEY,
  date DATE NOT NULL,
  amount NUMERIC ( 10, 2 ),
  lon NUMERIC ( 10, 7 ),
  lat NUMERIC ( 10, 7 ),
  region_ids JSONB
);`;

const baseParams = {
  secretArn: DBSecretsStoreArn,
  resourceArn: DBAuroraClusterArn,
  database: DatabaseName,
}

async function createTables() {
  console.log("create temporary table", evictionTableSQL);
  // create the tables via SQL statement
  const params = {
    ...baseParams,
    sql: evictionTableSQL,
  };
  try {
    let dbResponse = await RDS.executeStatement(params).promise();
    return dbResponse;
  } catch (error) {
    console.log(error);
    errors.push(error);
    return error;
  }
}

const getInsertStatement = (data: object) => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  return `INSERT INTO ${TmpTableName} (${keys.join(",")}) VALUES(${values.join(
    ","
  )})`;
};

const stripNonNumeric = (id: string) => {
  const stripped = String(id).replace(/\D/g, "");
  return stripped || "null";
};

async function insertBatch(entries: any) {
  const sqlStatements = entries.map(getInsertStatement);
  const params = {
    ...baseParams,
    sql: sqlStatements.join(";"),
  };
  try {
    let dbResponse = await RDS.executeStatement(params).promise();
    return dbResponse;
  } catch (error) {
    console.error(error, params.sql);
    errors.push(error);
    return error;
  }
}

const loadData = async (bucket: string, filename: string): Promise<any> => {
  var params = {
    Bucket: bucket,
    Key: filename,
  };
  try {
    const file = await s3.getObject(params).promise();
    const data = file?.Body?.toString("utf-8");
    console.log("Loaded file from S3: %s", `${bucket}/${filename}`);
    if (!data) console.error("failed to load data");
    const records = parse(data, { columns: true, skip_empty_lines: true });
    const rows = [];
    const ids: any = {};
    for (const record of records) {
      const { case_number, date, amount, lon, lat, ...region_ids } = record;
      if (!case_number) {
        console.warn("skipping row, missing case_number:", record);
        continue;
      }
      if (!date) {
        console.warn("skipping row, missing date:", record);
        continue;
      }
      if (ids[case_number]) {
        console.warn("skipping row, duplicate case_number:", record);
        continue;
      }
      rows.push({
        case_number: `'${case_number}'`,
        date: `'${date}'`,
        amount: amount ? Number(amount) : "null",
        lon: lon ? Number(lon) : "null",
        lat: lat ? Number(lat) : "null",
        region_ids: `'${JSON.stringify(mapValues(region_ids, stripNonNumeric))}'`,
      });
      ids[record.case_number] = true;
    }
    console.log("done loading.");
    return rows;
  } catch (err) {
    console.error(err);
    errors.push(err);
    return [];
  }
};

const insertData = async (data: object[]) => {
  if (!data || data.length === 0) throw new Error("Unable to load data");
  let count = 0;
  // load data 100 entries at a time
  while (data.length > 0 && errors.length === 0) {
    await insertBatch(data.splice(0, 100));
    count++;
    if (count % 50 === 0) {
      console.log("...", count * 100, "rows inserted");
      // console.log("next row: ", data[0])
    }
  }
  console.log("done inserting.");
};

/**
 * Moves the temporary table for data loading to the active table.
 * @returns
 */
const promoteTmpTable = async () => {
  const params = {
    ...baseParams,
    sql: `DROP TABLE IF EXISTS ${TableName};
    ALTER TABLE ${TmpTableName} RENAME TO ${TableName};`,
  };
  try {
    let dbResponse = await RDS.executeStatement(params).promise();
    return dbResponse;
  } catch (error) {
    console.error(error, params.sql);
    return error;
  }
};

exports.handler = async (event: any) => {
  console.log("setting up tables");
  await createTables();
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const file = record.s3.object.key;
    console.log("loading", file);
    const data = await loadData(bucket, file);
    console.log("inserting", data.length, "rows");
    await insertData(data);
    console.log("finished inserting data");
    await s3.deleteObject({ Bucket: bucket, Key: file }).promise();
    console.log("removed source file: %s", `${bucket}/${file}`);
    if (errors.length > 0) {
      throw new Error(`unable to load data due to ${errors.length} errors: ${errors.map(JSON.stringify)}`);
    }
    await promoteTmpTable();
    console.log("promoted temporary table to active table");
  }
  console.log("done");
};
