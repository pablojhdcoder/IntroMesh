import Link from "next/link";
import { notFound } from "next/navigation";
import { goalLabel } from "@/domain/catalog";
import { service } from "@/lib/http";
import { ShareTools } from "@/components/share-tools";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await service().profileBySlug(slug);
  if (!profile) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 py-16">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          IntroMesh
        </Link>
      </p>
      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-5xl leading-none tracking-[-0.03em]">{profile.displayName}</h1>
        <p className="text-sm text-muted-foreground">
          {profile.role}
          {profile.demo ? " · Demostración" : ""} · {goalLabel(profile.goal)}
        </p>
      </header>
      {profile.presentation ? <p className="max-w-[48ch] text-[0.9375rem] leading-normal">{profile.presentation.summary}</p> : null}
      <ul className="flex flex-col gap-1 text-sm">
        {profile.interests.map((item) => (
          <li key={item}>Interés: {item}</li>
        ))}
        {profile.skills.map((item) => (
          <li key={item}>Habilidad: {item}</li>
        ))}
        {profile.projects.map((item) => (
          <li key={item}>Proyecto: {item}</li>
        ))}
      </ul>
      <ShareTools slug={profile.slug} name={profile.displayName} />
      <p className="text-sm text-muted-foreground">
        Esta página solo muestra la identidad que la persona autorizó. Una conexión privada sigue pidiendo aceptación.
      </p>
    </main>
  );
}
