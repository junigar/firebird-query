import Firebird from "node-firebird";
import { deleteOneQuery, insertManyQuery, insertOneQuery, paginatedQuery, sqlBuilder, updateOneQuery, updateOrInsertQuery, } from "./sql_builder";
const defaultOptions = {
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT) || 3050,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER || "SYSDBA",
    password: process.env.DB_PASSWORD,
};
export class FirebirdQuery {
    conn;
    constructor(options = defaultOptions, max = 10) {
        this.conn = Firebird.pool(max, options);
    }
    getDB() {
        return new Promise((res, rej) => {
            this.conn.get((err, db) => {
                if (err) {
                    rej(err);
                }
                else {
                    res(db);
                }
            });
        });
    }
    manageQuery(query) {
        return new Promise((res, rej) => {
            this.conn.get((err, db) => {
                if (err)
                    rej(err);
                db.query(query, [], (err, data) => {
                    if (err)
                        rej(err);
                    db.detach((err) => (err ? rej(err) : this.conn.destroy()));
                    res(data);
                });
            });
        });
    }
    async getTransaction(db) {
        return new Promise((res, rej) => {
            db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
                if (err) {
                    rej(err);
                }
                else {
                    res(transaction);
                }
            });
        });
    }
    get queryRaw() {
        return handleRawQuery(async (query) => {
            return this.manageQuery(query);
        });
    }
    get insertOne() {
        return handleInsertOne(async (query) => {
            return this.manageQuery(query);
        });
    }
    get insertMany() {
        return handleInsertMany(async (query, length) => {
            await this.manageQuery(query);
            return `${length} rows inserted`;
        });
    }
    get updateOne() {
        return handleUpdateOne(async (query) => {
            return this.manageQuery(query);
        });
    }
    get updateOrInsert() {
        return handleUpdateOrInsert(async (query) => {
            return this.manageQuery(query);
        });
    }
    get deleteOne() {
        return handleDeleteOne(async (query) => {
            return this.manageQuery(query);
        });
    }
    async initTransaction() {
        const db = await this.getDB();
        const transaction = await this.getTransaction(db);
        const rollbackHandler = () => {
            return new Promise((res, rej) => {
                transaction.rollbackRetaining((err) => {
                    if (err)
                        rej(err);
                    res();
                });
            });
        };
        return {
            queryRaw: handleRawQuery((query) => {
                return new Promise((res, rej) => {
                    transaction.query(query, [], (err, data) => {
                        if (err)
                            rej(err);
                        res(data);
                    });
                });
            }),
            insertOne: handleInsertOne((query) => {
                return new Promise((res, rej) => {
                    transaction.query(query, [], (err, data) => {
                        if (err)
                            rej(err);
                        res(data);
                    });
                });
            }),
            insertMany: handleInsertMany((query, length) => {
                return new Promise((res, rej) => {
                    transaction.query(query, [], (err, data) => {
                        if (err)
                            rej(err);
                        res(`${length} rows inserted`);
                    });
                });
            }),
            updateOne: handleUpdateOne((query) => {
                return new Promise((res, rej) => {
                    transaction.query(query, [], (err, data) => {
                        if (err)
                            rej(err);
                        res(data);
                    });
                });
            }),
            updateOrInsert: handleUpdateOrInsert((query) => {
                return new Promise((res, rej) => {
                    transaction.query(query, [], (err, data) => {
                        if (err)
                            rej(err);
                        res(data);
                    });
                });
            }),
            deleteOne: handleDeleteOne((query) => {
                return new Promise((res, rej) => {
                    transaction.query(query, [], (err, data) => {
                        if (err)
                            rej(err);
                        res(data);
                    });
                });
            }),
            commit: async () => {
                return new Promise((res, rej) => {
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
                return new Promise((res, rej) => {
                    transaction.commit(async (err) => {
                        if (err) {
                            await rollbackHandler();
                            rej(err);
                        }
                        db.detach((err) => {
                            if (err)
                                rej(err);
                            this.conn.destroy();
                            res();
                        });
                    });
                });
            },
        };
    }
}
function handleRawQuery(cb) {
    return (strings, ...params) => {
        const sanitizedQuery = sqlBuilder(strings, params);
        return {
            getQuery: () => sanitizedQuery,
            execute: () => {
                console.log("Executing: ", sanitizedQuery);
                return cb(sanitizedQuery);
            },
            paginated: async (take, page = 1) => {
                const pagQuery = paginatedQuery(sanitizedQuery, take, page);
                console.log("Executing: ", pagQuery);
                return cb(pagQuery);
            },
        };
    };
}
function handleInsertOne(cb) {
    return (params) => {
        const query = insertOneQuery(params);
        return {
            getQuery: () => query,
            execute: () => {
                console.log("Executing: ", query);
                return cb(query);
            },
        };
    };
}
function handleInsertMany(cb) {
    return (params) => {
        const query = insertManyQuery(params);
        return {
            getQuery: () => query,
            execute: () => {
                console.log("Executing: ", query);
                return cb(query, params.rowValues.length);
            },
        };
    };
}
function handleUpdateOne(cb) {
    return (params) => {
        const query = updateOneQuery(params);
        return {
            getQuery: () => query,
            execute: () => {
                console.log("Executing: ", query);
                return cb(query);
            },
        };
    };
}
function handleUpdateOrInsert(cb) {
    return (params) => {
        const query = updateOrInsertQuery(params);
        return {
            getQuery: () => query,
            execute: () => {
                console.log("Executing: ", query);
                return cb(query);
            },
        };
    };
}
function handleDeleteOne(cb) {
    return (params) => {
        const query = deleteOneQuery(params);
        return {
            getQuery: () => query,
            execute: () => {
                console.log("Executing: ", query);
                return cb(query);
            },
        };
    };
}
