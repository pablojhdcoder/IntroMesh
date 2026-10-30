# Profile intelligence

Muse Spark (`muse-spark-1.3`, Responses API, `text.format`) convierte la descripción libre en una identidad Zod. El prompt vive en `NORMALIZE_PROMPT`.

Se llama solo si no hay una generación con el mismo SHA-256, o si la persona pide regenerar. Entrar en la app o en otro evento no llama al modelo.

Tres versiones:

| Versión | Dónde |
| --- | --- |
| Descripción original | `global_identities.original_description` |
| Generada | `generated` |
| Confirmada | `confirmed` |

Editar un campo estructurado guarda la versión de la persona y no reenvía el perfil a Meta. Cambiar la descripción original sí puede pedir otra normalización.

Las listas se contrastan con el texto. Lo que no aparece se vacía. No se infieren atributos sensibles: esas frases se retiran antes del prompt.

Sin `MODEL_API_KEY` la ruta responde que Meta no está disponible. No se fabrica un perfil y se presenta como del modelo. La persona puede completar los campos a mano.

La proyección al perfil que ya consume el grafo está en `toProfileInput`. El rol ausente queda como `n/d`, no como una profesión inventada.
