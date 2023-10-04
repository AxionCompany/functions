import sql from "npm:mssql";

// Database configuration
const DB_CONFIG = {
  user: "dex",
  password: "Comporte@2023",
  port: 1633,
  server: "200.193.128.33", // e.g., 'localhost' or IP address
  requestTimeout: 1000 * 60 * 10,
  //   connectionTimeout:1000*60*10,
  //   database: "dbo",
    options: {
      encrypt: false, // Use this if you're on Windows Azure
     trustServerCertificate: true, // change to true for local dev / self-signed certs
    },
//   options: {
//   },
};

// Deno function to execute SQL
export default async function executeSQL(sqlStatement: string) {
  let pool;
  try {
    pool = new sql.ConnectionPool('Server=200.193.128.33,1633;User Id=dex;Password=Comporte%402023;Encrypt=true');
    const connection = await pool.connect(DB_CONFIG);

    const result = await connection.request().query(sqlStatement);
    return result.recordset; // Adjust depending on what you want to return
  } catch (error) {
    console.error("Error executing SQL:", error);
    throw error;
  } finally {
    if (pool) {
      pool.close();
    }
  }
}

const makeQuery = (dataInicio: string, dataFim: string) =>
  `EXEC dbo.proc_integratableu @Datainicio =${dataInicio}, @DataFim = ${dataFim};`;

const dataInicio = "2023-08-05 00:00:00";
const dataFim = "2023-08-05 00:03:00";

// Example usage:
const result = await executeSQL(makeQuery(dataInicio, dataFim));
console.log(result);
