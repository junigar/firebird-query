"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebirdQuery = void 0;
const node_firebird_1 = __importDefault(require("node-firebird"));
const sql_builder_1 = require("./sql_builder");
const defaultOptions = {
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT) || 3050,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER || "SYSDBA",
    password: process.env.DB_PASSWORD,
};
class FirebirdQuery {
    constructor(options = defaultOptions, max = 10) {
        this.conn = node_firebird_1.default.pool(max, options);
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
    getTransaction(db) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((res, rej) => {
                db.transaction(node_firebird_1.default.ISOLATION_READ_COMMITTED, (err, transaction) => {
                    if (err) {
                        rej(err);
                    }
                    else {
                        res(transaction);
                    }
                });
            });
        });
    }
    get queryRaw() {
        return handleRawQuery((query) => __awaiter(this, void 0, void 0, function* () {
            return this.manageQuery(query);
        }));
    }
    get insertOne() {
        return handleInsertOne((query) => __awaiter(this, void 0, void 0, function* () {
            return this.manageQuery(query);
        }));
    }
    get insertMany() {
        return handleInsertMany((query, length) => __awaiter(this, void 0, void 0, function* () {
            yield this.manageQuery(query);
            return `${length} rows inserted`;
        }));
    }
    get updateOne() {
        return handleUpdateOne((query) => __awaiter(this, void 0, void 0, function* () {
            return this.manageQuery(query);
        }));
    }
    get updateOrInsert() {
        return handleUpdateOrInsert((query) => __awaiter(this, void 0, void 0, function* () {
            return this.manageQuery(query);
        }));
    }
    get deleteOne() {
        return handleDeleteOne((query) => __awaiter(this, void 0, void 0, function* () {
            return this.manageQuery(query);
        }));
    }
    initTransaction() {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDB();
            const transaction = yield this.getTransaction(db);
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
                commit: () => __awaiter(this, void 0, void 0, function* () {
                    return new Promise((res, rej) => {
                        transaction.commit((err) => __awaiter(this, void 0, void 0, function* () {
                            if (err) {
                                yield rollbackHandler();
                                rej(err);
                            }
                            res();
                        }));
                    });
                }),
                rollback: () => __awaiter(this, void 0, void 0, function* () { return rollbackHandler(); }),
                close: () => __awaiter(this, void 0, void 0, function* () {
                    return new Promise((res, rej) => {
                        transaction.commit((err) => __awaiter(this, void 0, void 0, function* () {
                            if (err) {
                                yield rollbackHandler();
                                rej(err);
                            }
                            db.detach((err) => {
                                if (err)
                                    rej(err);
                                this.conn.destroy();
                                res();
                            });
                        }));
                    });
                }),
            };
        });
    }
}
exports.FirebirdQuery = FirebirdQuery;
function handleRawQuery(cb) {
    return (strings, ...params) => {
        const sanitizedQuery = (0, sql_builder_1.sqlBuilder)(strings, params);
        return {
            getQuery: () => sanitizedQuery,
            execute: () => {
                console.log("Executing: ", sanitizedQuery);
                return cb(sanitizedQuery);
            },
            paginated: (take, page = 1) => __awaiter(this, void 0, void 0, function* () {
                const pagQuery = (0, sql_builder_1.paginatedQuery)(sanitizedQuery, take, page);
                console.log("Executing: ", pagQuery);
                return cb(pagQuery);
            }),
        };
    };
}
function handleInsertOne(cb) {
    return (params) => {
        const query = (0, sql_builder_1.insertOneQuery)(params);
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
        const query = (0, sql_builder_1.insertManyQuery)(params);
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
        const query = (0, sql_builder_1.updateOneQuery)(params);
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
        const query = (0, sql_builder_1.updateOrInsertQuery)(params);
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
        const query = (0, sql_builder_1.deleteOneQuery)(params);
        return {
            getQuery: () => query,
            execute: () => {
                console.log("Executing: ", query);
                return cb(query);
            },
        };
    };
}
