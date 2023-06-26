import {
  Database,
  escape,
  Options,
  ISOLATION_READ_COMMITTED,
  pool as FBpool,
  Transaction,
} from "node-firebird";

type PrimetiveValue = String | number | boolean | Date | null | undefined;
type Operators =
  | {
      ne?: number;
      gt?: number;
      gte?: number;
      lt?: number;
      lte?: number;
      between?: { from: number; to: number };
      IN?: number[];
      notIN?: number[];
    }
  | {
      ne?: Date;
      gt?: Date;
      gte?: Date;
      lt?: Date;
      lte?: Date;
      between?: { from: Date; to: Date };
      IN?: Date[];
      notIN?: Date[];
    }
  | {
      ne?: string;
      IN?: string[];
      notIN?: string[];
    };

type WhereObject =
  | {
      OR?: WhereObject[];
    }
  | {
      [k in string]: Operators | PrimetiveValue;
    };

type ValueType = string | number | Date;

type InsertParams<T> = {
  readonly tableName: string;
  readonly columnNames: ReadonlyArray<keyof T>;
  readonly rowValues: ReadonlyArray<{ [k in keyof T]: any }>;
};

type InsertOneParams<T> = {
  readonly tableName: string;
  readonly rowValues: { [k in string]: any };
  readonly returning?: ReadonlyArray<keyof T>;
};

type UpdateOneParams<T> = {
  readonly tableName: string;
  readonly rowValues: { [k in string]: any };
  readonly returning?: ReadonlyArray<keyof T>;
  readonly conditions: { [k in string]: any };
};
type UpdateOrInsertParams<T> = {
  readonly tableName: string;
  readonly rowValues: { [k in string]: any };
  readonly returning?: ReadonlyArray<keyof T>;
};

const verifyIfWhereObject = (arg: any): arg is WhereObject =>
  typeof arg === "object";

const buildWhereClause = (obj: WhereObject, prefix = "", clause = "AND") => {
  const clauses = [];
  if (Object.values(obj).length === 1) {
    if (Object.values(obj)[0] === undefined) {
      return clause === "AND" ? "1 = 1" : "1 = 0";
    }
  }
  for (const key in obj) {
    const val = (obj as any)[key];
    if (key === "OR" && Array.isArray(val)) {
      const arr = val as WhereObject[];
      const orClauses: string[] = arr.map((orObj) =>
        buildWhereClause(orObj, prefix, "OR")
      );
      clauses.push(`(${orClauses.join(" OR ")})`);
    } else if (typeof val === "object" && !Array.isArray(val)) {
      for (const subKey in val) {
        const value = val[subKey];
        if (subKey === "ne") {
          clauses.push(`${prefix}${key} != ${escape(value)}`);
        } else if (subKey === "gt") {
          clauses.push(`${prefix}${key} > ${escape(value)}`);
        } else if (subKey === "gte") {
          clauses.push(`${prefix}${key} >= ${escape(value)}`);
        } else if (subKey === "lt") {
          clauses.push(`${prefix}${key} < ${escape(value)}`);
        } else if (subKey === "lte") {
          clauses.push(`${prefix}${key} <= ${escape(value)}`);
        } else if (subKey === "between") {
          clauses.push(
            `${prefix}${key} BETWEEN ${escape(value["from"])} AND ${escape(
              value["to"]
            )}`
          );
        } else if (subKey === "IN") {
          clauses.push(`${prefix}${key} IN (${value.map(escape).join(", ")})`);
        } else if (subKey === "notIN") {
          clauses.push(
            `${prefix}${key} NOT IN (${value.map(escape).join(", ")})`
          );
        }
      }
    } else {
      const value = val;
      if (value === undefined) {
        clauses.push("1 = 1");
      } else {
        clauses.push(`${prefix}${key} = ${escape(value)}`);
      }
    }
  }
  return clauses.join(` AND `);
};

const sqlBuilder = (
  strings: TemplateStringsArray,
  params: Array<ValueType | WhereObject>
) => {
  return strings
    .map((cur, i) => {
      const param = params[i];

      if (verifyIfWhereObject(param)) {
        const conditions = param;
        const conditionResult = buildWhereClause(conditions);
        return cur + conditionResult;
      } else {
        const isLastStr = i === strings.length - 1;
        const valueResult = !isLastStr ? escape(param) : "";
        return cur + valueResult;
      }
    })
    .join("");
};

export const pool = (max: number, options: Options) => {
  const dbPool = FBpool(max, options);

  const getConnection = async (): Promise<Database> => {
    return new Promise((resolve, reject) => {
      dbPool.get((err, db) => (err ? reject(err) : resolve(db)));
    });
  };

  const poolHandler = async <T = unknown>(
    query: string,
    params = []
  ): Promise<T[]> => {
    const db = await getConnection();
    return new Promise((resolve, reject) => {
      db.query(query, params, (err, data) => {
        db.detach();
        err ? reject(err) : resolve(data);
      });
    });
  };

  const initReadCommittedTransaction = async (): Promise<Transaction> => {
    const db = await getConnection();
    return new Promise((resolve, reject) => {
      db.transaction(ISOLATION_READ_COMMITTED, (err, transaction) => {
        if (err) reject(err);
        resolve(transaction);
      });
    });
  };

  const queryRaw = <T = unknown>(
    strings: TemplateStringsArray,
    ...params: Array<ValueType | WhereObject>
  ) => {
    const sanitizedQuery = sqlBuilder(strings, params);

    return {
      getQuery: () => sanitizedQuery,
      execute: async () => {
        console.log("Executing: ", sanitizedQuery);
        const data = await poolHandler<T>(sanitizedQuery);
        return data;
      },
    };
  };

  const insertMany = <T>({
    tableName,
    columnNames,
    rowValues,
  }: InsertParams<T>) => {
    const sortedColumns = columnNames.slice().sort();
    const sortedColumnsStr = sortedColumns.join(", ");
    const selectStatements = rowValues.map((row) => {
      const sortedRow = Object.entries(row).sort(([a], [b]) =>
        a.localeCompare(b)
      );
      const valuesList = sortedRow.map(([, value]) => escape(value)).join(", ");
      return `SELECT ${valuesList} FROM RDB$DATABASE`;
    });
    const toInsertStatement = selectStatements.join(" UNION ALL ");
    const query = `INSERT INTO ${tableName} (${sortedColumnsStr}) ${toInsertStatement};`;

    return {
      getQuery: () => query,
      execute: async () => {
        console.log("Executing: ", query);
        await poolHandler(query);
        return `${rowValues.length} rows inserted`;
      },
    };
  };

  const insertOne = <T = void>({
    tableName,
    rowValues,
    returning = [],
  }: InsertOneParams<T>) => {
    const columns = Object.keys(rowValues);
    const columnsStr = columns.join(", ");
    const escapedValues = columns.map((key) => escape(rowValues[key]));
    const valuesStr = escapedValues.join(", ");

    let query = `INSERT INTO ${tableName} (${columnsStr}) VALUES (${valuesStr})`;
    if (returning.length > 0) {
      query += ` RETURNING ${returning.join(", ")}`;
    }
    query += ";";
    return {
      getQuery: () => query,
      execute: async () => {
        console.log("Executing: ", query);
        return poolHandler<T>(query) as T;
      },
    };
  };

  const updateOne = <T = void>({
    tableName,
    rowValues,
    returning = [],
    conditions,
  }: UpdateOneParams<T>) => {
    const toSet = Object.entries(rowValues).map(
      ([columnName, value]) => `${columnName} = ${escape(value)}`
    );
    const valuesStr = toSet.join(", ");

    const whereClauses = Object.entries(conditions).map(
      ([columnName, value]) => `${columnName} = ${escape(value)}`
    );
    const whereStr = whereClauses.join(" AND ");

    let query = `UPDATE ${tableName} SET ${valuesStr} WHERE ${whereStr}`;
    if (returning.length > 0) {
      query += ` RETURNING ${returning.join(", ")}`;
    }
    query += ";";
    return {
      getQuery: () => query,
      execute: async () => {
        console.log("Executing: ", query);
        return poolHandler<T>(query) as T;
      },
    };
  };

  const updateOrInsert = <T = void>({
    tableName,
    rowValues,
    returning = [],
  }: UpdateOrInsertParams<T>) => {
    // Get an array of column names and escaped values.
    const columns = Object.keys(rowValues);
    const columnsStr = columns.join(", ");
    const escapedValues = columns.map((key) => escape(rowValues[key]));
    const valuesStr = escapedValues.join(", ");

    // Build the SQL query using template literals.
    let query = `UPDATE OR INSERT INTO ${tableName} (${columnsStr}) VALUES (${valuesStr})`;
    if (returning.length > 0) {
      query += ` RETURNING ${returning.join(", ")}`;
    }
    query += ";";
    return {
      getQuery: () => query,
      execute: async () => {
        console.log("Executing: ", query);
        return poolHandler<T>(query) as T;
      },
    };
  };

  return {
    queryRaw,
    insertMany,
    insertOne,
    updateOne,
    updateOrInsert,
    $getPool: getConnection,
    // $Firebird: Firebird,
    $initReadCommittedTransaction: initReadCommittedTransaction,
  };
};
