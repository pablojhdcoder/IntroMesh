# Contribuir a IntroMesh

Gracias por querer mejorar el recorrido Discover → Understand → Connect → Learn. Los cambios pequeños y revisables entran antes que los rediseños amplios.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local
npm run dev
```

La app abre en http://localhost:3000. Sin Supabase, los datos viven en `.data/store.json`, que no se versiona.

Antes de abrir un pull request:

```bash
npm test
npm run lint
```

`npm run build` cuando el cambio toca rutas, configuración o el grafo. `npm run verify:meta` solo si hay `MODEL_API_KEY` en `.env.local`. Una llamada no verificada no se declara exitosa.

## Ramas

`main` se mantiene desplegable. El trabajo nuevo sale de `main` actualizada.

| Prefijo | Cuándo |
| --- | --- |
| `feat/` | Comportamiento nuevo del recorrido |
| `fix/` | Corrección de un fallo |
| `docs/` | Documentación, sin cambio de producto |
| `chore/` | Dependencias, tooling o tareas que no ve la persona usuaria |

El nombre va en kebab-case y dice el cambio, no el número de issue: `fix/camera-returns-to-room`. Una rama, un tema. Si el tema crece, se parte en pull requests distintos.

No se hace push directo a `main`.

## Commits

Un commit, una idea. El mensaje está en inglés, en imperativo, y explica el porqué. El asunto cabe en una línea. El cuerpo, si hace falta, dice qué queda resuelto.

```
Keep the camera on the selected person so a second look does not jump back to the room center.
```

No se usan mensajes vacíos (`update`, `fix`, `wip`) ni se mezclan formato, refactor y producto en el mismo commit si se pueden separar.

No entran en el commit:

- `.env`, `.env.local` ni ninguna clave (`MODEL_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- `.data/`
- `node_modules/` ni `.next/`

## Issues

Abre un issue antes de una rama grande. Usa la plantilla de fallo o de propuesta.

Un fallo incluye qué esperabas, qué ocurrió y los pasos para repetirlo. Una propuesta dice qué momento del recorrido cambia y a quién ayuda. Las dudas de producto pueden ir en una propuesta corta.

No pegues claves, cookies, perfiles reales ni capturas con datos de otras personas. Los perfiles de demostración se marcan como `demo`.

## Pull requests

La rama apunta a `main`. El título sigue el tono de los commits. La descripción dice:

1. Qué cambia para quien usa el evento.
2. Cómo se probó (`npm test`, `npm run lint` y, si aplica, el recorrido en el navegador).
3. Qué queda fuera.

Pide revisión cuando las comprobaciones pasen. Si un hook rechaza el commit, se corrige y se crea un commit nuevo. No se reescribe historia ya publicada.

## Código

- TypeScript estricto. Las entradas y salidas externas se validan con Zod.
- UI en `src/app` y `src/components`. Casos de uso en `src/server`. Dominio en `src/domain`. Meta en `src/lib/meta`. Supabase en `src/lib/supabase`.
- La interfaz reutiliza los tokens y componentes descritos en `docs/DESIGN.md`.
- El descubrimiento exige consentimiento. No se inventan filas, matches ni texto del modelo.
- No se comparan todos los perfiles entre sí. Los candidatos salen de la fórmula determinista. El modelo solo explica recomendaciones ya elegidas.
- Los secretos solo viven en el servidor. Nada de `NEXT_PUBLIC_` para claves.

El detalle está en `docs/ARCHITECTURE.md`, `docs/PRIVACY.md` y `docs/PRODUCT.md`.

## Conducta y seguridad

El trato al colaborar está en [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Una vulnerabilidad no se reporta en un issue público: el camino está en [SECURITY.md](SECURITY.md).

La licencia del código es [MIT](LICENSE).
