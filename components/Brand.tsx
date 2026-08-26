import Link from "next/link";

export default function Brand({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`brand brand-lockup ${className}`.trim()} aria-label="AnnotaLearn首頁">
      <span className="brand-logo" aria-hidden="true" />
      <span>AnnotaLearn</span>
    </Link>
  );
}
