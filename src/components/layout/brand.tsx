import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="SceneStack home">
      <svg
        viewBox="0 0 32 34"
        width="27"
        height="29"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m4 12 12-7 12 7-12 7Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="m4 18 12 7 12-7M4 24l12 7 12-7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        scene<span className="brand-light">stack</span>
        <span className="brand-period">.</span>
      </span>
    </Link>
  );
}
