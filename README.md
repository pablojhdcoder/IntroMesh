# IntroMesh

Networking presencial asistido por Meta Model API. El hilo del producto es Discover → Understand → Connect → Learn.

## Arranque

```bash
npm install
cp .env.example .env.local
npm run dev
```

La aplicación arranca sin claves. Meta y Supabase fallan de forma explícita solo cuando se usan.

## Comprobaciones

```bash
npm test
npm run lint
npm run verify:meta
```

`verify:meta` llama a la API solo si `MODEL_API_KEY` está en `.env.local`. Sin clave termina con código 2 y no hace la petición.

## Documentos

- `DESIGN.md` — sistema visual
- `PRODUCT.md` — verdad de producto
- `ARCHITECTURE.md` — capas, presencia y matching
- `PRIVACY.md` — consentimiento y datos
- `AGENTS.md` — convenciones para agentes
