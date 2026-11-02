---
name: ui-quality-review
description: >-
  Inspecciona y corrige la calidad visual de IntroMesh en el navegador:
  composición, tipografía, espaciado, tokens, movimiento, responsive,
  accesibilidad y estados. Usar al implementar o pulir UI, después de cambios
  visuales, o cuando el usuario pida revisión de diseño.
---

# Revisión visual de IntroMesh

Lee `docs/DESIGN.md` antes de tocar la interfaz. Corrige los problemas de mayor impacto. No entregues solo una lista de críticas.

## Orden de trabajo

1. Abre la vista afectada en el navegador (escritorio y, si el layout cambió, móvil).
2. Recorre los estados reales: carga, vacío, error, éxito, selección y datos largos.
3. Anota solo defectos visibles o medibles.
4. Ordénalos por impacto: bloquea la comprensión, rompe alineación o jerarquía, inconsistencia de tokens, detalle menor.
5. Corrige el primer grupo antes de pasar al siguiente.
6. Vuelve a mirar la misma vista. Para cuando el siguiente defecto ya no cambia la percepción.

## Qué mirar

- Jerarquía: un título, un acento, una acción primaria.
- Tipografía: Instrument Serif solo en display; Geist en UI; mono en etiquetas.
- Espaciado sobre la escala de 4. Alineación óptica, no solo de caja.
- Radios, bordes y sombras de `docs/DESIGN.md`. Un acento `#d6ff4a`.
- Iconos Lucide del mismo tamaño óptico, con texto o `aria-label`.
- Movimiento en `transform` y `opacity`, ease-out, y corte con `prefers-reduced-motion`.
- Teclado, foco visible y contraste.
- En móvil, acciones de 44px y la red reducida a una alternativa en lista.

## Qué no hacer

- No inventes datos de matching ni marques una llamada a Meta como completada.
- No añadas gradientes, blur apilado ni una segunda librería de componentes.
- No reescribas una pantalla entera para corregir un token.
