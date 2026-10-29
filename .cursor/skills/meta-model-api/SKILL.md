---
name: meta-model-api
description: >-
  Integra Meta Model API en IntroMesh con el SDK de OpenAI, salida estructurada,
  validación Zod y secretos de servidor. Usar al llamar al modelo, diseñar
  esquemas de matching, explicar afinidad o depurar errores de MODEL_API_KEY.
---

# Meta Model API

Fuente vigente: [overview](https://dev.meta.ai/docs/overview), [quickstart](https://dev.meta.ai/docs/quickstart), [structured output](https://dev.meta.ai/docs/structured-output), [tool calling](https://dev.meta.ai/docs/tool-calling), [models](https://dev.meta.ai/docs/models), [error handling](https://dev.meta.ai/docs/error-handling). Vuelve a leerlas si el comportamiento no coincide con este archivo.

## Contrato de este repositorio

- Base URL: `https://api.meta.ai/v1` (`META_MODEL_BASE_URL` opcional).
- Modelo: `muse-spark-1.3` (`META_MODEL_ID` opcional). Standard mode; el contenido no se usa para entrenar. No uses el id `contributor`.
- Clave: `MODEL_API_KEY`. El SDK no la lee solo. Pásala como `apiKey`.
- Cliente: importa `@/lib/meta/server` desde el servidor. Ese módulo lleva `server-only`. La implementación está en `src/lib/meta/client.ts`.
- Superficie: Responses API. Salida estructurada con `text.format` (`type: "json_schema"`, `strict: true`). No envíes `response_format` a Responses.
- Valida la entrada y `output_text` con Zod. Un JSON que no pasa el esquema es error.
- No hay endpoint de embeddings documentado. No diseñes recuperación vectorial sobre esta API.

## Llamada

1. Filtra candidatos en dominio antes de llamar al modelo.
2. Comprueba el límite local (`META_MODEL_MAX_REQUESTS_PER_MINUTE`).
3. Usa `createStructuredResponse`.
4. Si falla, propaga `MetaApiError` con estado y tipo. No rellenes la UI con texto inventado.
5. Loguea estado, tipo y latencia. Nunca la clave, el prompt ni el perfil.

## Errores

| Estado | Tratamiento |
| --- | --- |
| 400 | No reintentar. Revisar esquema o parámetros. `code` a menudo es `null`; usa `message` y `param`. |
| 401 | Clave ausente o inválida. No reintentar. |
| 402 / 403 | Cuenta o permisos. No reintentar. |
| 404 `model_not_found` | Id de modelo incorrecto. No reintentar. |
| 413 | Cuerpo demasiado grande. No reintentar igual. |
| 429 | El SDK reintenta con límite. Respeta `Retry-After`. |
| 500 / 503 | Reintento acotado. 503 no siempre significa que el modelo no exista. |
| Timeout o cuerpo no JSON | Error de transporte o respuesta inválida. No sustituir por demo. |

Esquemas recursivos devuelven 400. Aplana la estructura. `additionalProperties: false` y `required` en todos los campos que el producto usa.

## Demostración frente a modelo

`INTROMESH_DATA_MODE=demo` solo autoriza perfiles sintéticos etiquetados. Una explicación de afinidad es real únicamente si salió de `createStructuredResponse` y pasó Zod. Si no hay clave, dilo y deja el paso manual: panel de [Meta Model API](https://dev.meta.ai) → API keys → Create API key → `MODEL_API_KEY` en `.env.local`.

Verificación: `npm run verify:meta`. Sin clave termina con código 2 y no llama a la red.
