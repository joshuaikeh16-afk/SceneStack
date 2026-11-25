"use client";
import { useTitleMutation, useTitleState } from "./title-state";
import { useProduct } from "./providers";
export function TitleFeedback({ id }: { id: string }) {
  const { bootstrap, online } = useProduct();
  const mutation = useTitleMutation(id);
  const state = useTitleState(id, true);
  if (
    !bootstrap.userId ||
    bootstrap.availability !== "ready" ||
    !bootstrap.onboarding?.completed_at ||
    bootstrap.profile?.status !== "active"
  )
    return null;
  const blocked =
    !online || mutation.isPending || state.isPending || state.isError;
  return (
    <section className="detail-feedback" aria-labelledby={`feedback-${id}`}>
      <h3 id={`feedback-${id}`}>Make discovery more yours</h3>
      <p>
        These choices adjust recommendations. Your tracking stays as you set it.
      </p>
      <div>
        <button
          className="button button-secondary"
          disabled={blocked}
          onClick={() =>
            mutation.mutate({
              action: "feedback",
              titleId: id,
              feedback: "not_interested",
            })
          }
        >
          Not Interested
        </button>
        <button
          className="button button-secondary"
          disabled={blocked}
          onClick={() =>
            mutation.mutate({
              action: "feedback",
              titleId: id,
              feedback: "already_seen",
            })
          }
        >
          Already Seen
        </button>
      </div>
      {mutation.isError && (
        <p className="form-error" role="alert">
          {mutation.error.message}
        </p>
      )}
    </section>
  );
}
