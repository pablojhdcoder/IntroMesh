import Image from "next/image";

export function ProfileQr({
  slug,
  name,
  size = 200,
}: {
  slug: string;
  name: string;
  size?: number;
}) {
  return (
    <div className="w-fit rounded-md bg-foreground p-3 dark:bg-[#16180f]">
      <Image
        src={`/api/profiles/${slug}/qr`}
        alt={`QR code for ${name}'s profile`}
        width={size}
        height={size}
        unoptimized
        className="block"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
