# Seguridad

No abras un issue público para una vulnerabilidad, una clave filtrada o un fallo que permita leer perfiles sin consentimiento.

Abre un aviso privado en [Security Advisories](https://github.com/pablojhdcoder/IntroMesh/security/advisories/new) con:

- qué componente está afectado
- qué podría hacer alguien con el fallo
- los pasos mínimos para reproducirlo, sin datos reales de otras personas

Si has pegado `MODEL_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` u otra clave en un commit, un issue o un log, dilo en ese aviso y rota la clave. No la incluyas en el mensaje.

Las versiones cubiertas son las de `main`. Este repositorio no publica la app en npm (`private: true` en `package.json`).
