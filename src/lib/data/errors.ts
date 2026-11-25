export class DataAccessError extends Error {
  constructor(
    public readonly code:
      | "AUTH_REQUIRED"
      | "FORBIDDEN"
      | "INVALID_INPUT"
      | "CONFLICT"
      | "SETUP_REQUIRED"
      | "RATE_LIMITED"
      | "UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "DataAccessError";
  }
}
export function databaseFailure(error: {
  code?: string;
  message?: string;
}): never {
  if (
    ["42P01", "42703", "42883", "PGRST202", "PGRST205"].includes(
      error.code || "",
    )
  )
    throw new DataAccessError(
      "SETUP_REQUIRED",
      "The database foundation is not deployed yet. Apply the reviewed SceneStack migrations first.",
    );
  if (error.code === "42501")
    throw new DataAccessError(
      "FORBIDDEN",
      "This action is not available for your account.",
    );
  if (error.code === "40001")
    throw new DataAccessError(
      "CONFLICT",
      "This collection changed in another view. Reload its latest version, then review and retry your edits.",
    );
  if (error.code === "23505")
    throw new DataAccessError(
      "CONFLICT",
      "That username or item is already in use.",
    );
  if (["23514", "23502", "22P02", "23503", "23001"].includes(error.code || ""))
    throw new DataAccessError(
      "INVALID_INPUT",
      "Some details are invalid or no longer available.",
    );
  throw new DataAccessError(
    "UNAVAILABLE",
    "We couldn’t complete that action. Please try again later.",
  );
}
export async function result<T>(
  operation: PromiseLike<{
    data: T | null;
    status?: number;
    error: { code?: string; message?: string } | null;
  }>,
): Promise<T | null> {
  let response;
  try {
    response = await operation;
  } catch {
    throw new DataAccessError(
      "UNAVAILABLE",
      "We couldn’t reach the data service. Please try again later.",
    );
  }
  if (response.status === 429)
    throw new DataAccessError(
      "RATE_LIMITED",
      "The data service is busy. Please try again shortly.",
    );
  if (response.error) databaseFailure(response.error);
  return response.data;
}
