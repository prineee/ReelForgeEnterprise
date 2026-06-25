interface Props {
  title: string;
  highlight?: string;
  center?: boolean;
}

export default function GradientHeading({
  title,
  highlight,
  center = false,
}: Props) {
  return (
    <div className={center ? "text-center" : ""}>
      <h2 className="text-5xl md:text-6xl font-black leading-tight">

        {title}

        {highlight && (
          <>
            {" "}
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-purple-500 bg-clip-text text-transparent">
              {highlight}
            </span>
          </>
        )}

      </h2>
    </div>
  );
}