import { readFileSync } from "fs";
import { join } from "path";
import { PGlite } from "@electric-sql/pglite";

export type Db = PGlite;

const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");

export const createDb = async (): Promise<Db> => {
	const db = new PGlite();
	await db.exec(schema);
	return db;
};
