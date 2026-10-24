/* eslint-disable @next/next/no-img-element */
export default function Avatar({
  src,
  name,
  size = 56,
  ring = false,
}: {
  src: string;
  name: string;
  size?: number;
  ring?: boolean;
}) {
  const img = (
    <img
      src={src}
      alt={name}
      className={`rounded-full object-cover ${ring ? "border-2 border-white" : ""}`}
      style={{ width: size, height: size }}
    />
  );
  if (!ring) return img;
  return <div className="rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">{img}</div>;
}
