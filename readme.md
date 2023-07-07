

# firebird-query
A node-firebird wrapper for easy and safe query building.  

## Installation
npm install firebird-query

## Setting up

In a **db.service. js** file

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
export const  db = new FirebirdQuery(options, max);
```
## Usage

**queryRaw**

 - Input: template string literal. Parameters will automatically be escaped to avoid query injection.
 - Return: array of objects
 - Supports pagination 
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

**insertOne**

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
**insertMany**

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
// t is scoped in this async function. 
//Every mutation and query correspond to that specific transaction.
})
```