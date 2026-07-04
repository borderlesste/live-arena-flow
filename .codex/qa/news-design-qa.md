**Fuente visual**

- Selector: `C:\Users\leona\AppData\Local\Temp\codex-clipboard-d884cca9-ad7d-480b-af97-a730060b9636.png`.
- Noticias: `C:\Users\leona\AppData\Local\Temp\codex-clipboard-4989f6a8-07aa-461c-8d57-f970489e4cd5.png`.

**Implementación**

- URL: `http://127.0.0.1:8080/noticias`.
- Capturas revisadas en el navegador integrado: escritorio 1280 × 720 y móvil 390 × 844.
- Estados: listado con datos reales, modal abierto y perfil público sin referencias técnicas.

**Evidencia de comparación**

- La tarjeta mantiene imagen, categoría, título, resumen y antigüedad de la referencia; añade “Leer más” sin alterar su jerarquía.
- El modal reutiliza la imagen real y conserva el tema oscuro, tipografía y tokens verdes de la plataforma.
- En móvil, `scrollWidth` y `clientWidth` coinciden en 375 px; no existe desbordamiento horizontal.
- El selector amplía su panel hasta 34 rem, se alinea al extremo derecho del control y permite que los nombres completos ocupen varias líneas.

**Superficies de fidelidad**

- Tipografía: familia, pesos y jerarquía existentes preservados.
- Espaciado: grid responsive y ritmo de las tarjetas consistentes con Inicio.
- Color: tokens existentes; ámbar reservado para identificar patrocinio.
- Imágenes: se utilizan las imágenes persistidas, sin placeholders nuevos.
- Copy: lenguaje público en español y etiqueta explícita “Contenido patrocinado”.

**Findings**

- No quedan hallazgos P0, P1 o P2.
- [P3] Las imágenes remotas siguen usando `<img>` para conservar compatibilidad con data URLs y dominios dinámicos; ESLint mantiene la advertencia de optimización de Next.

**Parches realizados durante QA**

- Se añadió ancho responsive y alineación hacia la izquierda al selector.
- Se verificó el modal, la tarjeta y el perfil mediante DOM accesible.
- Se añadió prueba de regresión para nombres completos y ancho del selector.

final result: passed
