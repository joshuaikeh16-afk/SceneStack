"use client";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: "15vh 24px",
          background: "#101112",
          color: "#f5f3ee",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <h1>An unexpected intermission.</h1>
        <p>SceneStack couldn’t load. Please try again.</p>
        <button
          onClick={retry}
          style={{ padding: "12px 24px", fontSize: 16, cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
