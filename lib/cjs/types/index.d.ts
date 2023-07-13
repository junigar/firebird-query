import Firebird from "node-firebird";
import { DeleteOneParams, InsertOneParams, InsertParams, QueryParam, UpdateOneParams, UpdateOrInsertParams } from "./sql_builder";
export declare class FirebirdQuery {
    private conn;
    constructor(options?: Firebird.Options, max?: number);
    private getDB;
    private manageQuery;
    private getTransaction;
    get queryRaw(): <T>(strings: TemplateStringsArray, ...params: QueryParam[]) => {
        getQuery: () => string;
        execute: () => Promise<T[]>;
        paginated: (take: number, page?: number) => Promise<T[]>;
    };
    get insertOne(): <T extends {
        [key: string]: any;
    }>(params: InsertOneParams<T>) => {
        getQuery: () => string;
        execute: () => Promise<T>;
    };
    get insertMany(): <T extends {
        [key: string]: any;
    }>(params: InsertParams<T>) => {
        getQuery: () => string;
        execute: () => Promise<string>;
    };
    get updateOne(): <T>(params: UpdateOneParams<T>) => {
        getQuery: () => string;
        execute: () => Promise<T>;
    };
    get updateOrInsert(): <T>(params: UpdateOrInsertParams<T>) => {
        getQuery: () => string;
        execute: () => Promise<T>;
    };
    get deleteOne(): <T>(params: DeleteOneParams<T>) => {
        getQuery: () => string;
        execute: () => Promise<T>;
    };
    initTransaction(): Promise<{
        queryRaw: <T>(strings: TemplateStringsArray, ...params: QueryParam[]) => {
            getQuery: () => string;
            execute: () => Promise<T[]>;
            paginated: (take: number, page?: number) => Promise<T[]>;
        };
        insertOne: <T_1 extends {
            [key: string]: any;
        }>(params: InsertOneParams<T_1>) => {
            getQuery: () => string;
            execute: () => Promise<T_1>;
        };
        insertMany: <T_2 extends {
            [key: string]: any;
        }>(params: InsertParams<T_2>) => {
            getQuery: () => string;
            execute: () => Promise<string>;
        };
        updateOne: <T_3>(params: UpdateOneParams<T_3>) => {
            getQuery: () => string;
            execute: () => Promise<T_3>;
        };
        updateOrInsert: <T_4>(params: UpdateOrInsertParams<T_4>) => {
            getQuery: () => string;
            execute: () => Promise<T_4>;
        };
        deleteOne: <T_5>(params: DeleteOneParams<T_5>) => {
            getQuery: () => string;
            execute: () => Promise<T_5>;
        };
        commit: () => Promise<void>;
        rollback: () => Promise<void>;
        close: () => Promise<void>;
    }>;
}
//# sourceMappingURL=index.d.ts.map