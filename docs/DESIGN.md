# IntroMesh — The Signal Loop

Dirección visual de un producto de networking presencial asistido por IA. La interfaz muestra cómo una persona pasa de descubrir a comprender por qué conecta y, después, a crear una relación.

Referencias de calidad: la precisión de Linear, la claridad de Vercel y el cuidado de Apple. No se copian sus interfaces.

## Principios

1. La información manda. El movimiento explica el estado; no decora.
2. Dos temas diseñados aparte. El claro es papel; el oscuro sigue siendo cinematográfico. El contraste es intencionado en los dos.
3. Un solo acento luminoso: la señal.
4. Cada recomendación muestra una razón concreta. Nunca un porcentaje huérfano.
5. Lo sintético se etiqueta como demostración. Lo generado por el modelo se distingue de los datos de dominio.
6. Móvil es una experiencia propia, no una columna estrecha del escritorio.

## Evitar

- Gradientes gratuitos, blobs y mesh backgrounds.
- Glassmorphism apilado. El campo de señal es la única superficie 3D: esferas de vidrio, hilos con partículas y órbita. El resto de la interfaz sigue plana.
- Varias animaciones a la vez compitiendo con el texto.
- Tarjetas genéricas de SaaS con icono, título y tres bullets idénticos.
- Mezclar radios, sombras o familias tipográficas fuera de estos tokens.

## Hilo visual

**Discover → Understand → Connect → Learn.**

La visualización central es un campo espacial: nodos con volumen, hilos hacia recomendaciones y una ruta hacia una conexión posible. En móvil, el campo muestra a la persona activa y dos o tres señales; el resto queda en una lista. El campo es funcional y se alimenta de datos reales o de datos sintéticos marcados.

## Color

El tema predeterminado es el claro. La primera visita abre en claro aunque el sistema esté en oscuro. La preferencia manual se guarda en la cookie `intromesh-theme` y se vuelve a aplicar en el servidor, así que no hay un parpadeo del tema contrario. No se sigue `prefers-color-scheme`.

Un control en cápsula, arriba a la derecha del header, alterna los temas. La cápsula visible es de 28px; el área táctil sigue en 44px. Lleva los iconos `Sun` y `Moon`. El thumb marca el tema activo y se desplaza en 300ms con `cubic-bezier(0.32, 0.72, 0, 1)`. Con `prefers-reduced-motion: reduce` el cambio de tema y el thumb son instantáneos.

Los nombres semánticos (`--background`, `--foreground`, `--surface`, `--border`, `--signal`) son la fuente de verdad. El modo claro no es el negativo del oscuro.

### Claro

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#f6f4ef` | Lienzo, blanco roto cálido |
| `--surface` | `#fffcf8` | Paneles y campos de formulario |
| `--surface-raised` | `#efede6` | Hover y bloque seleccionado |
| `--foreground` | `#16180f` | Texto principal |
| `--muted` | `#5c584f` | Texto secundario. En CSS vive en `--muted-foreground` |
| `--line` | `rgb(22 24 15 / 0.12)` | Bordes. En CSS vive en `--border` |
| `--signal` | `#d6ff4a` | Acción primaria, con texto `#14160c` |
| `--signal-strong` | `#4c6610` | Marca, foco, nodo activo y arista activa sobre el papel |
| `--signal-dim` | `rgb(76 102 16 / 0.12)` | Pista suave de una ruta |
| `--danger` | `#b42318` | Error. En CSS vive en `--destructive` |
| `--success` | `#1f7a4a` | Éxito |
| `--shadow-raise` | `0 10px 28px rgb(22 24 15 / 0.06)` | Reservada. El campo se posa sobre el papel, sin marco ni sombra |

### Oscuro

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#07080c` | Lienzo |
| `--surface` | `#101218` | Paneles y tarjetas |
| `--surface-raised` | `#171a22` | Elemento seleccionado o elevado |
| `--foreground` | `#f4f1ea` | Texto principal, cálido sobre negro |
| `--muted` | `#9a958c` | Texto secundario. En CSS vive en `--muted-foreground` |
| `--line` | `rgb(244 241 234 / 0.12)` | Bordes. En CSS vive en `--border` |
| `--signal` | `#d6ff4a` | Acento de conexión. Un solo uso dominante por vista |
| `--signal-strong` | `#d6ff4a` | Misma señal: sobre negro el lima ya tiene contraste |
| `--signal-dim` | `rgb(214 255 74 / 0.16)` | Halo o pista de una ruta |
| `--danger` | `#ff6b5a` | Error. En CSS vive en `--destructive` |
| `--success` | `#8ee0b0` | Éxito y conexión aceptada |
| `--shadow-raise` | `0 16px 40px rgb(0 0 0 / 0.35)` | Reservada. El campo oscuro se posa sobre el lienzo, sin marco |

El acento no tiñe fondos grandes. Marca la señal activa, el foco y la acción primaria. En claro, el lima `#d6ff4a` se reserva al botón primario: sobre papel no alcanza contraste, y las marcas del campo usan `--signal-strong`.

Al cambiar de tema, color, fondo, borde, trazo y sombra transicionan en `220ms` con `--ease-out`. La clase `theme-ready` se añade después del primer pintado para que esa transición no corra durante la carga.

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
`--shadow-raise` depende del tema. Ver la sección Color.

Los bordes son de 1px con `--line`. El campo no lleva marco, superficie ni sombra: se posa sobre `--background`.

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
- Campo de señal: única superficie 3D. “Tú” queda fijo en el centro. El resto orbita con una simulación de fuerzas, esferas de vidrio (transmisión, clearcoat) y partículas que recorren los hilos. Quien es recomendación brilla con la señal; el resto es más tenue. El nombre flota bajo la esfera. Se puede orbitar la cámara. Con `prefers-reduced-motion` no hay partículas ni autorrotación. En claro, el lima no marca el campo: usa `--signal-strong`.
- Estados obligatorios: carga, vacío, error, éxito, selección y deshabilitado.

## Accesibilidad

- Contraste de texto principal sobre lienzo por encima de 7:1. El acento `#d6ff4a` sobre `#14160c` supera 4.5:1 para controles. En claro, el foco y el texto secundario usan tintas que se leen sobre `#f6f4ef`.
- Foco visible con anillo de 2px `--ring` (`--signal-strong`) y offset de 2px.
- Toda acción funciona con teclado. La red tiene una alternativa en lista.
- Iconos de Lucide acompañan texto, salvo cuando el `aria-label` nombra la acción.

## Responsive

- `< 720px`: una columna. El campo muestra a la persona activa y dos o tres señales; el resto queda en lista. Las acciones primarias ocupan el ancho.
- `≥ 720px`: campo a la izquierda y explicación a la derecha, en una sola pantalla. El detalle, si crece, se desplaza dentro de su columna.

Áreas táctiles de al menos 44px. Inputs a 16px para evitar zoom en iOS.
