# Arquitectura — IntroMesh

Hilo único: **Discover → Understand → Connect → Learn.**

Este documento fija los límites del hackathon. La aplicación de networking todavía no está implementada; sí lo están el cliente de Meta Model API, los contratos de validación y la selección determinista de candidatos.

## Capas

| Capa | Ubicación | Responsabilidad |
| --- | --- | --- |
| UI | `src/app`, `src/components` | Presentación. No llama a Meta ni lee secretos |
| Dominio | `src/domain` | Perfiles, consentimiento, candidatos, conexiones |
| Persistencia | `src/lib/supabase` | Postgres, Auth y Realtime. Solo servidor para la service role |
| Meta | `src/lib/meta` | Cliente, esquemas, errores y límite local de peticiones |

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

No se compara cada perfil con todos los demás.

1. Indexar los atributos de filtro: evento, objetivos, intereses y habilidades.
2. Exigir `discoverable = true`.
3. Obtener un conjunto pequeño de candidatos con solapamiento de atributos.
4. Puntuar ese conjunto en código, con pesos explícitos.
5. Pedir a Meta una explicación solo para las recomendaciones que se van a mostrar.

Meta Model API no documenta un endpoint de embeddings. La recuperación no depende de vectores de esta API. Si más adelante hubiera embeddings oficiales, se reevalúa; hasta entonces el índice es relacional.

## Meta Model API

- Base URL: `https://api.meta.ai/v1`
- Modelo de texto: `muse-spark-1.3`
- SDK: `openai`, con `baseURL` y `apiKey` explícitos. El SDK no lee `MODEL_API_KEY` por sí solo.
- Superficie: Responses API (`client.responses.create`).
- Salida estructurada: `text.format` con `type: "json_schema"`. En Responses, `response_format` no configura la salida y puede devolver HTTP 400.
- El cliente vive en servidor (`server-only`). Timeout 25s. El SDK reintenta 429 y 5xx hasta 2 veces. Un límite local adicional evita ráfagas.
- La respuesta del modelo se valida con Zod. Si no encaja, es un error, no un resultado inventado.

## Supabase

Variables públicas, protegidas por RLS: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Secreto de servidor: `SUPABASE_SERVICE_ROLE_KEY`. Nunca en el cliente ni en `NEXT_PUBLIC_*`.

Sin claves, la app arranca. Las funciones de persistencia fallan con un error explícito al usarse.

## Modo demostración

`INTROMESH_DATA_MODE=demo` permite datos sintéticos etiquetados en la interfaz. No sustituye una respuesta del modelo. Una explicación de IA solo aparece tras una llamada real validada.
