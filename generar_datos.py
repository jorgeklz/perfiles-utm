"""Regenera `datos.js` manualmente (normalmente el backend lo hace solo tras
cada actualización de Scopus). No requiere el backend en ejecución.

    cd sitio-perfiles && python3 generar_datos.py
"""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "backend"))

import datos      # noqa: E402
import perfiles   # noqa: E402

# Cargar desde la BD las decisiones manuales antes de generar, para que el sitio
# refleje las fusiones de perfiles y las publicaciones asignadas a mano (p. ej.
# trabajos atribuidos a un autor que Scopus no vinculó a la UTM).
try:
    import asignaciones_pub   # noqa: E402
    import fusiones           # noqa: E402
    from base_datos import SesionLocal   # noqa: E402
    with SesionLocal() as bd:
        datos.set_fusiones(fusiones.cargar_map(bd))
        datos.set_asignaciones_pub(asignaciones_pub.cargar_pares(bd))
    print("Fusiones y asignaciones de publicaciones cargadas desde la base de datos")
except Exception as ex:
    print(f"Aviso: no se pudieron cargar fusiones/asignaciones ({ex}); "
          "el sitio se generará sin ellas")

datos.cargar()
if perfiles.generar():
    print(f"Generado {perfiles.RUTA_DATOS_JS}")
    print(f"  {len(datos.AUTORES)} autores · {len(datos.PUBLICACIONES)} publicaciones")
    print(f"  Tamaño: {os.path.getsize(perfiles.RUTA_DATOS_JS) / 1024:.0f} KB")
else:
    print("No se pudo generar datos.js")
