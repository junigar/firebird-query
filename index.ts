import Firebird from "node-firebird";
import {
  DeleteOneParams,
  InsertOneParams,
  InsertParams,
  PrimetiveValue,
  UpdateOneParams,
  UpdateOrInsertParams,
  WhereObject,
  deleteOneQuery,
  insertManyQuery,
  insertOneQuery,
  paginatedQuery,
  sqlBuilder,
  updateOneQuery,
  updateOrInsertQuery,
} from "./sql_builder";

const defaultOptions: Firebird.Options = {
  host: process.env.DB_HOST,
  port: Number.parseInt(process.env.DB_PORT) || 3050,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER || "SYSDBA",
  password: process.env.DB_PASSWORD,
};

export class FirebirdQuery {
  private conn: Firebird.ConnectionPool;

  constructor(options = defaultOptions, max = 10) {
    this.conn = Firebird.pool(max, options);
  }

  private getDB(): Promise<Firebird.Database> {
    return new Promise((res, rej) => {
      this.conn.get((err, db) => {
        if (err) {
          rej(err);
        } else {
          res(db);
        }
      });
    });
  }

  private manageQuery<T>(query: string) {
    return new Promise<T>((res, rej) => {
      this.conn.get((err, db) => {
        if (err) rej(err);
        db.query(query, [], (err, data) => {
          if (err) rej(err);
          db.detach((err) => (err ? rej(err) : this.conn.destroy()));
          res(data as T);
        });
      });
    });
  }

  private async getTransaction(
    db: Firebird.Database
  ): Promise<Firebird.Transaction> {
    return new Promise((res, rej) => {
      db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
        if (err) {
          rej(err);
        } else {
          res(transaction);
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

    const rollbackHandler = () => {
      return new Promise<void>((res, rej) => {
        transaction.rollbackRetaining((err) => {
          if (err) rej(err);
          res();
        });
      });
    };
    return {
      queryRaw: handleRawQuery(<T>(query: string): Promise<T[]> => {
        return new Promise<T[]>((res, rej) => {
          transaction.query(query, [], (err, data) => {
            if (err) rej(err);
            res(data);
          });
        });
      }),
      insertOne: handleInsertOne(<T>(query: string): Promise<T> => {
        return new Promise<T>((res, rej) => {
          transaction.query(query, [], (err, data) => {
            if (err) rej(err);
            res(data as T);
          });
        });
      }),
      insertMany: handleInsertMany(
        (query: string, length: number): Promise<string> => {
          return new Promise<string>((res, rej) => {
            transaction.query(query, [], (err, data) => {
              if (err) rej(err);
              res(`${length} rows inserted`);
            });
          });
        }
      ),
      updateOne: handleUpdateOne(<T>(query: string): Promise<T> => {
        return new Promise<T>((res, rej) => {
          transaction.query(query, [], (err, data) => {
            if (err) rej(err);
            res(data as T);
          });
        });
      }),
      updateOrInsert: handleUpdateOrInsert(<T>(query: string): Promise<T> => {
        return new Promise<T>((res, rej) => {
          transaction.query(query, [], (err, data) => {
            if (err) rej(err);
            res(data as T);
          });
        });
      }),
      deleteOne: handleDeleteOne(<T>(query: string): Promise<T> => {
        return new Promise<T>((res, rej) => {
          transaction.query(query, [], (err, data) => {
            if (err) rej(err);
            res(data as T);
          });
        });
      }),
      commit: async () => {
        return new Promise<void>((res, rej) => {
          transaction.commit(async (err) => {
            if (err) {
              await rollbackHandler();
              rej(err);
            }
            res();
          });
        });
      },
      rollback: async () => rollbackHandler(),
      close: async () => {
        return new Promise<void>((res, rej) => {
          transaction.commit(async (err) => {
            if (err) {
              await rollbackHandler();
              rej(err);
            }
            db.detach((err) => {
              if (err) rej(err);
              this.conn.destroy();
              res();
            });
          });
        });
      },
    };
  }
}

function handleRawQuery(cb: <T = unknown>(query: string) => Promise<T[]>) {
  return <T>(
    strings: TemplateStringsArray,
    ...params: Array<PrimetiveValue | WhereObject>
  ) => {
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
