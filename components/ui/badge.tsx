interface BadgeProps {
  children: React.ReactNode;
  color?: "purple" | "orange" | "blue";
}

export default function Badge({
  children,
  color = "purple",
}: BadgeProps) {
  const styles = {
    purple:
      "bg-purple-600/20 text-purple-300 border border-purple-500/30",

    orange:
      "bg-orange-500/20 text-orange-300 border border-orange-500/30",

    blue:
      "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  };

  return (
    <span
      className={`
      inline-flex
      items-center
      rounded-full
      px-4
      py-2
      text-sm
      font-semibold
      backdrop-blur-md
      ${styles[color]}
      `}
    >
      {children}
    </span>
  );
}