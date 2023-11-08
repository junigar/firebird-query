
import Firebird from "node-firebird";

const escape = (...val: any[]) => Firebird.escape(val.join(""));

export type PrimetiveValue =
  | null
  | undefined
  | boolean
  | string
  | number
  | Date;

type NumberOperators = {
  ne?: number;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  between?: { from: number; to: number };
  IN?: number[];
  notIN?: number[];
};

type DateOperators = {
  ne?: Date;
  gt?: Date;
  gte?: Date;
  lt?: Date;
  lte?: Date;
  between?: { from: Date; to: Date };
  IN?: Date[];
  notIN?: Date[];
};

type StringOperators = {
  ne?: string;
  IN?: string[];
  notIN?: string[];
  startsWith?: string;
  endsWith?: string;
  contains?: string;
};

type WhereConditions = NumberOperators | DateOperators | StringOperators;

type Operators =
  | keyof NumberOperators
  | keyof DateOperators
  | keyof StringOperators;

type keyOmit<T, U extends keyof any> = T & { [P in U]?: never };

export type WhereObject =
  | keyOmit<{ [key: string]: PrimetiveValue | WhereConditions }, "OR">
  | {
    OR: WhereObject[];
  };

const buildWhereClause = (
  obj: WhereObject,
  prefix = "",
  clause = "AND"
): string => {
  const clauses: string[] = [];

  if (isSingleUndefinedValue(obj)) {
    return defaultCondition(clause);
  }

  for (const key in obj) {
    const val = obj[key];

    if (isWhereObjectArr(val)) {
      clauses.push(handleOrCondition(val, prefix));
    } else if (isWhereObject(val)) {
      clauses.push(...handleObjectCondition(val, prefix, key));
    } else if (isPrimitiveValue(val)) {
      clauses.push(handlePrimitiveValue(val, prefix, key));
    } else {
      clauses.push(defaultCondition(clause));
    }
  }

  return clauses.join(" AND ");
};

const isSingleUndefinedValue = (obj: WhereObject): boolean =>
  Object.values(obj).length === 1 && Object.values(obj)[0] === undefined;

const defaultCondition = (clause: string): string =>
  clause === "AND" ? "1=1" : "1=0";

const isWhereObject = (val: any): val is WhereObject =>
  typeof val === "object" && !Array.isArray(val) && !(val instanceof Date);

const isWhereObjectArr = (val: any): val is WhereObject[] =>
  Array.isArray(val) && isWhereObject(val[0]);

const isPrimitiveValue = (val: any): val is PrimetiveValue =>
  typeof val === "string" ||
  typeof val === "number" ||
  typeof val === "boolean" ||
  val instanceof Date ||
  val === null ||
  val === undefined;

const handleOrCondition = (val: WhereObject[], prefix: string): string => {
  const orClauses: string[] = val.map((orObj) =>
    buildWhereClause(orObj, prefix, "OR")
  );
  return `(${orClauses.join(" OR ")})`;
};

const handleObjectCondition = (
  val: WhereObject,
  prefix: string,
  key: string
): string[] => {
  const clauses: string[] = [];
  for (const subKey in val) {
    const value = val[subKey];
    let condition = "";

    switch (subKey as Operators) {
      case "ne":
        condition = `${prefix}${key} != ${escape(value)}`;
        break;
      case "gt":
        condition = `${prefix}${key} > ${escape(value)}`;
        break;
      case "gte":
        condition = `${prefix}${key} >= ${escape(value)}`;
        break;
      case "lt":
        condition = `${prefix}${key} < ${escape(value)}`;
        break;
      case "lte":
        condition = `${prefix}${key} <= ${escape(value)}`;
        break;
      case "between":
        condition = `${prefix}${key} BETWEEN ${escape(
          value["from"]
        )} AND ${escape(value["to"])}`;
        break;
      case "IN":
        condition = `${prefix}${key} IN (${value
          .map((i: any) => escape(i))
          .join(", ")})`;
        break;
      case "notIN":
        condition = `${prefix}${key} NOT IN (${value
          .map((i: any) => escape(i))
          .join(", ")})`;
        break;
      case "startsWith":
        condition = `${prefix}${key} LIKE ${escape(value, "%")}`;
        break;
      case "endsWith":
        condition = `${prefix}${key} LIKE ${escape("%", value)}`;
        break;
      case "contains":
        condition = `${prefix}${key} LIKE ${escape("%", value, "%")}`;
        break;
    }

    if (condition) {
      clauses.push(condition);
    }
  }
  return clauses;
};
export type QueryParam = PrimetiveValue | WhereObject;
const handlePrimitiveValue = (
  val: PrimetiveValue,
  prefix: string,
  key: string
): string => (val === undefined ? "1=1" : `${prefix}${key} = ${escape(val)}`);

const sqlBuilder = (
  strings: TemplateStringsArray,
  params: QueryParam[]
) => {
  return strings
    .map((cur, i) => {
      const param = params[i];

      if (isWhereObject(param)) {
        const conditions = param;
        const conditionResult = buildWhereClause(conditions);
        return cur + conditionResult;
      } else if (isPrimitiveValue(param)) {
        const isLastStr = i === strings.length - 1;
        const valueResult = !isLastStr ? escape(param) : "";
        return cur + valueResult;
      } else {
        return "";
      }
    })
    .join("");
};

const paginatedQuery = (query: string, take: number, page: number) => {
  const skip = take * (page - 1);
  return `SELECT FIRST ${take} SKIP ${skip} * FROM (${query.replace(
    /;*$/g,
    ""
  )});`;
};

export type InsertOneParams<T extends { [key: string]: any }> = {
  tableName: string;
  rowValues: object;
  returning?: (keyof T | string)[];
};
const insertOneQuery = <T extends { [key: string]: any }>(
  params: InsertOneParams<T>
) => {
  const { tableName, rowValues, returning = [] } = params;
  const columns = Object.keys(rowValues);
  const columnsStr = columns.join(", ");
  const escapedValues = columns.map((key) => escape(rowValues[key]));
  const valuesStr = escapedValues.join(", ");

  let query = `INSERT INTO ${tableName} (${columnsStr}) VALUES (${valuesStr})`;
  if (returning.length > 0) {
    query += ` RETURNING ${returning.join(", ")}`;
  }
  query += ";";
  return query;
};

export type InsertParams<T> = {
  readonly tableName: string;
  readonly rowValues: ReadonlyArray<{ [k in keyof T]: any }>;
  readonly columnNames: ReadonlyArray<keyof T>;
};

const insertManyQuery = <T>({
  tableName,
  columnNames,
  rowValues,
}: InsertParams<T>) => {
  const sortedColumnsStr = columnNames.slice().sort().join(", ");
  const selectStatements = rowValues.map((row) => {
    const sortedRow = Object.entries(row).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const valuesList = sortedRow.map(([, value]) => escape(value)).join(", ");
    return `SELECT ${valuesList} FROM RDB$DATABASE`;
  });
  const toInsertStatement = selectStatements.join(" UNION ALL ");
  const query = `INSERT INTO ${tableName} (${sortedColumnsStr}) ${toInsertStatement};`;

  return query;
};

export type UpdateOneParams<T> = {
  readonly tableName: string;
  readonly rowValues: { [k in string]: any };
  readonly where: WhereObject;
  readonly returning?: ReadonlyArray<keyof T | string>;
};

const updateOneQuery = <T = void>({
  tableName,
  rowValues,
  returning = [],
  where,
}: UpdateOneParams<T>) => {
  const toSet = Object.entries(rowValues).map(
    ([columnName, value]) => `${columnName} = ${escape(value)}`
  );
  const valuesStr = toSet.join(", ");

  const whereStr = buildWhereClause(where);

  let query = `UPDATE ${tableName} SET ${valuesStr} WHERE ${whereStr}`;
  if (returning.length > 0) {
    query += ` RETURNING ${returning.join(", ")}`;
  }
  query += ";";
  return query;
};

type UpdateOrInsertParams<T> = {
  readonly tableName: string;
  readonly rowValues: { [k in string]: any };
  readonly returning?: ReadonlyArray<keyof T | string>;
};

const updateOrInsertQuery = <T>({
  tableName,
  rowValues,
  returning = [],
}: UpdateOrInsertParams<T>) => {
  const columns = Object.keys(rowValues);
  const columnsStr = columns.join(", ");
  const escapedValues = columns.map((key) => escape(rowValues[key]));
  const valuesStr = escapedValues.join(", ");

  let query = `UPDATE OR INSERT INTO ${tableName} (${columnsStr}) VALUES (${valuesStr})`;
  if (returning.length > 0) {
    query += ` RETURNING ${returning.join(", ")}`;
  }
  query += ";";
  return query;
};

export type DeleteOneParams<T> = {
  readonly tableName: string;
  readonly where: WhereObject;
  readonly returning?: ReadonlyArray<keyof T | string>;
};

const deleteOneQuery = <T>(params: DeleteOneParams<T>): string => {
  const { where, returning = [], tableName } = params;
  const whereClauses = buildWhereClause(where);
  let query = `DELETE FROM ${tableName} WHERE ${whereClauses}`;
  if (returning.length > 0) {
    query += ` RETURNING ${returning.join(", ")}`;
  }
  query += ";";
  return query;
};

const defaultOptions: Firebird.Options = {
  host: process.env.DB_HOST,
  port: Number.parseInt(process.env.DB_PORT ?? "") || 3050,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER || "SYSDBA",
  password: process.env.DB_PASSWORD,
};

export class FirebirdQuery {
  private db?: Firebird.Database;
  private conn: Firebird.ConnectionPool;

  constructor(options = defaultOptions, max = 10) {
    this.conn = Firebird.pool(max, options);
  }

  private getDB(): Promise<Firebird.Database> {
    return new Promise((res, rej) => {
      if (this.db === undefined) {
        this.conn.get((err, db) => {
          if (err) {
            rej(err);
          }
          this.db = db;
          return res(db);
        });
      } else {
        return res(this.db);
      }
    });
  }

  private manageQuery<T>(query: string) {
    return new Promise<T>((res, rej) => {
      if (this.db === undefined) {
        this.conn.get((err, db) => {
          if (err) {
            return rej({ message: 'Error Establishing a Database Connection', err });
          }
          this.db = db;
          db.query(query, [], (err, data) => {
            if (err) {
              return rej(err);
            }
            return res(data as T);
          });
        });
      }
      else {
        this.db.query(query, [], (err, data) => {
          if (err) {
            return rej({ message: 'Error Executing Query', err });
          }
          return res(data as T);
        });
      }
    });
  }

  private async getTransaction(
    db: Firebird.Database
  ): Promise<Firebird.Transaction> {
    return new Promise((res, rej) => {
      db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
        if (err) {
          return rej(err);
        } else {
          return res(transaction);
        }
      });
    });
  }

  get queryRaw() {
    return handleRawQuery(async <T>(query: string): Promise<T> => {
      return this.manageQuery<T>(query);
    });
  }

  get insertOne() {
    return handleInsertOne(async <T>(query: string): Promise<T> => {
      return this.manageQuery<T>(query);
    });
  }

  get insertMany() {
    return handleInsertMany(
      async (query: string, length: number): Promise<string> => {
        await this.manageQuery(query);
        return `${length} rows inserted`;
      }
    );
  }

  get updateOne() {
    return handleUpdateOne(async <T>(query: string): Promise<T> => {
      return this.manageQuery<T>(query);
    });
  }

  get updateOrInsert() {
    return handleUpdateOrInsert(async <T>(query: string): Promise<T> => {
      return this.manageQuery<T>(query);
    });
  }

  get deleteOne() {
    return handleDeleteOne(async <T>(query: string): Promise<T> => {
      return this.manageQuery<T>(query);
    });
  }

  async initTransaction() {
    const db = await this.getDB();
    const transaction = await this.getTransaction(db);

    const onError = () => {
      return new Promise<void>((res, rej) => {
        transaction.rollbackRetaining((err) => {
          if (err) {
            return rej(err);
          }
          return res();
        });
      });
    };
    return {
      queryRaw: handleRawQuery(<T>(query: string): Promise<T[]> => {
        return new Promise<T[]>((res, rej) => {
          transaction.query(query, [], (err, data) => {
            if (err) {
              return rej(err);
            }
            return res(data);
          });
        });
      }),
      insertOne: handleInsertOne(<T>(query: string): Promise<T> => {
        return new Promise<T>((res, rej) => {
          transaction.query(query, [], (err, data) => {
            if (err) {
              return rej(err);
            }
            return res(data as T);
          });
        });
      }),
      insertMany: handleInsertMany(
        (query: string, length: number): Promise<string> => {
          return new Promise<string>((res, rej) => {
            transaction.query(query, [], (err, data) => {
              if (err) {
                return rej(err);
              }
              return res(`${length} rows inserted`);
            });
          });
        }
      ),
      updateOne: handleUpdateOne(<T>(query: string): Promise<T> => {
        return new Promise<T>((res, rej) => {
          transaction.query(query, [], (err, data) => {
            if (err) {
              return rej(err);
            }
            return res(data as T);
          });
        });
      }),
      updateOrInsert: handleUpdateOrInsert(<T>(query: string): Promise<T> => {
        return new Promise<T>((res, rej) => {
          transaction.query(query, [], (err, data) => {
            if (err) {
              return rej(err);
            }
            return res(data as T);
          });
        });
      }),
      deleteOne: handleDeleteOne(<T>(query: string): Promise<T> => {
        return new Promise<T>((res, rej) => {
          transaction.query(query, [], (err, data) => {
            if (err) {
              return rej(err);
            }
            return res(data as T);
          });
        });
      }),
      commit: async () => {
        return new Promise<void>((res, rej) => {
          transaction.commit(async (err) => {
            if (err) {
              await onError();
              return rej(err);
            }
            return res();
          });
        });
      },
      rollback: async () => onError(),
      close: async () => {
        return new Promise<void>((res, rej) => {
          db.detach((err) => {
            if (err) {
              return rej(err);
            }
            this.conn.destroy();
            return res();
          });
        });
      },
    };
  }
}

function handleRawQuery(cb: <T = unknown>(query: string) => Promise<T[]>) {
  return <T>(strings: TemplateStringsArray, ...params: QueryParam[]) => {
    const sanitizedQuery = sqlBuilder(strings, params);
    return {
      getQuery: () => sanitizedQuery,
      execute: () => {
        console.log("Executing: ", sanitizedQuery);
        return cb(sanitizedQuery) as Promise<T[]>;
      },
      paginated: async (take: number, page: number = 1) => {
        const pagQuery = paginatedQuery(sanitizedQuery, take, page);
        console.log("Executing: ", pagQuery);
        return cb(pagQuery) as Promise<T[]>;
      },
    };
  };
}

function handleInsertOne(cb: <T = unknown>(query: string) => Promise<T>) {
  return <T extends { [key: string]: any }>(params: InsertOneParams<T>) => {
    const query = insertOneQuery(params);
    return {
      getQuery: () => query,
      execute: () => {
        console.log("Executing: ", query);
        return cb(query) as Promise<T>;
      },
    };
  };
}

function handleInsertMany(
  cb: (query: string, length: number) => Promise<string>
) {
  return <T extends { [key: string]: any }>(params: InsertParams<T>) => {
    const query = insertManyQuery(params);
    return {
      getQuery: () => query,
      execute: () => {
        console.log("Executing: ", query);

        return cb(query, params.rowValues.length) as Promise<string>;
      },
    };
  };
}

function handleUpdateOne(cb: <T = unknown>(query: string) => Promise<T>) {
  return <T>(params: UpdateOneParams<T>) => {
    const query = updateOneQuery(params);
    return {
      getQuery: () => query,
      execute: () => {
        console.log("Executing: ", query);
        return cb(query) as Promise<T>;
      },
    };
  };
}

function handleUpdateOrInsert(cb: <T>(query: string) => Promise<T>) {
  return <T>(params: UpdateOrInsertParams<T>) => {
    const query = updateOrInsertQuery(params);
    return {
      getQuery: () => query,
      execute: () => {
        console.log("Executing: ", query);
        return cb(query) as Promise<T>;
      },
    };
  };
}

function handleDeleteOne(cb: <T = unknown>(query: string) => Promise<T>) {
  return <T>(params: DeleteOneParams<T>) => {
    const query = deleteOneQuery(params);
    return {
      getQuery: () => query,
      execute: () => {
        console.log("Executing: ", query);
        return cb(query) as Promise<T>;
      },
    };
  };
}
