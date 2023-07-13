export type PrimetiveValue = null | undefined | boolean | string | number | Date;
type NumberOperators = {
    ne?: number;
    gt?: number;
    gte?: number;
    lt?: number;
    lte?: number;
    between?: {
        from: number;
        to: number;
    };
    IN?: number[];
    notIN?: number[];
};
type DateOperators = {
    ne?: Date;
    gt?: Date;
    gte?: Date;
    lt?: Date;
    lte?: Date;
    between?: {
        from: Date;
        to: Date;
    };
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
type keyOmit<T, U extends keyof any> = T & {
    [P in U]?: never;
};
export type WhereObject = keyOmit<{
    [key: string]: PrimetiveValue | WhereConditions;
}, "OR"> | {
    OR: WhereObject[];
};
export type QueryParam = PrimetiveValue | WhereObject;
export declare const sqlBuilder: (strings: TemplateStringsArray, params: QueryParam[]) => string;
export declare const paginatedQuery: (query: string, take: number, page: number) => string;
export type InsertOneParams<T extends {
    [key: string]: any;
}> = {
    tableName: string;
    rowValues: object;
    returning?: (keyof T | string)[];
};
export declare const insertOneQuery: <T extends {
    [key: string]: any;
}>(params: InsertOneParams<T>) => string;
export type InsertParams<T> = {
    readonly tableName: string;
    readonly rowValues: ReadonlyArray<{
        [k in keyof T]: any;
    }>;
    readonly columnNames: ReadonlyArray<keyof T>;
};
export declare const insertManyQuery: <T>({ tableName, columnNames, rowValues, }: InsertParams<T>) => string;
export type UpdateOneParams<T> = {
    readonly tableName: string;
    readonly rowValues: {
        [k in string]: any;
    };
    readonly where: WhereObject;
    readonly returning?: ReadonlyArray<keyof T | string>;
};
export declare const updateOneQuery: <T = void>({ tableName, rowValues, returning, where, }: UpdateOneParams<T>) => string;
export type UpdateOrInsertParams<T> = {
    readonly tableName: string;
    readonly rowValues: {
        [k in string]: any;
    };
    readonly returning?: ReadonlyArray<keyof T | string>;
};
export declare const updateOrInsertQuery: <T>({ tableName, rowValues, returning, }: UpdateOrInsertParams<T>) => string;
export type DeleteOneParams<T> = {
    readonly tableName: string;
    readonly where: WhereObject;
    readonly returning?: ReadonlyArray<keyof T | string>;
};
export declare const deleteOneQuery: <T>(params: DeleteOneParams<T>) => string;
export {};
//# sourceMappingURL=index.d.ts.map