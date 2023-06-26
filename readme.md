# firebird-query

A node-firebird wrapper for easy and safe query building.
> This package works with **node-firebird 1.1.5** under the hood.

## Installation

    npm uninstall node-firebird
    npm install firebird-query
   
## Setting up
In a **db.service. js** file
```typescript
const { pool } =  require('firebird-query');
    
const max = 10; /* count of opened sockets */
const options = {
	host:  '000.000.000.000',
	port: 3050,
	database: '/path/Database/FILE.FDB',
	user: 'SYSDBA',
	password: 'my_secure_password'
};

export const db = pool(max, options);
```

## Usage
**queryRaw** 
Input a template string literal. Parameters will automatically be escaped to avoid query injection. 
Returns an array of objects
```typescript
import { db } from './db.service.js';

const result = await db.queryRaw`
	SELECT 1 AS TEST 
	FROM RDB$DATABASE;`.execute()
console.log(result); // --> [ { TEST: 1 } ]
...

const result = db.queryRaw`
	SELECT COD, NAME 
	FROM USERS 
	WHERE SIGN_UP_DATE < ${date}`.execute();
console.log(result); 
// --> [ { COD: 1, NAME: 'JOHN' }, { COD: 2, NAME: 'JANE' } ]
```
**insertOne** 
 - rowValues: the object keys correspond to database column names
 - returning: optional array of string with column names 
```typescript
const result = await db.insertOne({
	tableName:  'USERS',
	rowValues: {
		NAME:  'JAKE',
	},
	returning: ['COD']
}).execute()
console.log(result); // --> { COD: 3 }
```
**insertMany** 
Performs an efficient INSERT statement and inserts multiple rows in a single query. 
Does not support returning clause.
```typescript
const result = await db.insertMany({
	tableName:  'USERS',
	columnNames: ['NAME', 'PHONE'],
	rowValues: [
		{ NAME:  'John', PHONE:  '555-555-5555' },
		{ NAME:  'Jane', PHONE:  '555-555-5555' },
	]
}).execute();
console.log(result); // --> 2 rows inserted
```
**updateOne** 
Update a single row. Supports returning clause with **returning** optional array of strings parameter.
```typescript
const result = await db.updateOne({
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
Update or insert a single row. Supports returning clause with **returning** optional array of strings parameter.

> WARNING: Ensure there’s only one potential row affected.

```typescript
const result = await db.updateOrInsert({
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
Each method counts on typescript inference if a returning parameter is provided.

### queryRaw
The ouput must be manually inferred.

> The result is always an array of the type provided

```typescript
const result = db.queryRaw<{ COD:  number }>`
	SELECT COD 
	FROM USERS 
	WHERE COD = ${1}`.execute();
console.log(result); // --> [ { COD: 1 } ]
```
## Transactions

 1. Get a pool from the **db** instance.
 2. From the same instance, get the **$Firebird** object that contains thw whole Firebird module.
 3. Take advantage of **queryRaw** method to build a safe query.
 4. Every transaction logic is now available.
```typescript
db.$getPool().then(pool  => {
	pool.transaction(db.$Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
		const safeQuery = db.queryRaw`SELECT 1 AS test FROM RDB$DATABASE;`.getQuery();
		transaction.query(safeQuery, [], (err, res) => {
			console.log(res); // --> [ { TEST: 1 } ]
		});
	});
});
```