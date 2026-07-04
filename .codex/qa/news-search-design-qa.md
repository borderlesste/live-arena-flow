# QA visual — buscador de noticias

- Fuente visual: `C:\Users\leona\AppData\Local\Temp\codex-clipboard-dc9c14b5-7f53-4e0d-bc94-f640ee728f48.png`
- Implementación escritorio: `C:\Users\leona\AppData\Local\Temp\news-search-desktop.png`
- Implementación móvil: `C:\Users\leona\AppData\Local\Temp\news-search-mobile.png`
- Viewports: 1280×720 y 390×844.
- Estado: buscador vacío, búsqueda activa y limpieza del término.

**Comparación completa**

- El buscador ocupa el espacio derecho indicado en la referencia y conserva la jerarquía del encabezado.
- En móvil se apila bajo la introducción, usa el ancho disponible y no genera desbordamiento horizontal (`scrollWidth = clientWidth = 375`).

**Comparación enfocada**

- Tipografía: reutiliza las familias, pesos y tamaños existentes.
- Espaciado: alineación inferior con el bloque introductorio y separación consistente.
- Colores: usa los tokens `card`, `muted-foreground`, `border` y `ring` existentes.
- Imágenes: no se agregaron ni sustituyeron recursos gráficos.
- Contenido: etiqueta accesible “Buscar noticias”, placeholder breve y acción “Limpiar búsqueda”.

**Findings**

- Sin hallazgos P0, P1 o P2.
- P3 preexistente: el encabezado global puede producir desplazamiento horizontal en el viewport de escritorio observado; el buscador permanece dentro del ancho útil y no es la causa.

**Parches realizados**

- Buscador responsive con iconos de la librería existente.
- Filtrado sin distinguir mayúsculas ni diacríticos.
- Estado vacío y reinicio de paginación.
- Portada limitada a las tres noticias más recientes.

final result: passed
