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

## Cómo se genera este sitio (el backend)

Esta carpeta no se edita a mano. Es la salida del backend del sistema Scopus, que está en la carpeta hermana `../backend-node`. Ahí, `src/perfiles.js` tiene la función `generar()`, que reconstruye todo lo de esta carpeta: `datos.js`, la carpeta `p/`, las fotos y el sello de versión de `index.html`.

Esa regeneración ocurre sola cada vez que el sistema toca los datos: al recargar los datos de Scopus, al fusionar perfiles, al asignar publicaciones, al enriquecer con ORCID, al cambiar afiliaciones o al subir la foto de un autor. También corre al arrancar el backend. O sea que cuando trabajas normal en el sistema, esta carpeta ya queda al día.

Para regenerarla a propósito, sin cargar datos nuevos:

```bash
cd ../backend-node
npm start
```

Al arrancar, el backend reconstruye esta carpeta con los datos que ya tiene guardados. Cuando veas en la consola el mensaje de que cargó los datos, la carpeta `sitio-perfiles` ya quedó actualizada y puedes detener el backend con Ctrl+C.

El backend y el resto del sistema Scopus **no** se suben al servidor de la universidad. Solo sirven para producir los archivos de esta carpeta. Lo único que publicas en el servidor es el contenido de `sitio-perfiles`.

## Subir y actualizar el sitio

Subes el sitio una vez y luego actualizas reemplazando los archivos de datos (`p/`, `fotos/`, `datos.js`, `index.html`), sin tocar nada de `SITIO_PERFILES_URL` ni `sitemap.xml`.

**La primera vez** subes todo el contenido de esta carpeta: las carpetas `p/` y `fotos/`, y los archivos `index.html`, `datos.js`, `app.js`, `estilos.css`, `logo_utm_2022.png` y `robots.txt`. No subas `.git`, `.gitignore`, los `.DS_Store` ni `package-lock.json`.

**En cada actualización** de datos Scopus reemplazas en el servidor solo lo que cambió: la carpeta `p/` completa, la carpeta `fotos/` si cambiaron las fotos, `datos.js` e `index.html`. Los demás archivos (`app.js`, `estilos.css`, `logo_utm_2022.png`) no se tocan, salvo que cambies el código o el diseño.

La carpeta `p/` se reemplaza siempre junto con `datos.js`, porque cada página trae los números del investigador incrustados. El `index.html` también, porque cambia el sello `datos.js?v=...` que rompe la caché del navegador y obliga a cargar los datos frescos.

---

Desarrollado por Jorge Párraga-Álava · Dirección de Investigación · Universidad Técnica de Manabí.
