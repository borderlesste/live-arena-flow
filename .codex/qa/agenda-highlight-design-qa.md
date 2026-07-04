# QA visual — agenda destacada

- Fuente visual: `C:\Users\leona\AppData\Local\Temp\codex-clipboard-8fa1d781-04a4-40f4-b059-6c8ed7610ce7.png`
- Implementación escritorio: `C:\Users\leona\AppData\Local\Temp\agenda-highlight-desktop.png`
- Implementación móvil: `C:\Users\leona\AppData\Local\Temp\agenda-highlight-mobile.png`
- Viewports: 1280×720 y 390×844.
- Estado: portada cargada con datos reales del proveedor y tres encuentros programados.

**Comparación completa**

- El espacio derecho vacío ahora contiene tres filas de agenda, conservando la tarjeta superior de SportSRC.
- La densidad equilibra la columna de competiciones sin desplazar ni modificar sus controles.
- En móvil la sección se apila y no genera desbordamiento horizontal (`scrollWidth = clientWidth = 375`).

**Comparación enfocada**

- Tipografía: usa la jerarquía existente de etiquetas, títulos y texto auxiliar.
- Espaciado: tarjetas compactas con ritmo uniforme y separación coherente con `CompetitionCard`.
- Colores: reutiliza tokens de superficie, borde, texto secundario y color primario.
- Imágenes: utiliza los escudos reales ya disponibles mediante `TeamBadge`; no agrega recursos simulados.
- Contenido: competencia, fecha, ambos equipos, estado temporal y acción “Ver partido”.

**Findings**

- Sin hallazgos P0, P1 o P2.
- P3 preexistente: el encabezado global puede producir desplazamiento horizontal en el viewport de escritorio observado; la nueva sección permanece dentro del ancho de su columna.

**Parches realizados**

- Componente reutilizable `AgendaMatchCard`.
- Tres encuentros reales enlazados a sus páginas de detalle.
- Cuenta regresiva para fechas futuras.
- Fallback “Horario por confirmar” para eventos que el proveedor conserva como programados después de su hora.
- Estado vacío cuando no hay encuentros programados.

final result: passed
