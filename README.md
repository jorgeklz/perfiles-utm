# Portal de Perfiles UTM en Scopus

Sitio web público con los perfiles y la producción científica en Scopus de los investigadores de la Universidad Técnica de Manabí. Muestra un directorio de investigadores, una ficha por persona, un tablero institucional y rankings anuales e históricos.

Este documento explica primero qué significa cada indicador y cómo se calcula, después cómo está organizado el sitio y, al final, cómo verlo en un equipo local.

## 1. Indicadores y sus cálculos

### Qué se cuenta

Todos los indicadores salen de las publicaciones indexadas en Scopus que cumplen estas reglas:

- Tienen al menos un autor con afiliación a la Universidad Técnica de Manabí.
- Fueron publicadas en 2010 o después (el año inicial es configurable).
- No son erratas, cartas, notas, editoriales ni documentos retractados.
- Si un mismo trabajo aparece dos veces con el mismo DOI, se cuenta una sola vez y se conserva el registro con más citas.

Un investigador entra al portal si tiene al menos una publicación que cumpla esas reglas. Cuando una persona tiene varios perfiles en Scopus y se fusionaron, cuenta como un solo autor, con sus publicaciones sumadas sin repetir.

Las citas son las que Scopus reporta el día de la última descarga. Esa fecha y hora (GMT-5) aparece sobre los indicadores de la portada, en la línea "Datos de Scopus al ...", y también en el pie de página.

### Indicadores de un investigador

| Indicador | Qué mide | Cómo se calcula |
|---|---|---|
| Publicaciones (P) | Producción | Número de publicaciones que cumplen las reglas anteriores. |
| Citas (C) | Impacto total | Suma de las citas de sus publicaciones. |
| C/P | Citas por publicación | C dividido entre P, con dos decimales. |
| Índice h | Productividad e impacto a la vez | Se ordenan las publicaciones de más a menos citadas. El índice h es la posición más alta en la que la publicación tiene al menos tantas citas como su posición. Con citas 10, 8, 5, 4 y 3, h es 4. |
| Índice i10 | Trabajos con impacto sostenido | Número de publicaciones con 10 citas o más. |
| Índice g | Peso de los trabajos más citados | El mayor g tal que las g publicaciones más citadas suman al menos g² citas. Con citas 10, 8, 5, 4 y 3 (suman 30), g es 5 porque 30 es mayor que 25. |
| Índice m | h ajustado por antigüedad | h dividido entre los años de actividad: año actual menos el año de su primera publicación, más uno. Con h igual a 10 y primera publicación en 2015, en 2026 son 12 años y m es 0,83. |
| Autores por publicación | Tamaño típico de sus equipos | Promedio de firmantes por publicación, contando a todos los coautores y no solo a los de la UTM. |
| % como primer autor | Liderazgo | Porcentaje de sus publicaciones en las que figura en la primera posición de firma. |
| % con al menos 1 cita | Alcance | Porcentaje de sus publicaciones con una cita o más. |

### Cuartiles y acceso abierto

El cuartil de cada publicación es el de su revista en el ranking SJR de SCImago: Q1 es el 25% superior de su área y Q4 el 25% inferior. "N/A" corresponde a documentos que no son de revista (libros, capítulos y ponencias), y "NC" a revistas sin cuartil disponible. El porcentaje de acceso abierto es la proporción de publicaciones con estado Open Access en Scopus.

### Indicadores institucionales de la portada

Autores, publicaciones, citas, C/P, h, i10, g y m del encabezado se calculan como si la UTM fuera un solo autor, sobre el conjunto completo de publicaciones. Por eso el h institucional no es la suma ni el promedio de los h individuales. "Autores" es el número de investigadores con al menos una publicación del conjunto, y m usa como primer año el de la publicación más antigua.

### Indicadores del año en curso

El Top 10 del año aplica las mismas fórmulas, pero solo con las publicaciones del año en curso. En un solo año, m es igual a h. Las citas son las acumuladas hasta la fecha de la descarga. En los gráficos, el año en curso se muestra como parcial (barra punteada) y se deja fuera de las tendencias, para no confundir un año incompleto con una caída.

Scopus indexa desde octubre o noviembre artículos en línea cuya fecha de portada es del año siguiente. Esas publicaciones se cuentan en los totales y en el perfil del autor, se marcan en los listados como "En línea antes de su volumen" y, en los gráficos, el año posterior se trata igual que el año en curso: barra punteada y fuera del promedio y la tendencia. El Top 10 del año usa siempre el año calendario actual, y el 1 de enero pasa solo al año nuevo con lo que ya esté acumulado.

### Top 10 y criterio de empates

La portada muestra dos listas: el Top 10 del año en curso, que aparece primero y por defecto, y el Top 10 histórico. En ambas se puede elegir la métrica de orden (publicaciones, citas, h, i10, g, m, C/P, autores por publicación, % como primer autor y % con al menos 1 cita).

1. **Orden.** De mayor a menor por la métrica elegida. Si dos investigadores tienen el mismo valor, desempata quien tenga más citas y, después, quien tenga más publicaciones. Si siguen iguales, queda el orden en que vienen en los datos.
2. **Puesto y medalla.** El puesto depende solo del valor que se ve en pantalla, ya redondeado. Quienes comparten ese valor llevan el mismo número, con numeración de competencia: 1, 2, 3, 3, 5. Si ese puesto compartido es 1, 2 o 3, todos los empatados llevan la medalla. No se entrega medalla cuando el valor es 0.

El desempate por citas y publicaciones solo decide quién aparece primero dentro de un empate, no el número de puesto. El corte a 10 se aplica después de ordenar, así que si hay un empate en el puesto 10, quien tenga menos citas y publicaciones puede quedar fuera de la lista aunque comparta el valor.

### Investigadores sin afiliación vigente

Un investigador conserva su producción mientras tenga publicaciones con filiación UTM, aunque su afiliación actual en Scopus ya no sea la Universidad Técnica de Manabí. En ese caso su ficha, el directorio y el Top 10 muestran la nota "Sin afiliación vigente con la Universidad Técnica de Manabí.".

## 2. Estructura del sitio

Es un sitio **estático**: HTML, CSS y JavaScript, más páginas ya generadas. No necesita servidor de aplicaciones ni base de datos. Usa ruteo por hash (`#/`), así que no hacen falta reglas de reescritura en el servidor.

- `index.html`: página principal del portal.
- `datos.js`: datos bibliométricos que consume el portal. Es el archivo más pesado.
- `app.js`: lógica del portal interactivo.
- `estilos.css` y `visitas.css`: estilos del sitio.
- `mapa-mundo.js`: contornos de los países para el mapa de colaboración internacional.
- `qrcode.js`: genera el código QR que lleva la ficha en PDF del investigador.
- `logo_utm_2022.png`: logo institucional.
- `robots.txt` y `sitemap.xml`: indicaciones para buscadores.
- `p/`: una página HTML por investigador, nombrada con su ID de Scopus. Cada página trae los números del autor incrustados, con metadatos Open Graph y datos estructurados JSON-LD para los buscadores.
- `fotos/`: fotos de los autores.

## 3. Ver el sitio en local

Desde la carpeta del sitio, con cualquier servidor de archivos estáticos. Por ejemplo, con Python:

```bash
python3 -m http.server 8080
```

Después abrir `http://localhost:8080`. No hace falta instalar nada más.

Para publicarlo, basta subir el contenido de esta carpeta a un espacio web que sirva archivos estáticos. En GitHub Pages, en Settings, Pages, la fuente debe ser la rama `main` y la raíz `/`.

---

Desarrollado por Jorge Párraga-Álava · Dirección de Investigación · Universidad Técnica de Manabí.
