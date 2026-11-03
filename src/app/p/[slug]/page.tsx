import { redirect } from "next/navigation";

export default async function LegacyProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/u/${slug}`);
}
