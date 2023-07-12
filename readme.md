

# firebird-query
A node-firebird wrapper for easy and safe query building.  

## Installation

```bash
npm install firebird-query
```

## Setting up

### Quick setup

```typescript
const { FirebirdQuery } =  require('firebird-query');

const  max = 10; /* opened sockets */
const  options = {
	host:  '000.000.000.000',
	port:  3050,
	database:  '/path/Database/FILE.FDB',
	user:  'SYSDBA',
	password:  'my_secure_password'
};
export const db = new FirebirdQuery(options, max);
```

### Or
 Configure a `.env` 
```batch
DB_HOST="000.000.000.000"
DB_PORT=3050
DB_DATABASE="/path/Database/FILE.FDB"
DB_USER="SYSDBA"
DB_PASSWORD="my_secure_password"
```
Then
```typescript
export const db = new FirebirdQuery();
```

## Usage

### queryRaw

 - Input: template string literal. Parameters are automatically escaped avoiding query injection.
 - Execution return: array of objects.
 - Supports pagination.
```typescript
import { db } from  './db.service.js';

const  result = db.queryRaw`
	SELECT COD, NAME
	FROM USERS
	WHERE SIGN_UP_DATE < ${date}`.execute();

console.log(result);
// --> [ { COD: 1, NAME: 'JOHN' }, { COD: 2, NAME: 'JANE' } ]

const  result = db.queryRaw`
	SELECT COD, NAME
	FROM USERS
	WHERE SIGN_UP_DATE < ${date}`.paginated(1,2); // take: 1, page: 2

console.log(result); 
// --> [ { COD: 2, NAME: 'JANE' } ]
```
#### Where clauses

An object can be provided instead of a raw value.

 - Object keys correspond to column names. Object values to column
   values.
 - Multiple keys are combined as `AND` clauses

```typescript
const  result  =  t.queryRaw`SELECT COD, NAME FROM USERS WHERE ${{
	COD:  1,
	NAME:  "John",
}}`.getQuery();
console.log(result);
// SELECT COD, NAME FROM USERS WHERE COD = '1' AND NAME = 'John'
```
#### Conditional statements
If a where clause resolved to `undefined`, it will be replaced with a tautology, making it irrelevant to the query result .
Take advantage of this behavior to conditionally add statements.
```typescript
const  name  =  "Tom";
const  result  =  t.queryRaw`SELECT COD, NAME FROM USERS WHERE ${{
	COD:  name.startsWith("J") ? 1 : undefined,
	NAME:  name,
}}`.getQuery();

console.log(result);
// SELECT COD, NAME FROM USERS WHERE 1=1 AND NAME = 'Tom'
```
#### Advance statements
Set anything as object key. 
This example handles **case insensitive** queries.
```typescript
const  name  =  "Tom";
const  result  =  t.queryRaw`SELECT COD, NAME FROM USERS WHERE ${{
["LOWER(NAME)"]:  name.toLowerCase(),
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

```typescript
const  name  =  "Tom";
const  result  =  t.queryRaw`SELECT COD, NAME FROM USERS WHERE ${{
COD: { gte:  1 },
NAME: { startsWith:  name },
}}`.getQuery();

console.log(result);
// SELECT COD, NAME FROM USERS WHERE COD >= '1' AND NAME LIKE 'Tom%'
```

### insertOne

- rowValues: the object keys correspond to database column names
- returning: optional array of string with column names to be returned 

```typescript
const  result = await  db.insertOne({
	tableName:  'USERS',
	rowValues: {
		NAME:  'JAKE',
	},
	returning: ['COD']
}).execute()
console.log(result); // --> { COD: 3 }
```
### insertMany

Performs an efficient INSERT statement and inserts multiple rows in a single query.

Does not support returning clause.

```typescript

const  result = await  db.insertMany({
	tableName:  'USERS',
	columnNames: ['NAME', 'PHONE'],
	rowValues: [
		{ NAME:  'John', PHONE:  '555-555-5555' },
		{ NAME:  'Jane', PHONE:  '555-555-0000' },
	]
}).execute();

console.log(result); // --> 2 rows inserted

```

**updateOne**

Update a single row. Supports returning.

```typescript
const  result = await  db.updateOne({
	tableName:  'USERS',	
	rowValues: {
		NAME:  'John',
		PHONE:  '555-555-5555'
	},
	conditions: {
		COD:  1
	},
	returning: ['COD']
});

console.log(result); // --> { COD: 1 }
```

**updateOrInsert**
Update or insert a single row. Supports returning clause

> WARNING: Ensure there’s only one potential row affected.

```typescript
const  result = await  db.updateOrInsert({
	tableName:  'USERS',
	rowValues: {
		COD:  1,
		NAME:  'John',
	},
	returning: ['COD']
});

console.log(result); // --> { COD: 1 }

```

## Typescript usage

Each method counts on typescript inference as long as a return parameter is provided.  

### queryRaw
The ouput must be manually inferred.

> The result is always an array of the type provided

  

```typescript

const  result = db.queryRaw<{ COD: number }>`
	SELECT COD
	FROM USERS
	WHERE COD = ${1}`.execute();
console.log(result); // --> [ { COD: 1 } ]
```

## initTransaction
An async method that returns a ISOLATION_READ_COMMITTED transaction instance to work with. It has the same methods to query and mutate the database in addition to 

 1. commit
 2. close
 3. rollback

```typescript
// recommended usage
db.initTransaction().then(async (t) => {
// t(ransaction) is scoped in this async function. 
//Every query and mutation correspond to this specific transaction.
})
```

## Support with a start ⭐️