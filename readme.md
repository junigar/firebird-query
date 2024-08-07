# firebird-query

A node-firebird wrapper for easy and safe query building.

> **Support with a start ⭐️**

## Installation

```bash
npm  install  firebird-query
```

## Setting up

### Quick setup

```javascript
import { FirebirdQuery } from "firebird-query";

const dbOptions = {
  host: "000.000.000.000",
  port: 3050,
  database: "/path/Database/FILE.FDB",
  user: "SYSDBA",
  password: "my_secure_password",
  maxConnections: 10, // optional
};

export const db = new FirebirdQuery(dbOptions, {
  queryLogger: true, //logs every query execution
});
```

## Usage

### queryRaw

- Input: template string literal. Parameters are automatically escaped avoiding query injection.

- Execution return: array of objects.

- Supports pagination.

```javascript
import { db } from "./db.service.js";

const result = await db.queryRaw`
	SELECT COD, NAME
	FROM USERS
	WHERE SIGN_UP_DATE < ${date}`.execute();

console.log(result);
// --> [ { COD: 1, NAME: 'JOHN' }, { COD: 2, NAME: 'JANE' } ]

const result = await db.queryRaw`
	SELECT COD, NAME
	FROM USERS
	WHERE SIGN_UP_DATE < ${date}`.paginated(1, 2);
// take: 1, page: 2 (default: 1)

console.log(result);
// --> [ { COD: 2, NAME: 'JANE' } ]
```

#### Where clauses

An object can be provided instead of a raw value.

- Object keys correspond to column names. Object values to column values.

- Multiple keys are combined as `AND` clauses

```javascript
const result = await t.queryRaw`SELECT COD, NAME FROM USERS WHERE ${{
  COD: 1,
  NAME: "John",
}}`.getQuery();

console.log(result);
// SELECT COD, NAME FROM USERS WHERE COD = '1' AND NAME = 'John'
```

#### Conditional statements

When a where happens to resolve `undefined`, it will be replaced with a tautology, making it irrelevant to the query result .

Take advantage of this behavior to conditionally add statements.

```javascript
const name = "Tom";
const result = await t.queryRaw`
	SELECT COD, NAME FROM USERS WHERE ${{
    COD: name.startsWith("J") ? 1 : undefined,
    NAME: name,
  }}`.getQuery();

console.log(result);
// SELECT COD, NAME FROM USERS WHERE 1=1 AND NAME = 'Tom'
```

#### Manually escaped statement

You can also provide a function that returns an unsafe string. It is your responsibility to escape the parameters.
This method can be useful for adding conditional clauses.

```typescript
// Define any parameters in your customClause function
const customClause = (withEscaping: boolean): ManuallyEscapedStatement => {
  // returning a function
  return (esc) => {
    const store = "McDonald's";
    if (withEscaping) {
      return `STORE = ${esc(store)}`;
    }
    return `STORE = ${store}`;
  };
};
const res = db.queryRaw`
        SELECT * FROM USERS WHERE ${customClause(true)};`.getQuery();
console.log(res);
// Expected: SELECT * FROM USERS WHERE STORE = 'McDonald''s';
```

#### Advance statements

Set anything as object key.

This example handles **case insensitive** queries.

```javascript
const name = "Tom";
const result = await t.queryRaw`
	SELECT COD, NAME FROM USERS WHERE ${{
    ["LOWER(NAME)"]: name.toLowerCase(),
  }}`.getQuery();

console.log(result);
// SELECT COD, NAME FROM USERS WHERE LOWER(NAME) = 'tom'
```

#### Operators

- Number operators

- ne: not equal !=

- gt: greater than >

- gte: greater than or equal >=

- lt: lower than <

- lte: lower than or equal <=

- between: { from: number; to: number }

- IN: number array. [1,2,3...]

- notIN: NOT IN. Number array.

- Date operators

- ne: not equal !=

- gt: greater than >

- gte: greater than or equal >=

- lt: lower than <

- lte: lower than or equal <=

- between: { from: Date; to: Date }

- IN: array

- notIN. array.

- String operators

- ne: not equal

- IN

- notIN

- startsWith

- endsWith

- contains

```javascript
const name = "Tom";
const result = await t.queryRaw`
	SELECT COD, NAME FROM USERS WHERE ${{
    COD: { gte: 1 },
    NAME: { startsWith: name },
  }}`.getQuery();

console.log(result);
// SELECT COD, NAME FROM USERS WHERE COD >= '1' AND NAME LIKE 'Tom%'
```

### insertOne

- rowValues: the object keys correspond to database column names

- returning: optional array of string with column names to be returned

```javascript
const result = await db
  .insertOne({
    tableName: "USERS",
    rowValues: {
      NAME: "JAKE",
    },
    returning: ["COD"],
  })
  .execute();

console.log(result); // --> { COD: 3 }
```

### insertMany

Performs an efficient INSERT statement and inserts multiple rows in a single query.

Does not support returning clause.

```typescript
const result = await db
  .insertMany({
    tableName: "USERS",
    columnNames: ["NAME", "PHONE"],
    rowValues: [
      { NAME: "John", PHONE: "555-555-5555" },
      { NAME: "Jane", PHONE: "555-555-0000" },
    ],
  })
  .execute();

console.log(result); // --> 2 rows inserted
```

**updateOne**

Update a single row. Optionally, supports returning.

```typescript
const result = await db.updateOne({
  tableName: "USERS",
  rowValues: {
    NAME: "John",
    PHONE: "555-555-5555",
  },
  where: {
    COD: 1,
  },
  returning: ["COD"],
});

console.log(result); // --> { COD: 1 }
```

**updateOrInsert**

Update or insert a single row. Supports returning clause

> WARNING: Ensure there’s only one potential row affected.

```typescript
const result = await db.updateOrInsert({
  tableName: "USERS",
  rowValues: {
    COD: 1,
    NAME: "John",
  },
  returning: ["COD"],
});

console.log(result); // --> { COD: 1 }
```

## Typescript usage

Each method counts on typescript inference as long as a return parameter is provided.

### queryRaw

The ouput must be manually inferred.

> The result is always an array of the type provided

```typescript
const result = await db.queryRaw<{ COD: number }>`
	SELECT COD
	FROM USERS
	WHERE COD = ${1}`.execute();

console.log(result); // --> [ { COD: 1 } ]
```

## initTransaction

A callback managed function that returns a `ISOLATION_READ_COMMITTED` transaction instance to work with. It has the same methods to query and mutate the database in addition to

1. commit

2. rollback

```javascript
// recommended approach
db.initTransaction(async (t) => {
  // t(ransaction) is scoped into this async function.
  try {
    const data = await t.queryRaw`
            SELECT 1 AS TEST FROM RDB$DATABASE;
            `.execute();
    console.log(data); // --> [{ TEST: 1 }]
  } catch (error) {
    console.log(error);
  }
});
```
