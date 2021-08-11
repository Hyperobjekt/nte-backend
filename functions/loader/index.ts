const AWS = require("aws-sdk");
const parse = require("csv-parse/lib/sync");

const RDS = new AWS.RDSDataService();
const s3 = new AWS.S3();

const evictionTableSQL = `DROP TABLE IF EXISTS evictions;
CREATE TABLE IF NOT EXISTS evictions (
  case_number VARCHAR ( 32 ) PRIMARY KEY,
  date DATE NOT NULL,
  amount NUMERIC ( 10, 2 ),
  zip_id VARCHAR ( 5 ),
  tract_id VARCHAR ( 11 ),
  county_id VARCHAR ( 5 ),
  lon NUMERIC ( 10, 7 ),
  lat NUMERIC ( 10, 7 )
);`;

// The Lambda environment variables for the Aurora Cluster Arn, Database Name, and the AWS Secrets Arn hosting the master credentials of the serverless db
var DBSecretsStoreArn = process.env.SECRET_ARN!;
var DBAuroraClusterArn = process.env.CLUSTER_ARN!;
var DatabaseName = process.env.DB_NAME!;

const baseParams = {
  secretArn: DBSecretsStoreArn,
  resourceArn: DBAuroraClusterArn,
  database: DatabaseName,
};

async function createTables() {
  // create the tables via SQL statement
  const params = {
    secretArn: DBSecretsStoreArn,
    resourceArn: DBAuroraClusterArn,
    database: DatabaseName,
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
  return `INSERT INTO evictions (${keys.join(",")}) VALUES(${values.join(
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
  // TODO: move the source file
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
    await s3.deleteObject({ Bucket: bucket, Key: file }).promise();
    console.log("removed source file: %s", `${bucket}/${file}`);
  }
  console.log("done");
};
