import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://lifeline:lifeline@localhost:5432/lifeline",
};
