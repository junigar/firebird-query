import Firebird from "node-firebird";
const escape = (...val) => Firebird.escape(val.join(""));
const buildWhereClause = (obj, prefix = "", clause = "AND") => {
    const clauses = [];
    if (isSingleUndefinedValue(obj)) {
        return defaultCondition(clause);
    }
    for (const key in obj) {
        const val = obj[key];
        if (isWhereObjectArr(val)) {
            clauses.push(handleOrCondition(val, prefix));
        }
        else if (isWhereObject(val)) {
            clauses.push(...handleObjectCondition(val, prefix, key));
        }
        else if (isPrimitiveValue(val)) {
            clauses.push(handlePrimitiveValue(val, prefix, key));
        }
        else {
            clauses.push(defaultCondition(clause));
        }
    }
    return clauses.join(" AND ");
};
const isSingleUndefinedValue = (obj) => Object.values(obj).length === 1 && Object.values(obj)[0] === undefined;
const defaultCondition = (clause) => clause === "AND" ? "1=1" : "1=0";
const isWhereObject = (val) => typeof val === "object" && !Array.isArray(val) && !(val instanceof Date);
const isWhereObjectArr = (val) => Array.isArray(val) && isWhereObject(val[0]);
const isPrimitiveValue = (val) => typeof val === "string" ||
    typeof val === "number" ||
    typeof val === "boolean" ||
    val instanceof Date ||
    val === null ||
    val === undefined;
const handleOrCondition = (val, prefix) => {
    const orClauses = val.map((orObj) => buildWhereClause(orObj, prefix, "OR"));
    return `(${orClauses.join(" OR ")})`;
};
const handleObjectCondition = (val, prefix, key) => {
    const clauses = [];
    for (const subKey in val) {
        const value = val[subKey];
        let condition = "";
        switch (subKey) {
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
                condition = `${prefix}${key} BETWEEN ${escape(value["from"])} AND ${escape(value["to"])}`;
                break;
            case "IN":
                condition = `${prefix}${key} IN (${value
                    .map((i) => escape(i))
                    .join(", ")})`;
                break;
            case "notIN":
                condition = `${prefix}${key} NOT IN (${value
                    .map((i) => escape(i))
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
const handlePrimitiveValue = (val, prefix, key) => (val === undefined ? "1=1" : `${prefix}${key} = ${escape(val)}`);
export const sqlBuilder = (strings, params) => {
    return strings
        .map((cur, i) => {
        const param = params[i];
        if (isWhereObject(param)) {
            const conditions = param;
            const conditionResult = buildWhereClause(conditions);
            return cur + conditionResult;
        }
        else if (isPrimitiveValue(param)) {
            const isLastStr = i === strings.length - 1;
            const valueResult = !isLastStr ? escape(param) : "";
            return cur + valueResult;
        }
        else {
            return "";
        }
    })
        .join("");
};
export const paginatedQuery = (query, take, page) => {
    const skip = take * (page - 1);
    return `SELECT FIRST ${take} SKIP ${skip} * FROM (${query.replace(/;*$/g, "")});`;
};
export const insertOneQuery = (params) => {
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
export const insertManyQuery = ({ tableName, columnNames, rowValues, }) => {
    const sortedColumnsStr = columnNames.slice().sort().join(", ");
    const selectStatements = rowValues.map((row) => {
        const sortedRow = Object.entries(row).sort(([a], [b]) => a.localeCompare(b));
        const valuesList = sortedRow.map(([, value]) => escape(value)).join(", ");
        return `SELECT ${valuesList} FROM RDB$DATABASE`;
    });
    const toInsertStatement = selectStatements.join(" UNION ALL ");
    const query = `INSERT INTO ${tableName} (${sortedColumnsStr}) ${toInsertStatement};`;
    return query;
};
export const updateOneQuery = ({ tableName, rowValues, returning = [], where, }) => {
    const toSet = Object.entries(rowValues).map(([columnName, value]) => `${columnName} = ${escape(value)}`);
    const valuesStr = toSet.join(", ");
    const whereStr = buildWhereClause(where);
    let query = `UPDATE ${tableName} SET ${valuesStr} WHERE ${whereStr}`;
    if (returning.length > 0) {
        query += ` RETURNING ${returning.join(", ")}`;
    }
    query += ";";
    return query;
};
export const updateOrInsertQuery = ({ tableName, rowValues, returning = [], }) => {
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
export const deleteOneQuery = (params) => {
    const { where, returning = [], tableName } = params;
    const whereClauses = buildWhereClause(where);
    let query = `DELETE FROM ${tableName} WHERE ${whereClauses}`;
    if (returning.length > 0) {
        query += ` RETURNING ${returning.join(", ")}`;
    }
    query += ";";
    return query;
};
