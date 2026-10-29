# IntroMesh — The Signal Loop

Dirección visual de un producto de networking presencial asistido por IA. La interfaz muestra cómo una persona pasa de descubrir a comprender por qué conecta y, después, a crear una relación.

Referencias de calidad: la precisión de Linear, la claridad de Vercel y el cuidado de Apple. No se copian sus interfaces.

## Principios

1. La información manda. El movimiento explica el estado; no decora.
2. Oscuro cinematográfico, superficies planas y contraste intencionado.
3. Un solo acento luminoso: la señal.
4. Cada recomendación muestra una razón concreta. Nunca un porcentaje huérfano.
5. Lo sintético se etiqueta como demostración. Lo generado por el modelo se distingue de los datos de dominio.
6. Móvil es una experiencia propia, no una columna estrecha del escritorio.

## Evitar

- Gradientes gratuitos, blobs y mesh backgrounds.
- Glassmorphism apilado y efectos 3D.
- Varias animaciones a la vez compitiendo con el texto.
- Tarjetas genéricas de SaaS con icono, título y tres bullets idénticos.
- Mezclar radios, sombras o familias tipográficas fuera de estos tokens.

## Hilo visual

**Discover → Understand → Connect → Learn.**

La visualización central es una red de asistentes: nodos, relaciones y una ruta hacia una conexión posible. En móvil, la red se reduce a la persona activa y dos o tres señales; el resto queda en una lista. La red es funcional y se alimenta de datos reales o de datos sintéticos marcados.

## Color

Tema oscuro por defecto. No hay tema claro en el hackathon.

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#07080c` | Lienzo |
| `--surface` | `#101218` | Paneles y tarjetas |
| `--surface-raised` | `#171a22` | Elemento seleccionado o elevado |
| `--foreground` | `#f4f1ea` | Texto principal, cálido sobre negro |
| `--muted` | `#9a958c` | Texto secundario |
| `--line` | `rgb(244 241 234 / 0.12)` | Bordes |
| `--signal` | `#d6ff4a` | Acento de conexión. Un solo uso dominante por vista |
| `--signal-dim` | `rgb(214 255 74 / 0.16)` | Halo o pista de una ruta |
| `--danger` | `#ff6b5a` | Error |
| `--success` | `#8ee0b0` | Éxito y conexión aceptada |

El acento no tiñe fondos grandes. Marca la señal activa, el foco y la acción primaria.

## Tipografía

| Rol | Familia | Uso |
| --- | --- | --- |
| Display | Instrument Serif | Títulos de sección y nombres en la red. Itálica solo para una palabra de énfasis |
| UI | Geist Sans | Interfaz, botones, cuerpo |
| Meta | Geist Mono | Etiquetas cortas, estados, identificadores |

Escala: display `clamp(2.5rem, 6vw, 4.5rem)` con tracking `-0.03em`; título de tarjeta `1.125rem`; cuerpo `0.9375rem` / line-height `1.5`; meta `0.75rem` con tracking `0.08em` en mayúsculas.

## Espaciado, radio y sombra

Escala de 4: `4, 8, 12, 16, 24, 32, 48, 64`.

| Token | Valor |
| --- | --- |
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `20px` |
| `--shadow-raise` | `0 16px 40px rgb(0 0 0 / 0.35)` |

Los bordes son de 1px con `--line`. La sombra solo separa una superficie del lienzo, no apila tarjetas.

## Movimiento

| Token | Valor |
| --- | --- |
| `--duration-fast` | `160ms` |
| `--duration-base` | `280ms` |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` |

Entradas y cambios de estado usan ease-out. No usar ease-in para aparecer. Propiedades animables: `transform` y `opacity`.

`prefers-reduced-motion: reduce` elimina traslaciones y deja cambios instantáneos de opacidad o estado.

Transiciones del hilo: Discover desplaza el foco al nodo; Understand abre la razón; Connect confirma con el acento; Learn deja la conexión en reposo.

## Componentes

shadcn/ui es la base. Se reestiliza con estos tokens. No se mezclan otras librerías de componentes.

- Botón primario: fondo `--signal`, texto `#14160c`, radio `--radius-sm`.
- Botón secundario: superficie, borde `--line`, texto `--foreground`.
- Tarjeta de afinidad: superficie, una razón visible, máximo tres evidencias, acción clara.
- Nodo de red: círculo de 12px; el activo lleva anillo `--signal`.
- Estados obligatorios: carga, vacío, error, éxito, selección y deshabilitado.

## Accesibilidad

- Contraste de texto principal sobre lienzo por encima de 7:1. El acento `#d6ff4a` sobre `#14160c` supera 4.5:1 para controles.
- Foco visible con anillo de 2px `--signal` y offset de 2px.
- Toda acción funciona con teclado. La red tiene una alternativa en lista.
- Iconos de Lucide acompañan texto, salvo cuando el `aria-label` nombra la acción.

## Responsive

- `< 720px`: una columna. La red es un recorte de la persona activa. Las acciones primarias ocupan el ancho.
- `≥ 720px`: lista y detalle.
- `≥ 1100px`: red a la izquierda, explicación a la derecha.

Áreas táctiles de al menos 44px. Inputs a 16px para evitar zoom en iOS.
