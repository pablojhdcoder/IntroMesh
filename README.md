# IntroMesh

Discover who you should meet, understand why you connect, and make the introduction happen.

IntroMesh es una capa para eventos presenciales. El recorrido es uno: **Discover → Understand → Connect → Learn**. No es una red social, ni un chat, ni un dashboard suelto.

## Problema

En un evento es difícil saber a quién hablar y por qué. Las listas de asistentes no explican la conversación. IntroMesh muestra quién está visible, por qué encaja contigo y deja la conexión en manos de las dos personas.

## Meta AI

El modelo `muse-spark-1.3` se llama desde el servidor con el SDK de OpenAI y `MODEL_API_KEY`, contra `https://api.meta.ai/v1`. Hace tres cosas, siempre con salida estructurada y Zod:

1. Redactar una presentación a partir de los campos del perfil, sin añadir hechos.
2. Explicar una recomendación ya elegida por el ranking determinista.
3. Proponer una frase para empezar. Se puede editar, descartar o regenerar.

Si la respuesta cita un interés o una habilidad que no está en los datos, se rechaza. No se sustituye por un texto inventado.

Sin `MODEL_API_KEY` la interfaz lo dice y usa una redacción de **demostración** construida solo con los campos declarados. Eso no es una respuesta de Meta.

## Arranque

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre http://localhost:3000.

Sin Supabase, los datos viven en `.data/store.json` (no se versiona). La primera lectura siembra 180 perfiles de demostración y deja 28 visibles en el Meta Hackathon. La migración real está en `supabase/migrations/0001_init.sql`.

## Variables

| Variable | Uso |
| --- | --- |
| `MODEL_API_KEY` | Meta Model API. Solo servidor |
| `META_MODEL_BASE_URL` | Por defecto `https://api.meta.ai/v1` |
| `META_MODEL_ID` | Por defecto `muse-spark-1.3` |
| `NEXT_PUBLIC_SUPABASE_URL` | Aún no conectada al recorrido |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública, con RLS cuando exista Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor |

## Probar el flujo

1. Crea tu perfil. Elige intereses del catálogo (`modelos`, `producto`…) para coincidir con la comunidad de demostración.
2. Pulsa **Activo** o **Buscando**. La presencia de tu sesión caduca a los 90 segundos si se abandona.
3. Elige un nodo con acento. La lista de debajo es la misma información, para teclado y móvil.
4. Lee la explicación. Si no hay clave, la etiqueta es «Demostración, no es Meta AI».
5. Solicita la conexión y, si la otra persona es un fixture, **Simular aceptación**.
6. Copia el enlace o abre el QR. NFC solo aparece en Chrome para Android, en un contexto seguro, y escribe una etiqueta: no detecta otros teléfonos.
7. Abre **Inteligencia**. Los números salen de eventos guardados. Los temas con menos de cinco casos no se muestran.

## Demo de 60–90 segundos

1. Entra, guarda un perfil con objetivo de hackathon e interés `modelos`.
2. Activa la presencia.
3. Selecciona un nodo de demostración con interés compartido.
4. Muestra la explicación etiquetada.
5. Solicita y simula la aceptación.
6. Muestra el QR.
7. Abre Inteligencia y señala que los agregados no son un ranking de personas.

## Comprobaciones

```bash
npm test
npm run lint
npm run build
npm run verify:meta
```

`verify:meta` solo llama a Meta si hay clave.

## Decisiones

- El ranking es determinista: objetivos×3, intereses×2, habilidades×1, complementos×2. Meta no recorre la comunidad.
- No hay embeddings: la API no los documenta.
- La presencia en la app no es distancia física.
- El organizador ve agregados. No hay historial individual en esa vista.
