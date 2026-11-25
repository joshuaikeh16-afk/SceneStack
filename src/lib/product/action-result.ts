import "server-only";
import { ZodError } from "zod";
import { DataAccessError } from "@/lib/data/errors";
import type { ActionReply } from "@/types/product";
export async function perform<T>(
  operation: () => Promise<T>,
): Promise<ActionReply<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    if (error instanceof ZodError)
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: error.issues[0]?.message ?? "Check the details and try again.",
      };
    if (error instanceof DataAccessError)
      return { ok: false, code: error.code, message: error.message };
    return {
      ok: false,
      code: "UNAVAILABLE",
      message: "We couldn’t save that change. Please try again.",
    };
  }
}
