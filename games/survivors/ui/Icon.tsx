export function Icon({ name, className = "" }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    hammer: "M3 3h12v7H3z M8 10h3v12H8z M1 4h2v5H1z M15 4h2v5h-2z",
    sun: "M9 0h3v4H9z M9 18h3v4H9z M0 9h4v3H0z M18 9h4v3h-4z M5 5h12v12H5z M2 2h3v3H2z M17 17h3v3h-3z M17 2h3v3h-3z M2 17h3v3H2z",
    shield: "M3 2h16v12h-3v3h-3v3H9v-3H6v-3H3z M9 5v9h4V5z",
    spark: "M12 0 3 13h7l-1 9 10-14h-7z",
    heart: "M2 4h7v3h4V4h7v10h-3v3h-3v3H8v-3H5v-3H2z",
    boot: "M6 1h9v12h5v7H3v-7h3z",
    gem: "M10 1h2v3h3v3h3v7h-3v3h-3v3h-2v-3H7v-3H4V7h3V4h3z",
    skull: "M5 2h12v3h3v11h-5v5h-3v-5h-2v5H7v-5H2V5h3z M5 7v5h4V7z M13 7v5h4V7z",
    pause: "M5 3h4v16H5z M13 3h4v16h-4z",
    play: "M5 2v18l15-9z",
    sound: "M2 8h4l6-6v18l-6-6H2z M15 6h3v10h-3z M20 3h2v16h-2z",
    mute: "M2 8h4l6-6v18l-6-6H2z M15 7l2-2 3 4 3-4 2 2-3 4 3 4-2 2-3-4-3 4-2-2 3-4z",
    expand: "M2 2h7v3H5v4H2z M15 2h7v7h-3V5h-4z M2 15h3v4h4v3H2z M19 15h3v7h-7v-3h4z",
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d={paths[name] ?? paths.spark} />
    </svg>
  );
}
