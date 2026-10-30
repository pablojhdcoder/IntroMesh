# Privacidad — IntroMesh

## Consentimiento

Aparecer en el descubrimiento es opt-in. El valor por defecto es no visible. La persona puede dejar de estar visible en cualquier momento; la presencia en tiempo real debe retirarse en ese momento, no al cerrar la pestaña.

Aceptar una conexión es independiente de ser visible. Ver una recomendación no crea una relación.

## Minimización

Se guarda lo necesario para el evento: nombre visible, objetivo, intereses y habilidades que la persona declara. No se infieren atributos sensibles (salud, origen, religión, orientación, situación económica) para hacer matching. Esos campos no entran en el prompt aunque aparezcan en una biografía libre: se excluyen antes de llamar al modelo.

No hay seguimiento continuo de ubicación.

## Público y privado

| Público en el evento, si hay consentimiento | Privado |
| --- | --- |
| Nombre visible, objetivo, intereses y habilidades declarados | Contacto personal, notas, rechazos, borradores de introducción no enviados |
| Ruta de conexión (enlace o QR) | Claves, identificadores internos, service role |

El organizador ve métricas agregadas: asistentes visibles, conexiones mutuas, temas más declarados. No ve perfiles que no consintieron ni el contenido de las introducciones.

## Servidor y secretos

`MODEL_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY` solo se leen en el servidor. No usan prefijo `NEXT_PUBLIC_`. No se escriben en logs, respuestas de error al cliente ni en el repositorio.

Los logs de Meta pueden incluir estado HTTP, tipo de error y latencia. No incluyen el prompt, el perfil ni la clave.

## Analítica

Solo agregados del evento. Sin exportar texto libre de perfiles ni mensajes.

## Demostración

Los datos sintéticos llevan la marca `demo` en el modelo y la etiqueta "Demostración" en la interfaz. No se presentan como asistentes reales ni como salida del modelo.
