const AWS = require("aws-sdk");
const parse = require("csv-parse/lib/sync");

const RDS = new AWS.RDSDataService();
const s3 = new AWS.S3();

// The Lambda environment variables for the Aurora Cluster Arn, Database Name, and the AWS Secrets Arn hosting the master credentials of the serverless db
var DBSecretsStoreArn = process.env.SECRET_ARN!;
var DBAuroraClusterArn = process.env.CLUSTER_ARN!;
var DatabaseName = process.env.DB_NAME!;
var TableName = `evictions_${process.env.NTEP_ENV}`;
var TmpTableName = "evictions_tmp"; // temporary table for loading data

// TODO: do not drop the production table.  Instead, add a new table with a different name.
//     Then, rename the new table to the production table once records are successfully added.
const evictionTableSQL = `DROP TABLE IF EXISTS ${TmpTableName};
CREATE TABLE IF NOT EXISTS ${TmpTableName} (
  case_number VARCHAR ( 32 ) PRIMARY KEY,
  date DATE NOT NULL,
  amount NUMERIC ( 10, 2 ),
  precinct_id VARCHAR ( 32 ),
  council_id VARCHAR ( 32 ),
  city_id VARCHAR ( 32 ),
  zip_id VARCHAR ( 5 ),
  tract_id VARCHAR ( 11 ),
  county_id VARCHAR ( 5 ),
  lon NUMERIC ( 10, 7 ),
  lat NUMERIC ( 10, 7 )
);`;

const baseParams = {
  secretArn: DBSecretsStoreArn,
  resourceArn: DBAuroraClusterArn,
  database: DatabaseName,
};

async function createTables() {
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
      if (!record.case_number) {
        console.warn("skipping row, missing case_number:", record);
        continue;
      }
      if (!record.date) {
        console.warn("skipping row, missing date:", record);
        continue;
      }
      if (ids[record.case_number]) {
        console.warn("skipping row, duplicate case_number:", record);
        continue;
      }
      rows.push({
        case_number: `'${record.case_number}'`,
        date: `'${record.date}'`,
        amount: record.amount ? Number(record.amount) : "null",
        precinct_id: record.precinct_id
          ? `'${record.precinct_id.replace(/\D/g, "")}'`
          : "null",
        council_id: record.council_id
          ? `'${record.council_id.replace(/\D/g, "")}'`
          : "null",
        city_id: record.city_id
          ? `'${record.city_id.replace(/\D/g, "")}'`
          : "null",
        zip_id: record.zip_id ? `'${record.zip_id}'` : "null",
        tract_id: record.tract_id ? `'${record.tract_id}'` : "null",
        county_id: record.county_id ? `'${record.county_id}'` : "null",
        lon: record.lon ? Number(record.lon) : "null",
        lat: record.lat ? Number(record.lat) : "null",
      });
      ids[record.case_number] = true;
    }
    return rows;
  } catch (err) {
    console.error(err);
    return [];
  }
};

const insertData = async (data: object[]) => {
  if (!data || data.length === 0) throw new Error("Unable to load data");
  let count = 0;
  // load data 100 entries at a time
  while (data.length > 0) {
    await insertBatch(data.splice(0, 100));
    count++;
    if (count % 10 === 0) {
      console.log("...", count * 100, "rows inserted");
    }
  }
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
    const data = await loadData(bucket, file);
    console.log("inserting", data.length, "rows");
    await insertData(data);
    console.log("finished inserting data");
    await promoteTmpTable();
    console.log("promoted temporary table to active table");
    await s3.deleteObject({ Bucket: bucket, Key: file }).promise();
    console.log("removed source file: %s", `${bucket}/${file}`);
  }
  console.log("done");
};
