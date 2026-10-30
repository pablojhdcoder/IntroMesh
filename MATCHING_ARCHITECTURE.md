# Matching

Meta no ordena. El ranking es determinista.

1. Asistentes visibles del mismo evento, con consentimiento.
2. Se excluye al propio visor.
3. Se recuperan como máximo 24 por similitud del embedding global (`1 - (embedding <=> consulta)` en pgvector; el producto escalar si el vector ya está normalizado).
4. Si hay embedding de contexto en los dos lados, entra en la mezcla semántica: 35 % global y 65 % contextual.
5. La nota final inicial es 40 % semántica, 25 % objetivo, 20 % complemento de habilidad, 10 % intereses compartidos y 5 % relevancia del evento.
6. Si falta un componente, sus pesos se reparten entre los que sí existen. No se castiga la ausencia de contexto.
7. Se guardan como máximo 8 recomendaciones del visor en `event_match_recommendations`.

La complementariedad puede sostener una recomendación aunque no haya intereses comunes. La similitud semántica no se trata como compatibilidad por sí sola: es un término más.

Cambiar la identidad borra las recomendaciones en las que esa persona es visor o candidata. Cambiar el contexto de un evento solo borra las de ese evento. El otro lado se recalcula cuando esa persona abre el suyo.

Signal Field recibe el mismo objeto de siempre. Si los dos embeddings multilingües están listos, el peso de la arista es la nota híbrida. Si no, se mantiene la puntuación anterior para que la sala de demostración no cambie de aspecto.
