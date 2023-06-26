import { escape } from "node-firebird";

type PrimetiveValue = string | number | boolean | Date | null | undefined;
type Operators =
  | {
      ne?: number;
      gt?: number;
      gte?: number;
      lt?: number;
      lte?: number;
      between?: { from: number; to: number };
      IN?: number[];
      notIN?: number[];
    }
  | {
      ne?: Date;
      gt?: Date;
      gte?: Date;
      lt?: Date;
      lte?: Date;
      between?: { from: Date; to: Date };
      IN?: Date[];
      notIN?: Date[];
    }
  | {
      ne?: string;
      IN?: string[];
      notIN?: string[];
    };

type WhereObject =
  | {
      OR?: WhereObject[];
    }
  | {
      [k in string]: Operators | PrimetiveValue;
    };

export const whereClause: WhereObject = {
  OR: [
    {
      USER_NAME: "Jane",
      AGE: {
        ne: 22,
      },
    },
    {
      USER_NAME: "Jake",
    },
    {
      USER_NAME: "John",
      AGE: {
        IN: [20, 21],
      },
    },
  ],
  COUNTRY: "USA",
  DATE_SIGNUP: {
    between: { from: new Date(2020, 1, 1), to: new Date(2020, 12, 31) },
  },
};

export function buildWhereClause(
  obj: WhereObject,
  prefix = "",
  clause = "AND"
) {
  const clauses = [];
  if (Object.values(obj).length === 1) {
    if (Object.values(obj)[0] === undefined) {
      return clause === "AND" ? "1 = 1" : "1 = 0";
    }
  }
  for (const key in obj) {
    const val = (obj as any)[key];
    if (key === "OR" && Array.isArray(val)) {
      const arr = val as WhereObject[];
      const orClauses: string[] = arr.map((orObj) =>
        buildWhereClause(orObj, prefix, "OR")
      );
      clauses.push(`(${orClauses.join(" OR ")})`);
    } else if (typeof val === "object" && !Array.isArray(val)) {
      for (const subKey in val) {
        const value = val[subKey];
        if (subKey === "ne") {
          clauses.push(`${prefix}${key} != ${escape(value)}`);
        } else if (subKey === "gt") {
          clauses.push(`${prefix}${key} > ${escape(value)}`);
        } else if (subKey === "gte") {
          clauses.push(`${prefix}${key} >= ${escape(value)}`);
        } else if (subKey === "lt") {
          clauses.push(`${prefix}${key} < ${escape(value)}`);
        } else if (subKey === "lte") {
          clauses.push(`${prefix}${key} <= ${escape(value)}`);
        } else if (subKey === "between") {
          clauses.push(
            `${prefix}${key} BETWEEN ${escape(value["from"])} AND ${escape(
              value["to"]
            )}`
          );
        } else if (subKey === "IN") {
          clauses.push(`${prefix}${key} IN (${value.map(escape).join(", ")})`);
        } else if (subKey === "notIN") {
          clauses.push(
            `${prefix}${key} NOT IN (${value.map(escape).join(", ")})`
          );
        }
      }
    } else {
      const value = val;
      if (value === undefined) {
        clauses.push("1 = 1");
      } else {
        clauses.push(`${prefix}${key} = ${escape(value)}`);
      }
    }
  }
  return clauses.join(` AND `);
}
