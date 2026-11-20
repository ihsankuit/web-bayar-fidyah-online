/**
 * Whether a Supabase/PostgREST error means "that column does not exist".
 *
 * Used where the app ships ahead of a migration and wants to keep working
 * until it is run: an insert naming a column the table lacks fails with one
 * of these, and the caller can retry without the column instead of failing
 * a payment over missing bookkeeping.
 *
 * PostgREST answers PGRST204 when its schema cache has no such column;
 * Postgres itself answers 42703. The message is checked as well because a
 * proxy or an older PostgREST can surface either without the code.
 */
export function isMissingColumnError(
  error: { code?: string; message?: string } | null | undefined,
  column: string
): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  if (!message.includes(column)) return false;
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /could not find|does not exist/i.test(message)
  );
}
