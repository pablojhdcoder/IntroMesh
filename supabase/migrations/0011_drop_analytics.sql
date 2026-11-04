-- Retira la telemetría de actividad: la página Intelligence y el pipeline de
-- analytics_events se eliminaron del código (nada los lee ni los escribe).
-- Aplicar en el SQL editor cuando exista el proyecto.
-- El resto de migraciones son historial y no se tocan.

drop table if exists analytics_events;
