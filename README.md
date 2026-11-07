# Portal de Perfiles UTM en Scopus

Sitio web público con los perfiles y la producción científica en Scopus de los investigadores de la Universidad Técnica de Manabí.

Es un sitio **estático**: HTML, CSS y JavaScript, más las páginas ya generadas. No corre Node, ni base de datos, ni PHP en el servidor. Para publicarlo basta un espacio web que sirva archivos con Apache o Nginx. Usa ruteo por hash (`#/`), así que no hacen falta reglas de reescritura.

Lo genera el backend cada vez que se recargan los datos. Este sitio es la salida de ese proceso, listo para subir.

## Estructura

- `index.html`: página principal del portal.
- `datos.js`: todos los datos bibliométricos (`window.DATOS`). Es el archivo más pesado.
- `app.js`: lógica del portal interactivo.
- `estilos.css`: estilos del sitio.
- `logo_utm_2022.png`: logo institucional.
- `robots.txt`: archivo para buscadores.
- `p/`: una página HTML por investigador, nombrada con su ID de Scopus. Cada página trae los números del autor incrustados en el HTML.
- `fotos/`: fotos de los autores.



Desarrollado por Jorge Párraga-Álava · Dirección de Investigación · Universidad Técnica de Manabí.
