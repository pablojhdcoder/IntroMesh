import { LoopStage } from "@/components/loop-stage";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-16 sm:gap-24 sm:px-10 sm:py-24">
      <header className="flex max-w-[18ch] flex-col gap-6">
        <h1 className="font-heading text-[clamp(2.5rem,6vw,4.5rem)] leading-none tracking-[-0.03em] text-balance">
          IntroMesh
        </h1>
        <p className="max-w-[36ch] text-[0.9375rem] leading-normal text-muted-foreground">
          De una persona visible a una razón para hablar, y de ahí a una relación que las dos aceptan.
        </p>
      </header>
      <LoopStage />
      <p className="max-w-[68ch] text-sm leading-normal text-muted-foreground">
        No hay sesión abierta. Esta pantalla no contiene asistentes ni una respuesta del modelo.
      </p>
    </main>
  );
}
