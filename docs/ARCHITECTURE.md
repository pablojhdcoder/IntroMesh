# Arquitectura — IntroMesh

Hilo único: **Discover → Understand → Connect → Learn.**

Este documento fija los límites del hackathon. El recorrido ya está en la app. Meta solo explica una recomendación ya elegida.

## Capas

| Capa | Ubicación | Responsabilidad |
| --- | --- | --- |
| UI | `src/app`, `src/components` | Pantallas y campo de señal. No llama a Meta ni lee secretos |
| Casos de uso | `src/server` | Registro, presencia, descubrimiento, explicación, conexión y analítica |
| Dominio | `src/domain` | Perfil, presencia, puntuación y vectores. Sin red ni disco |
| Persistencia | `src/lib/store`, `src/lib/supabase` | Archivo local hoy. Postgres cuando haya proyecto. Service role solo en servidor |
| Meta | `src/lib/meta` | Cliente, esquemas, errores y límite local de peticiones |

El orden al leer el código es el del producto: `session` → `presence` → `discover` → `explain` → `connect` → `learn`.

Los componentes de cliente importan tipos y datos ya preparados. Las Route Handlers y Server Actions son el único borde que habla con Supabase privilegiado o con Meta.

## Datos previstos

- Perfil contextual: lo que la persona elige mostrar en un evento.
- Presencia voluntaria: sesión digital en un evento, con consentimiento explícito.
- Descubrimiento: asistentes visibles en esa sesión.
- Matching: objetivos, intereses y habilidades declarados.
- Explicación: texto estructurado de Meta solo para las recomendaciones que ya pasaron el filtro.
- Introducción: borrador personalizado, enviado solo si ambas partes aceptan.
- Conexión: acuerdo mutuo.
- Enlace, QR y NFC como transporte del mismo identificador público.
- Analítica del organizador: agregados, sin perfiles privados.

## Presencia y proximidad

Supabase Realtime Presence encaja para la presencia digital: quién está visible en la sesión del evento. No mide distancia física.

No hay detección automática entre teléfonos. Web NFC existe en Chrome para Android y no en Safari ni en la mayoría de escritorio. NFC es mejora progresiva. El QR y el enlace resuelven el mismo flujo cuando NFC no está disponible.

No se recoge ubicación precisa de forma continua.

## Matching a escala

Hay dos canales. El campo de señal sigue proyectando el vecindario con el feature hashing de `src/domain/embedding/vector.ts` para no mover el layout aprobado. La compatibilidad nueva vive en `src/domain/matching/hybrid.ts` y en los documentos `EMBEDDING_ARCHITECTURE.md`, `MATCHING_ARCHITECTURE.md` y `META_AI_CACHE.md`.

No se compara cada perfil con todos los demás.

1. Indexar los atributos de filtro: evento, objetivos, intereses y habilidades.
2. Exigir presencia en el evento. El salón ya es el conjunto reducido.
3. Proyectar cada perfil visible a un vector local (`src/domain/embedding`). El texto es el objetivo, los intereses, las habilidades y lo que busca. Los pesos son los de `MATCH_WEIGHTS`. La cercanía es el coseno.
4. Quedarse con un vecindario pequeño por ese coseno. Eso coloca el campo: más cerca de «Tú» quien más se parece. El ángulo sale del vector, no de un índice ni del azar.
5. Puntuar en código, con la fórmula de abajo, solo dentro de ese salón. Un vecino sin solapamiento no es recomendación y no lleva hilo.
6. Pedir a Meta una explicación solo para las recomendaciones que se van a mostrar.

Meta Model API no documenta un endpoint de embeddings. El vector no sale de esa API ni de otro proveedor: es un feature hashing determinista y se recalcula. No se persiste. Si más adelante hubiera embeddings oficiales, se sustituye `embedProfile` y se puede guardar el vector; la recuperación y el mapa no cambian de contrato. El campo de señal dibuja ese vecindario.

## Meta Model API

- Base URL: `https://api.meta.ai/v1`
- Modelo de texto: `muse-spark-1.3`
- SDK: `openai`, con `baseURL` y `apiKey` explícitos. El SDK no lee `MODEL_API_KEY` por sí solo.
- Superficie: Responses API (`client.responses.create`).
- Salida estructurada: `text.format` con `type: "json_schema"`. En Responses, `response_format` no configura la salida y puede devolver HTTP 400.
- El cliente vive en servidor (`server-only`). Timeout 25s. El SDK reintenta 429 y 5xx hasta 2 veces. Un límite local adicional evita ráfagas.
- La respuesta del modelo se valida con Zod. Si no encaja, es un error, no un resultado inventado.

## Fórmula de matching

Sobre el conjunto ya filtrado por evento y presencia vigente:

`score = objetivos×3 + intereses×2 + habilidades×1 + complementos×2`

Un complemento es una habilidad del otro que aparece en el texto de lo que tú buscas y que no está ya en las habilidades compartidas. Confianza baja con menos de dos señales, media con dos o tres, alta con cuatro o más. Los pesos viven en `MATCH_WEIGHTS`.

No se construye una matriz de todas las parejas. Meta solo explica un candidato ya puntuado, y el resultado se cachea. Un perfil `demo` no llama a Meta: la explicación se arma con los datos declarados y se etiqueta como demostración.

## Persistencia en este hackathon

Sin `NEXT_PUBLIC_SUPABASE_URL` ni service role, el servidor usa `.data/store.json`. Ese archivo es local, está en `.gitignore` y no es el backend de producción. La migración `supabase/migrations/0001_init.sql` deja el esquema listo para cuando exista proyecto. La presencia de sesión caduca a los 90 segundos sin heartbeat. La presencia marcada `demo` es un fixture etiquetado, no un teléfono en la sala.

## Supabase

Variables públicas, protegidas por RLS: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Secreto de servidor: `SUPABASE_SERVICE_ROLE_KEY`. Nunca en el cliente ni en `NEXT_PUBLIC_*`.

Sin claves, la app arranca. Las funciones de persistencia fallan con un error explícito al usarse.

## Modo demostración

`INTROMESH_DATA_MODE=demo` permite datos sintéticos etiquetados en la interfaz. No sustituye una respuesta del modelo. Una explicación de IA solo aparece tras una llamada real validada.
