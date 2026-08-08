/* Investigadores UTM — portal público estático. Lee window.DATOS (datos.js). */
(function () {
  const D = window.DATOS
  const app = document.getElementById('app')
  let perfilPubs = null   // publicaciones del perfil activo (para el popover contextual)
  // botón "Inicio de la página" (se muestra al final de cada vista, antes del pie)
  const TOP_PAGE_HTML = '<div class="wrap" style="padding-top:0;text-align:center">' +
    '<button class="top-page" title="Ir al inicio de la página">↑ Inicio de la página</button></div>'
  const porId = new Map(D.autores.map(a => [a.id, a]))
  const num = n => (n || 0).toLocaleString('es-EC')
  const esc = s => (s == null ? '' : String(s)).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  const COLQ = { Q1: '#1e6b14', Q2: '#7bbf3a', Q3: '#e0902d', Q4: '#b23b30', 'N/A': '#a8a394', NC: '#c9c4b8' }

  // explicaciones de cada indicador (tooltip al pasar el cursor sobre el KPI)
  const AY = {
    P: 'Publicaciones (P): número de documentos indexados en Scopus. Se excluyen erratas, cartas, notas y editoriales.',
    C: 'Citas (C): total de citas recibidas por esas publicaciones según Scopus.',
    h: 'Índice h: el mayor número h tal que h publicaciones tienen al menos h citas cada una. Mide productividad e impacto a la vez.',
    CP: 'C/P: citas por publicación; total de citas dividido entre el total de publicaciones (C ÷ P).',
    i10: 'Índice i10: número de publicaciones con al menos 10 citas cada una.',
    g: 'Índice g: el mayor número g tal que las g publicaciones más citadas acumulan al menos g² citas en total. Da más peso a los trabajos muy citados.',
    m: 'Índice m: índice h dividido por los años de actividad desde la primera publicación. Permite comparar investigadores de distinta antigüedad.',
    oa: 'Acceso abierto: porcentaje de publicaciones disponibles sin suscripción (estado Open Access según Scopus).',
    nr: 'Revistas: número de revistas distintas en las que ha publicado.',
  }

  // estadísticas globales (una vez)
  const G = (() => {
    const cit = D.pubs.map(p => p.c || 0)
    const total = cit.reduce((s, c) => s + c, 0)
    const ord = [...cit].sort((a, b) => b - a)
    let h = 0
    for (let i = 0; i < ord.length; i++) { if (ord[i] >= i + 1) h = i + 1; else break }
    const i10 = cit.filter(c => c >= 10).length
    let g = 0, acumulado = 0
    for (let i = 0; i < ord.length; i++) {
      acumulado += ord[i]
      if (acumulado >= (i + 1) * (i + 1)) g = i + 1; else break
    }
    const anios = D.pubs.map(p => p.y).filter(Boolean)
    const primerAnio = anios.length ? Math.min(...anios) : null
    const antiguedad = primerAnio ? Math.max(1, new Date().getFullYear() - primerAnio + 1) : 1
    const m = h / antiguedad
    return { autores: D.n_autores, pubs: D.n_pubs, citas: total, h, i10, g, m,
      cp: D.n_pubs ? total / D.n_pubs : 0 }
  })()

  // agregados institucionales para el tablero de la portada (una vez)
  const GI = (() => {
    const porAnio = {}, areas = new Map(), rev = new Map(), paises = new Map()
    let intl = 0
    D.pubs.forEach(p => {
      if (p.y) porAnio[p.y] = (porAnio[p.y] || 0) + 1
      ;(p.a || []).forEach(a => areas.set(a, (areas.get(a) || 0) + 1))
      if (p.j) rev.set(p.j, (rev.get(p.j) || 0) + 1)
      const pc = p.pc || []
      if (pc.length) { intl++; pc.forEach(c => paises.set(c, (paises.get(c) || 0) + 1)) }
    })
    const orden = m => [...m.entries()].sort((a, b) => b[1] - a[1])
    return {
      porAnio,
      topAreas: orden(areas).slice(0, 16),
      topRev: orden(rev).slice(0, 8),
      topPaises: orden(paises).slice(0, 12),
      pctIntl: D.n_pubs ? Math.round(100 * intl / D.n_pubs) : 0,
      nPaises: paises.size,
    }
  })()

  // puesto en la UTM por métrica, para las pastillas del perfil. El backend ya
  // envía el de P, C y h (rP, rC, rH); aquí se calculan las demás (C/P, i10, g,
  // m y % de acceso abierto) sobre todos los autores, una sola vez.
  const RANKS = (() => {
    const oaPct = new Map()
    D.autores.forEach(a => {
      let ab = 0, n = 0
      ;(D.porAutor[a.id] || []).forEach(i => {
        const p = D.pubs[i]; if (!p) return
        n++; if (p.oa && p.oa !== 'Closed' && p.oa !== 'Unknown') ab++
      })
      oaPct.set(a.id, n ? 100 * ab / n : 0)
    })
    const val = (a, m) => m === 'oa' ? (oaPct.get(a.id) || 0) : (a[m] || 0)
    const rank = new Map(D.autores.map(a => [a.id, {}]))
    ;['CP', 'i10', 'g', 'm', 'oa'].forEach(m => {
      [...D.autores].sort((x, y) => val(y, m) - val(x, m))
        .forEach((a, i) => { rank.get(a.id)[m] = i + 1 })
    })
    return rank
  })()
  const puestoTxt = r => r ? `Puesto ${r} en UTM` : ''

  // iconos minimalistas (Feather) para las estadísticas
  const ICON = {
    autores: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    pubs: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    citas: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    cp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    h: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    i10: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    g: '<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4l3 2"/>',
    m: '<path d="M3 20V10"/><path d="M9 20V4"/><path d="M15 20v-8"/><path d="M21 20V7"/>',
    fecha: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  }
  const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`
  const stat = (icon, v, e, ayuda) => `<div class="s" title="${esc(ayuda || '')}" style="cursor:help">${ico(icon)}<div><b>${v}</b><span>${e}</span></div></div>`

  function iniciales(a) {
    const partes = (a.n || '').split(',')
    const ap = (a.ap || partes[0] || '').trim()
    const nom = (partes[1] || '').trim()
    return ((ap[0] || '') + (nom[0] || '')).toUpperCase() || '·'
  }
  const avatar = (a, cls) =>
    `<div class="avatar${cls ? ' ' + cls : ''}">${a.f
      ? `<img src="fotos/${encodeURIComponent(a.id)}.jpg?v=${a.f}" alt="Foto de ${esc(a.n)}" loading="lazy">`
      : esc(iniciales(a))}</div>`

  const pieFecha = document.getElementById('pie-fecha')
  if (pieFecha && D.fecha) pieFecha.textContent = ' (actualizado al ' + (D.fecha || '').split(' ')[0] + ')'

  // año actual y métricas por autor restringidas a ese año (mismos criterios que
  // el histórico). Se usa D.porAutor para incluir fusiones y asignaciones manuales.
  const ANIO_ACTUAL = new Date().getFullYear()
  const ANUAL = (() => {
    const m = new Map()
    Object.entries(D.porAutor).forEach(([id, idxs]) => {
      const yp = idxs.map(i => D.pubs[i]).filter(p => p && p.y === ANIO_ACTUAL)
      if (!yp.length) return
      const cits = yp.map(p => p.c || 0)
      const P = yp.length
      const C = cits.reduce((s, c) => s + c, 0)
      const ord = [...cits].sort((a, b) => b - a)
      let h = 0
      for (let i = 0; i < ord.length; i++) { if (ord[i] >= i + 1) h = i + 1; else break }
      const i10 = cits.filter(c => c >= 10).length
      let g = 0, ac = 0
      for (let i = 0; i < ord.length; i++) { ac += ord[i]; if (ac >= (i + 1) * (i + 1)) g = i + 1; else break }
      const ncs = yp.map(p => p.nc).filter(Boolean)
      const apu = ncs.length ? +(ncs.reduce((s, n) => s + n, 0) / ncs.length).toFixed(1) : 0
      const primeros = yp.filter(p => p.fa && p.fa === id).length
      m.set(id, {
        P, C, h, i10, g,
        m: h,                                  // en un solo año, m equivale a h
        CP: P ? +(C / P).toFixed(2) : 0,
        apu,
        pfa: P ? Math.round(100 * primeros / P) : 0,
        cc: P ? Math.round(100 * cits.filter(c => c >= 1).length / P) : 0,
      })
    })
    return m
  })()

  // stopwords para "temas recurrentes" de los títulos
  const STOP = new Set(('de la el en y a los las del un una para con por que su al es una on of the and in to for with a an from using based study analysis new'
    + ' del una uso caso casos entre este esta como más o e u o'
    + ' effect effects role roles novel review approach method methods result results assessment evaluation application applications potential model models system systems'
    + ' use used two three during under between towards toward within among first via into their its case studies data high low level levels type types'
    + ' preface critical view views chapter book editorial introduction overview perspective perspectives special issue vol volume part'
    + ' sobre desde hacia según mediante través nivel niveles tipo tipos efecto efectos papel modelo modelos sistema sistemas revisión análisis estudio estudios método métodos'
    + ' aplicación aplicaciones evaluación caso casos capítulo libro nueva nuevo nuevos nuevas').split(/\s+/))

  // ---------- listado ----------
  // métricas por las que se puede ordenar (clave, etiqueta larga, unidad corta)
  const METRICAS_ORD = [
    ['P', 'Publicaciones', 'pub.'],
    ['C', 'Citas', 'citas'],
    ['h', 'Índice h', 'h'],
    ['i10', 'Índice i10', 'i10'],
    ['g', 'Índice g', 'g'],
    ['m', 'Índice m', 'm'],
    ['CP', 'Citas por publicación', 'C/P'],
    ['apu', 'Autores por publicación', 'aut./pub.'],
    ['pfa', '% como primer autor', '% 1er aut.'],
    ['cc', '% con al menos 1 cita', '% con cita'],
  ]
  const estado = { q: '', orden: 'P', letra: '', pagina: 1, topTab: 'hist', topMetric: 'P', topMetricAnual: 'P', pubMetric: 'recientes' }
  const POR_PAGINA = 20
  let refGrid, refConteo, refPag, refPagTop
  let comStop = null   // limpieza del grafo de comunidades del perfil anterior

  function renderLista() {
    perfilPubs = null   // en la portada, el gráfico institucional filtra sobre D.pubs
    app.innerHTML = `
      <section class="hero"><div class="hero-inner">
        <p>Refleja exclusivamente las investigaciones en las que los autores figuran con
           afiliación a la Universidad Técnica de Manabí.</p>
        <div class="hero-stats">
          ${stat('autores', num(G.autores), 'Autores',
    'Investigadores UTM con al menos una publicación indexada en Scopus.')}
          ${stat('pubs', num(G.pubs), 'Publicaciones (P)',
      'Número de documentos UTM indexados en Scopus (se excluyen erratas, cartas, notas y editoriales).')}
          ${stat('citas', num(G.citas), 'Citas (C)',
        'Suma de todas las citas recibidas por las publicaciones según Scopus.')}
          ${stat('cp', G.cp.toFixed(2), 'Citas por publicación (C/P)',
          'Promedio de citas por documento: total de citas dividido entre total de publicaciones (C ÷ P).')}
          ${stat('h', G.h, 'Índice h (h)',
            'El mayor número h tal que h publicaciones tienen al menos h citas cada una.')}
          ${stat('i10', G.i10, 'Índice i10',
            'Número de publicaciones UTM con al menos 10 citas cada una.')}
          ${stat('g', G.g, 'Índice g',
            'El mayor número g tal que las g publicaciones más citadas acumulan al menos g² citas en total.')}
          ${stat('m', G.m.toFixed(2), 'Índice m',
            'Índice h dividido por los años desde la primera publicación indexada. Permite comparar el ritmo de crecimiento del impacto.')}
        </div></div></section>
      ${panoramaHTML()}
      <div class="wrap" style="padding-bottom:0">
        <h2 class="dir-tit">Top 10 investigadores</h2>
        <div class="ayuda-filtros">Elija entre el ranking histórico y el del año en curso, y ordene por el
          indicador que prefiera.</div>
        ${destacadosHTML()}
      </div>
      ${novedadesHTML()}
      <div class="wrap" id="dirsec">
        <h2 class="dir-tit">Directorio de investigadores</h2>
        <div class="ayuda-filtros">Use el buscador para encontrar un autor por nombre o apellido, las letras para
          filtrar por la inicial del apellido y el desplegable para ordenar.</div>
        <div class="controles">
          <div class="buscador">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="q" placeholder="Buscar investigador por nombre, apellido o Scopus ID…" autocomplete="off" />
          </div>
          <select class="selector" id="orden">
            ${METRICAS_ORD.map(([k, et]) => `<option value="${k}">Ordenar: ${et}</option>`).join('')}
            <option value="ap">Ordenar: Apellido (A–Z)</option>
          </select>
          <div class="conteo" id="conteo"></div>
        </div>
        <div class="alfabeto" id="alf"></div>
        <div class="paginacion" id="pagTop"></div>
        <div class="grid-inv" id="grid"></div>
        <div class="paginacion" id="pag"></div>
      </div>
      ${TOP_PAGE_HTML}`

    const q = document.getElementById('q'); q.value = estado.q
    const orden = document.getElementById('orden'); orden.value = estado.orden
    refGrid = document.getElementById('grid')
    refConteo = document.getElementById('conteo')
    refPag = document.getElementById('pag')
    refPagTop = document.getElementById('pagTop')

    q.addEventListener('input', () => { estado.q = q.value; estado.pagina = 1; pintar(); verDirectorio(false) })
    orden.addEventListener('change', () => { estado.orden = orden.value; estado.pagina = 1; pintar(); verDirectorio(false) })

    const alf = document.getElementById('alf')
    const letras = ['', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
    alf.innerHTML = letras.map(l =>
      `<button data-l="${l}">${l || 'Todos'}</button>`).join('')
    alf.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      estado.letra = b.dataset.l; estado.pagina = 1; marcarLetra(); pintar(); verDirectorio(false)
    }))

    const selTop = document.getElementById('topMetric')
    if (selTop) { selTop.value = estado.topMetric; selTop.addEventListener('change', () => { estado.topMetric = selTop.value; pintarTop() }) }
    pintarTop()
    const selTopAnual = document.getElementById('topMetricAnual')
    if (selTopAnual) { selTopAnual.value = estado.topMetricAnual; selTopAnual.addEventListener('change', () => { estado.topMetricAnual = selTopAnual.value; pintarTopAnual() }) }
    pintarTopAnual()
    document.querySelectorAll('.top-tab[data-tab]').forEach(b => b.addEventListener('click', () => {
      estado.topTab = b.dataset.tab; aplicarTopTab()
    }))
    aplicarTopTab()

    // novedades: conmutador recientes / más citadas
    document.querySelectorAll('.pub-tab').forEach(b => b.addEventListener('click', () => {
      estado.pubMetric = b.dataset.pm
      document.querySelectorAll('.pub-tab').forEach(x =>
        x.classList.toggle('on', x.dataset.pm === estado.pubMetric))
      pintarRecientes()
    }))
    document.querySelectorAll('.pub-tab').forEach(b =>
      b.classList.toggle('on', b.dataset.pm === estado.pubMetric))
    pintarRecientes()

    marcarLetra()
    pintar()
  }

  // ---------- portada: tablero institucional y novedades ----------
  function panoramaHTML() {
    const maxR = GI.topRev.length ? GI.topRev[0][1] : 1
    const revHTML = GI.topRev.map(([n, c]) =>
      `<div class="tipo-fila" data-cat="revista" data-val="${esc(n)}" style="cursor:pointer" title="Ver publicaciones de ${esc(n)}"><span class="tn">${esc(n)}</span>
        <span class="tb"><div style="width:${Math.max(3, Math.round(100 * c / maxR))}%"></div></span>
        <span class="tv">${c}</span></div>`).join('')
    const paisesHTML = GI.topPaises.length
      ? GI.topPaises.map(([p, c]) => `<span class="ce-chip" data-cat="pais" data-val="${esc(p)}" style="cursor:pointer" title="Ver publicaciones con ${esc(p)}">${esc(p)}<b>${c}</b></span>`).join('')
      : '<span style="color:var(--texto3);font-size:12.5px">Sin colaboración internacional registrada.</span>'
    return `<div class="wrap portada" style="padding-bottom:0">
      <h2 class="dir-tit">Panorama institucional</h2>
      <div class="ayuda-filtros">Producción científica de la Universidad Técnica de Manabí indexada en Scopus, en conjunto.</div>
      <div class="panel" style="margin-bottom:16px"><h3>Publicaciones por año</h3>${barsAnio(GI.porAnio, 200)}${infoAnios(GI.porAnio)}
        <div class="ctx-hint">Clic en una barra para ver las publicaciones de ese año.</div></div>
      <div class="grid2">
        <div class="panel"><h3>Fuentes más frecuentes</h3><div class="tipos-barras">${revHTML}</div>
          <div class="ctx-hint">Clic en una fuente para ver sus publicaciones más recientes.</div></div>
        <div class="panel"><h3>Colaboración internacional</h3>
          <div class="metricas-autoria intl" style="margin-top:0;border-top:none;padding-top:0">
            <div class="ma"><b>${GI.pctIntl}%</b><span>Publicaciones con coautoría internacional</span></div>
            <div class="ma"><b>${GI.nPaises}</b><span>Países colaboradores</span></div>
          </div>
          <div class="ce-sub">Principales países</div>
          <div class="ce-chips">${paisesHTML}</div>
          <div class="ctx-hint">Clic en un país para ver las publicaciones en colaboración.</div></div>
      </div>
    </div>`
  }

  function novedadesHTML() {
    return `<div class="wrap portada" style="padding-bottom:0">
      <h2 class="dir-tit">Últimas publicaciones</h2>
      <div class="ayuda-filtros">Documentos indexados más recientes; cambie a las más citadas si lo prefiere.</div>
      <div class="panel">
        <div class="top-tabs" style="margin-bottom:12px">
          <button class="top-tab pub-tab" data-pm="recientes">Más recientes</button>
          <button class="top-tab pub-tab" data-pm="citadas"
            title="Publicaciones recientes que más citas han recibido">Recientes más citadas</button>
        </div>
        <div id="destPubs"></div>
      </div>
    </div>`
  }

  function marcarLetra() {
    document.querySelectorAll('#alf button').forEach(b =>
      b.classList.toggle('on', b.dataset.l === estado.letra))
  }

  // quita acentos y pasa a minúsculas para buscar sin importar tildes ni comas
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[,\-]/g, ' ')

  function filtrar() {
    const tokens = norm(estado.q).split(/\s+/).filter(Boolean)
    let arr = D.autores
    // cada palabra escrita debe estar en el nombre (apellido y/o nombre, en cualquier
    // orden) o en el Scopus ID del autor
    if (tokens.length) arr = arr.filter(a => {
      const nombre = norm(a.n)
      const id = String(a.id || '')
      return tokens.every(tk => nombre.includes(tk) || id.includes(tk))
    })
    if (estado.letra) arr = arr.filter(a => (a.ap || a.n)[0] &&
      (a.ap || a.n)[0].toUpperCase() === estado.letra)
    const o = estado.orden
    return [...arr].sort((a, b) => o === 'ap'
      ? (a.ap || '').localeCompare(b.ap || '')
      : (b[o] || 0) - (a[o] || 0))
  }

  function pintar() {
    const arr = filtrar()
    const total = arr.length
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
    if (estado.pagina > paginas) estado.pagina = paginas
    const ini = (estado.pagina - 1) * POR_PAGINA
    const vis = arr.slice(ini, ini + POR_PAGINA)
    refConteo.textContent = num(total) + ' investigadores'
    refGrid.innerHTML = vis.length ? vis.map(cardInv).join('')
      : '<div class="vacio">Sin coincidencias.</div>'
    // Misma paginación y "Página X de Y" arriba y abajo de la lista.
    const htmlPag = (paginas > 1
      ? `<div class="pag-actual">Página ${estado.pagina} de ${paginas}</div>` : '') +
      paginacionHTML(estado.pagina, paginas)
    for (const ref of [refPagTop, refPag]) {
      if (!ref) continue
      ref.innerHTML = htmlPag
      ref.querySelectorAll('button[data-p]').forEach(b => b.addEventListener('click', () => {
        estado.pagina = +b.dataset.p; pintar()
        verDirectorio(true)
      }))
    }
  }
  // Mantiene la vista en el directorio al paginar o filtrar, en vez de saltar al
  // inicio de la página. Con smooth desplaza siempre; si no, solo reposiciona
  // cuando la sección quedó por encima del viewport (al encogerse los resultados).
  function verDirectorio(smooth) {
    const el = document.getElementById('dirsec')
    if (!el) return
    if (smooth || el.getBoundingClientRect().top < 0)
      el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
  }

  function paginacionHTML(cur, tot) {
    if (tot <= 1) return ''
    const btn = (p, label, on, dis) =>
      `<button data-p="${p}"${on ? ' class="on"' : ''}${dis ? ' disabled' : ''}>${label}</button>`
    let out = btn(cur - 1, '‹', false, cur === 1)
    const claves = [...new Set([1, 2, tot - 1, tot, cur - 1, cur, cur + 1])]
      .filter(p => p >= 1 && p <= tot).sort((a, b) => a - b)
    let prev = 0
    claves.forEach(p => {
      if (prev && p - prev > 1) out += '<span class="puntos">…</span>'
      out += btn(p, p, p === cur, false)
      prev = p
    })
    out += btn(cur + 1, '›', false, cur === tot)
    return out
  }

  const SEL_ESTILO = 'margin-left:auto;text-transform:none;letter-spacing:0;font-weight:400;height:auto;padding:6px 9px;font-size:12.5px'
  function destacadosHTML() {
    return `<div class="destacados">
      <div class="panel"><div class="top-cab">
        <div class="top-tabs">
          <button class="top-tab" data-tab="hist">Top 10 histórico</button>
          <button class="top-tab" data-tab="anual">Top 10 del año ${ANIO_ACTUAL}</button>
        </div>
        <select class="selector" id="topMetric" style="${SEL_ESTILO}">
          ${METRICAS_ORD.map(([k, et]) => `<option value="${k}">Por ${et.toLowerCase()}</option>`).join('')}
        </select>
        <select class="selector" id="topMetricAnual" style="${SEL_ESTILO}">
          ${METRICAS_ORD.map(([k, et]) => `<option value="${k}">Por ${et.toLowerCase()}</option>`).join('')}
        </select></div>
        <div id="destTop"></div>
        <div id="destTopAnual"></div></div></div>`
  }
  function aplicarTopTab() {
    const hist = estado.topTab !== 'anual'
    const el = id => document.getElementById(id)
    const dt = el('destTop'), dta = el('destTopAnual'), sm = el('topMetric'), sma = el('topMetricAnual')
    if (dt) dt.style.display = hist ? '' : 'none'
    if (dta) dta.style.display = hist ? 'none' : ''
    if (sm) sm.style.display = hist ? '' : 'none'
    if (sma) sma.style.display = hist ? 'none' : ''
    document.querySelectorAll('.top-tab[data-tab]').forEach(b =>
      b.classList.toggle('on', (b.dataset.tab === 'anual') === !hist))
  }
  const ETQ_TOP = Object.fromEntries(METRICAS_ORD.map(([k, , u]) => [k, u]))
  function itemTop(a, i, m) {
    const val = m === 'C' ? num(a.C) : (a[m])
    return `<div class="destacado"><div class="rk">${i + 1}</div>${avatar(a)}
      <div class="dn"><a href="#/autor/${encodeURIComponent(a.id)}">${esc(a.n)}</a>
        <small><span class="pub-link" data-cat="autorPubs" data-val="${esc(a.id)}" title="Ver las publicaciones">${a.P} pub</span> · ${num(a.C)} citas</small>${notaExUtm(a)}</div>
      <div class="dm pub-link" data-cat="autorPubs" data-val="${esc(a.id)}" title="Ver las publicaciones"><b>${val}</b>${ETQ_TOP[m]}</div></div>`
  }
  function pintarTop() {
    const cont = document.getElementById('destTop'); if (!cont) return
    const m = estado.topMetric
    const top10 = [...D.autores].sort((a, b) => (b[m] || 0) - (a[m] || 0)).slice(0, 10)
    cont.innerHTML = top10.map((a, i) => itemTop(a, i, m)).join('')
  }
  function itemTopAnual(id, r, i, m) {
    const a = porId.get(id)
    const val = m === 'C' ? num(r.C) : r[m]
    return `<div class="destacado"><div class="rk">${i + 1}</div>${avatar(a)}
      <div class="dn"><a href="#/autor/${encodeURIComponent(a.id)}">${esc(a.n)}</a>
        <small><span class="pub-link" data-cat="autorPubsAnio" data-val="${esc(id)}" title="Ver las publicaciones de ${ANIO_ACTUAL}">${r.P} pub</span> · ${num(r.C)} citas en ${ANIO_ACTUAL}</small>${notaExUtm(a)}</div>
      <div class="dm pub-link" data-cat="autorPubsAnio" data-val="${esc(id)}" title="Ver las publicaciones de ${ANIO_ACTUAL}"><b>${val}</b>${ETQ_TOP[m]}</div></div>`
  }
  function pintarTopAnual() {
    const cont = document.getElementById('destTopAnual'); if (!cont) return
    const m = estado.topMetricAnual
    const arr = [...ANUAL.entries()].filter(([id]) => porId.has(id))
      .sort((x, y) => (y[1][m] || 0) - (x[1][m] || 0) || (y[1].C - x[1].C))
      .slice(0, 10)
    cont.innerHTML = arr.length
      ? arr.map(([id, r], i) => itemTopAnual(id, r, i, m)).join('')
      : `<div style="color:var(--texto3);font-size:13px;padding:8px 2px">Sin publicaciones registradas en ${ANIO_ACTUAL} todavía.</div>`
  }
  function pintarRecientes() {
    const cont = document.getElementById('destPubs'); if (!cont) return
    let lista
    if (estado.pubMetric === 'citadas') {
      // Publicaciones recientes que más citas han ganado: se limita a los dos
      // últimos años para que destaque lo que está teniendo impacto ahora, y no
      // los clásicos que acumulan citas desde hace una década.
      const desde = ANIO_ACTUAL - 1
      const recientes = D.pubs.filter(p => (p.y || 0) >= desde && (p.c || 0) > 0)
      const base = recientes.length >= 5 ? recientes : D.pubs.filter(p => (p.c || 0) > 0)
      lista = [...base].sort((a, b) => (b.c || 0) - (a.c || 0) || (b.y || 0) - (a.y || 0)).slice(0, 5)
    } else {
      lista = [...D.pubs].map(p => ({ p, k: p.d || ((p.y || 0) + '-00-00') }))
        .sort((a, b) => (a.k < b.k ? 1 : a.k > b.k ? -1 : 0)).slice(0, 5).map(x => x.p)
    }
    cont.innerHTML = lista.map(recipRow).join('')
  }
  function recipRow(p) {
    const au = (p.u || []).map(u => porId.get(u)).filter(Boolean)
    const aut = au.length ? `<a href="#/autor/${encodeURIComponent(au[0].id)}">${esc(au[0].n)}</a>${au.length > 1 ? ' y ' + (au.length - 1) + ' más' : ''}` : ''
    const t = p.doi ? `<a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noreferrer">${esc(p.t)}</a>` : esc(p.t)
    const citas = `<span class="recip-citas" title="Citas recibidas según Scopus">${num(p.c || 0)} ${(p.c || 0) === 1 ? 'cita' : 'citas'}</span>`
    return `<div class="recip"><div class="rt">${t}</div><div class="rm">${p.y || ''} · ${esc(p.j || '—')} · ${badgeQ(p.q)} · ${citas}${aut ? ' · ' + aut : ''}</div></div>`
  }

  function cardInv(a) {
    return `<button class="card-inv" onclick="location.hash='#/autor/${encodeURIComponent(a.id)}'">
      ${avatar(a)}
      <div class="info">
        <div class="nom">${esc(a.n)}</div>
        ${notaExUtm(a)}
        <div class="anios">Activo ${a.pa || '—'}–${a.ua || '—'}</div>
        <div class="mini">
          <div><b>${a.P}</b><span>Pub.</span></div>
          <div><b>${num(a.C)}</b><span>Citas</span></div>
          <div><b>${a.h}</b><span>h</span></div>
          <div><b>${a.CP}</b><span>C/P</span></div>
        </div>
      </div></button>`
  }

  // Identificadores de Scopus del autor: uno si el perfil es único, o todos los
  // que se unificaron. Cada uno enlaza a su ficha en Scopus.
  function idsScopusHTML(a) {
    const fus = a.fx || []
    const ids = [String(a.id), ...fus.map(String)]
    const chip = (x, principal) =>
      `<a class="id-chip${principal ? ' principal' : ''}" target="_blank" rel="noreferrer"
          href="https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(x)}"
          title="${principal ? 'Perfil principal en Scopus' : 'Perfil unificado en el principal'} · abrir en Scopus">${esc(x)}</a>`
    return `<div class="ids-scopus">
      <span class="ids-et">${ids.length > 1 ? `Perfiles Scopus unificados (${ids.length})` : 'ID Scopus'}</span>
      <span class="ids-lista">${ids.map((x, i) => chip(x, i === 0)).join('')}</span>
    </div>`
  }

  // ---------- perfil ----------
  function renderPerfil(id) {
    const a = porId.get(id)
    if (!a) {
      perfilPubs = null
      app.innerHTML = `<div class="wrap"><a class="volver" href="#/">← Volver a la página principal</a>
        <div class="panel"><div class="vacio">Investigador no encontrado.</div></div></div>`
      return
    }
    const pubs = (D.porAutor[id] || []).map(i => D.pubs[i]).filter(Boolean)
    const porAnio = {}, cq = {}, ct = {}, ca = {}, cc = {}
    let abiertos = 0
    pubs.forEach(p => {
      if (p.y) porAnio[p.y] = (porAnio[p.y] || 0) + 1
      cq[p.q] = (cq[p.q] || 0) + 1
      ct[p.st || 'Otro'] = (ct[p.st || 'Otro'] || 0) + 1
      ;(p.a || []).forEach(x => { ca[x] = (ca[x] || 0) + 1 })
      ;(p.u || []).forEach(u => { if (u !== id) cc[u] = (cc[u] || 0) + 1 })
      if (p.oa && p.oa !== 'Closed' && p.oa !== 'Unknown') abiertos++
    })
    const pctOA = pubs.length ? Math.round(100 * abiertos / pubs.length) : 0
    const areas = Object.entries(ca).sort((x, y) => y[1] - x[1]).slice(0, 14)
    const coaut = Object.entries(cc).filter(([u]) => porId.has(u))
      .sort((x, y) => y[1] - x[1])
    const revMap = {}
    pubs.forEach(p => {
      const nombre = p.j || 'Sin revista o conferencia registrada'
      if (!revMap[nombre]) revMap[nombre] = { n: 0, qs: {}, ret: 0 }
      revMap[nombre].n++
      const q = p.q || 'N/A'
      revMap[nombre].qs[q] = (revMap[nombre].qs[q] || 0) + 1
      if (p.r) revMap[nombre].ret++
    })
    const revistas = Object.entries(revMap).map(([nombre, v]) => {
      const qTop = Object.entries(v.qs).sort((x, y) => y[1] - x[1])[0][0]
      // Fuente retirada: todas sus publicaciones están marcadas como retiradas.
      return [nombre, v.n, qTop, v.n > 0 && v.ret === v.n]
    }).sort((x, y) => y[1] - x[1])
    const pubsOrd = [...pubs].sort((x, y) => (y.y || 0) - (x.y || 0) || (y.c - x.c))
    const R = RANKS.get(a.id) || {}   // puestos en la UTM por métrica (pastillas)
    // consulta para búsquedas externas: "Nombres Apellido" (el dato viene como "Apellido, Nombres")
    const orcid = encodeURIComponent(
      (a.n || '').includes(',')
        ? `${a.n.split(',').slice(1).join(' ').trim()} ${a.n.split(',')[0].trim()}`
        : (a.n || ''))

    app.innerHTML = `<div class="wrap">
      <a class="volver" href="#/">← Volver a la página principal</a>
      <div class="perfil-hero">
        ${avatar(a)}
        <div style="flex:1;min-width:240px">
          <h2>${esc(a.n)}</h2>
          ${a.xu ? `<div class="ex-utm" title="Conserva su producción con filiación UTM, pero su afiliación actual en Scopus ya no es la UTM.">⚑ Sin afiliación vigente con la Universidad Técnica de Manabí.</div>` : ''}
          <div class="sub">Autor UTM en Scopus · Activo ${a.pa || '—'}–${a.ua || '—'}${a.rP ? ` · Puesto ${a.rP} en publicaciones en la UTM` : ''}</div>
          ${idsScopusHTML(a)}
          <div class="enlaces">
            <a class="btn-ext" href="https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(a.id)}" target="_blank" rel="noreferrer">Perfil en Scopus ↗</a>
            ${a.or
        ? `<a class="btn-ext" href="https://orcid.org/${esc(a.or)}" target="_blank" rel="noreferrer">ORCID ${esc(a.or)} ↗</a>`
        : `<a class="btn-ext" href="https://orcid.org/orcid-search/search?searchQuery=${orcid}" target="_blank" rel="noreferrer">Buscar en ORCID ↗</a>`}
            <a class="btn-ext" href="https://scholar.google.com/citations?view_op=search_authors&mauthors=${orcid}" target="_blank" rel="noreferrer">Buscar en Google Scholar ↗</a>
            <a class="btn-ext" href="https://www.researchgate.net/search/researcher?q=${orcid}" target="_blank" rel="noreferrer">Buscar en ResearchGate ↗</a>
          </div>
        </div>
      </div>

      <div class="kpis">
        ${kpi(a.P, 'Publicaciones', puestoTxt(a.rP), AY.P)}
        ${kpi(num(a.C), 'Citas', puestoTxt(a.rC), AY.C)}
        ${kpi(a.h, 'Índice h', puestoTxt(a.rH), AY.h)}
        ${kpi(a.CP, 'Citas / pub.', puestoTxt(R.CP), AY.CP)}
        ${kpi(a.i10, 'Índice i10', puestoTxt(R.i10), AY.i10)}
        ${kpi(a.g ?? 0, 'Índice g', puestoTxt(R.g), AY.g)}
        ${kpi(a.m ?? 0, 'Índice m', puestoTxt(R.m), AY.m)}
        ${kpi(pctOA + '%', 'Acceso abierto', puestoTxt(R.oa), AY.oa)}
      </div>

      <div class="grid2">
        <div class="panel"><h3>Publicaciones por año</h3>${barsAnio(porAnio)}${infoAnios(porAnio)}
          <div class="ctx-hint">Clic en una barra para ver las publicaciones de ese año.</div></div>
        <div class="panel"><h3>Distribución por cuartil SJR y tipo</h3>${donut(cq)}
          <div class="subtitulo-panel">Por tipo de documento</div>${tiposBarras(ct)}
          <div class="metricas-autoria">
            <div class="ma"><b>${a.apu ?? '—'}</b><span>Autores por publicación (promedio)</span></div>
            <div class="ma"><b>${(a.pfa ?? 0)}%</b><span>Publicaciones como primer autor</span></div>
            <div class="ma"><b>${(a.cc ?? 0)}%</b><span>Publicaciones con al menos 1 cita</span></div>
          </div>
          <div class="ctx-hint">Clic en un cuartil o tipo para ver sus publicaciones.</div></div>
      </div>

      <div class="panel panel-fuentes"><h3>Fuentes donde ha publicado (${revistas.length})</h3>
        ${revistas.length
        ? '<div class="revistas" id="revCont"></div><div class="paginacion" id="revPager"></div>'
        : '<div style="color:var(--texto3);font-size:13px">Sin datos de revistas o conferencias.</div>'}</div>

      <div class="grid2">
        <div class="panel"><h3>Líneas de investigación</h3>
          <div class="subtitulo-panel" style="margin-top:0">Áreas temáticas de Scopus</div>${areasBarras(areas)}
          ${(() => { const fr = frasesTitulos(pubs); return fr.length
            ? `<div class="subtitulo-panel">Frases frecuentes en sus títulos</div>${frasesHTML(fr)}` : '' })()}</div>
        <div class="panel"><h3>Coautores UTM (${coaut.length})</h3>
          ${coaut.length
        ? '<div class="coautores" id="coautCont"></div><div class="paginacion" id="coautPager"></div>'
        : '<div style="color:var(--texto3);font-size:13px">Sin coautorías con otros autores UTM.</div>'}</div>
      </div>

      <div class="panel" style="margin-bottom:18px"><h3>Colaboración externa</h3>${coautoriaExterna(a)}</div>

      <div class="panel" style="margin-bottom:18px"><h3>Comunidades de coautoría</h3>
        <p class="ayuda-filtros" style="margin:0 0 12px">
          Cada nodo es un coautor y su tamaño indica los trabajos en común; las líneas unen a quienes
          han publicado juntos. Los colores agrupan a los coautores que publican entre sí. Elija un
          grupo en la leyenda para ver sus nombres, o haga clic en un coautor para ver las
          publicaciones que comparte con ${esc(a.n)}.
        </p>
        <div id="comWrap" class="com-wrap">
          <canvas id="comCanvas"></canvas>
          <div class="com-zoom">
            <button type="button" id="comIn" title="Acercar">＋</button>
            <button type="button" id="comOut" title="Alejar">－</button>
            <button type="button" id="comReset" title="Restablecer vista">⟲</button>
          </div>
          <div id="comVacio" class="vacio" style="display:none">Aún no hay coautores suficientes para graficar comunidades.</div>
          <div id="comLeyenda" class="com-leyenda"></div>
        </div>
        <div id="comSel" class="com-sel" style="display:none"></div>
      </div>

      ${panelPubsHTML('Publicaciones', pubs.length, true)}
    </div>
    ${TOP_PAGE_HTML}`

    const topCit = new Set([...pubs].filter(p => (p.c || 0) > 0)
      .sort((x, y) => (y.c || 0) - (x.c || 0)).slice(0, 3))
    perfilPubs = pubs   // usado por el manejador delegado del popover
    wirePubs(pubsOrd, p => pubRow(p, topCit.has(p)))
    paginar('coautCont', 'coautPager', coaut, coautRow, 5)
    paginar('revCont', 'revPager', revistas, revistaRow, 5)
    if ((a.cx || []).length) paginar('ceCoautCont', 'ceCoautPager', a.cx, coautExtRow, 5)
    if ((a.ix || []).length) paginar('ceInstCont', 'ceInstPager', a.ix, instRow, 5)
    wireCoautExtTabs()
    wireComunidades(a, pubs)
  }

  function revistaRow([nombre, n, q, retirada]) {
    // El flag va FUERA de .rv-n, porque esa columna trunca el texto (ellipsis) y
    // ocultaría la etiqueta. Como ítem propio del flex no se recorta.
    const ret = retirada
      ? `<span class="retirada" style="flex-shrink:0" title="La revista o fuente fue retirada de Scopus (discontinued source).">⚑ Revista retirada de Scopus</span>`
      : ''
    return `<div class="revista-fila"><span class="rv-n">${esc(nombre)}</span>${ret}
      <span class="rv-q">${badgeQ(q)}</span>
      <span class="rv-c" data-cat="revista" data-val="${esc(nombre)}" title="Ver las publicaciones en esta fuente">${n} pub.</span></div>`
  }

  function coautRow([u, c]) {
    const co = porId.get(u)
    // El nombre lleva al perfil del coautor; el número abre el menú contextual con
    // las publicaciones en común, igual que en la lista de coautoría externa.
    return `<div class="coautor">
      <a class="coautor-ir" href="#/autor/${encodeURIComponent(u)}" title="Ver el perfil de ${esc(co.n)}">${avatar(co)}<span class="cn">${esc(co.n)}</span></a>
      <span class="cc" data-cat="coautorUtm" data-val="${esc(u)}" title="Ver las publicaciones en común">${c} en común</span>
    </div>`
  }

  // Grafo animado de comunidades de coautoría (ego-red del autor). Autocontenido:
  // simulación de fuerzas y dibujo en canvas, sin librerías. Misma idea que la red
  // de coautoría del sistema: nodos por colaborador, color por comunidad detectada.
  function wireComunidades(a, pubs) {
    if (comStop) { comStop(); comStop = null }
    const wrap = document.getElementById('comWrap')
    const canvas = document.getElementById('comCanvas')
    const vacio = document.getElementById('comVacio')
    const leyenda = document.getElementById('comLeyenda')
    if (!wrap || !canvas) return
    const PAL = ['#1e6b14', '#b58a00', '#2563a8', '#a8385d', '#7048a8', '#0e8074', '#b35e1f', '#5a7a1e', '#8a2f6b', '#3a6ea5']
    const GRIS = '#9aa590'
    const self = String(a.id)

    // recolectar coautores (UTM y externos) y co-ocurrencias desde las publicaciones
    const nombreDe = new Map(), utmDe = new Map(), pesoCon = new Map(), pares = new Map()
    const kkey = (x, y) => x < y ? x + '|' + y : y + '|' + x
    for (const [pid, nom] of (a.cx || [])) { nombreDe.set(String(pid), nom); utmDe.set(String(pid), false) }
    for (const p of pubs) {
      const co = new Set()
      for (const u of (p.u || [])) { const s = String(u); if (s !== self) co.add(s) }
      for (const x of (p.xa || [])) { const s = String(x); if (s !== self) co.add(s) }
      for (const c of co) {
        pesoCon.set(c, (pesoCon.get(c) || 0) + 1)
        const au = porId.get(c)
        if (au) { nombreDe.set(c, au.n); utmDe.set(c, true) }
        else if (!nombreDe.has(c)) { nombreDe.set(c, c); utmDe.set(c, false) }
      }
      const arr = [...co]
      for (let i = 0; i < arr.length; i++)
        for (let j = i + 1; j < arr.length; j++) {
          const k = kkey(arr[i], arr[j]); pares.set(k, (pares.get(k) || 0) + 1)
        }
    }
    const top = [...pesoCon.entries()].sort((x, y) => y[1] - x[1]).slice(0, 45)
    if (top.length < 2) { canvas.style.display = 'none'; if (vacio) vacio.style.display = 'flex'; if (leyenda) leyenda.style.display = 'none'; return }
    const idset = new Set(top.map(([c]) => c))

    // comunidades por propagación de etiquetas sobre el grafo coautor-coautor
    const adj = new Map([...idset].map(c => [c, new Map()]))
    for (const [k, w] of pares) {
      const [u, v] = k.split('|')
      if (idset.has(u) && idset.has(v)) { adj.get(u).set(v, w); adj.get(v).set(u, w) }
    }
    const label = new Map([...idset].map((c, i) => [c, i]))
    for (let it = 0; it < 14; it++) {
      let ch = false
      for (const c of idset) {
        const cnt = new Map()
        for (const [nb, w] of adj.get(c)) cnt.set(label.get(nb), (cnt.get(label.get(nb)) || 0) + w)
        if (!cnt.size) continue
        let best = label.get(c), bv = -1
        for (const [lb, v] of cnt) if (v > bv || (v === bv && lb < best)) { best = lb; bv = v }
        if (best !== label.get(c)) { label.set(c, best); ch = true }
      }
      if (!ch) break
    }
    const tam = new Map()
    for (const c of idset) if (adj.get(c).size) tam.set(label.get(c), (tam.get(label.get(c)) || 0) + 1)
    const remap = new Map([...tam.entries()].sort((x, y) => y[1] - x[1]).map(([l], i) => [l, i]))
    const comDe = c => adj.get(c).size ? remap.get(label.get(c)) : -1
    const colorCom = g => g < 0 ? GRIS : PAL[g % PAL.length]

    // nodos y aristas
    const maxPeso = Math.max(...top.map(([, w]) => w))
    const nodos = [{ id: self, name: a.n, utm: true, centro: true, r: 16, com: -2 }]
    for (const [c, w] of top) nodos.push({
      id: c, name: nombreDe.get(c) || c, utm: !!utmDe.get(c), centro: false,
      r: 5 + 9 * Math.sqrt(w / maxPeso), com: comDe(c),
    })
    const idxDe = new Map(nodos.map((n, i) => [n.id, i]))
    const enlaces = []
    for (const [c, w] of top) enlaces.push({ s: 0, t: idxDe.get(c), w, centro: true })
    for (const [k, w] of pares) {
      const [u, v] = k.split('|')
      if (idxDe.has(u) && idxDe.has(v)) enlaces.push({ s: idxDe.get(u), t: idxDe.get(v), w, centro: false })
    }
    const vecinos = nodos.map(() => new Set())
    enlaces.forEach(e => { vecinos[e.s].add(e.t); vecinos[e.t].add(e.s) })

    // lienzo
    const dpr = window.devicePixelRatio || 1
    let W = 0, H = 0
    const ctx = canvas.getContext('2d')
    const medir = () => {
      W = wrap.clientWidth; H = wrap.clientHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
    }
    medir()
    const cx = () => W / 2, cy = () => H / 2
    nodos.forEach((n, i) => {
      if (n.centro) { n.x = cx(); n.y = cy() }
      else { const ang = 2 * Math.PI * i / nodos.length; n.x = cx() + Math.cos(ang) * Math.min(W, H) * 0.32; n.y = cy() + Math.sin(ang) * Math.min(W, H) * 0.32 }
      n.vx = 0; n.vy = 0
    })

    let alpha = 1, sobre = null, sel = null, grupoSel = null, arrastrando = null, paneando = false, raf = null, vivo = true
    const vista = { k: 1, x: 0, y: 0 }
    const cortar = s => s.length > 22 ? s.slice(0, 21) + '…' : s
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
    const paso = () => {
      for (let i = 0; i < nodos.length; i++)
        for (let j = i + 1; j < nodos.length; j++) {
          const A = nodos[i], B = nodos[j]
          let dx = A.x - B.x, dy = A.y - B.y, d2 = dx * dx + dy * dy + 0.01
          const d = Math.sqrt(d2), f = 900 / d2
          dx /= d; dy /= d
          A.vx += dx * f; A.vy += dy * f; B.vx -= dx * f; B.vy -= dy * f
        }
      for (const e of enlaces) {
        const A = nodos[e.s], B = nodos[e.t]
        let dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 0.01
        const L = e.centro ? (70 - Math.min(40, e.w * 4)) : 46
        const f = (d - L) * 0.015
        dx /= d; dy /= d
        A.vx += dx * f; A.vy += dy * f; B.vx -= dx * f; B.vy -= dy * f
      }
      for (const n of nodos) { n.vx += (cx() - n.x) * 0.003; n.vy += (cy() - n.y) * 0.003 }
      for (const n of nodos) {
        if (n === arrastrando) { n.vx = 0; n.vy = 0; continue }
        if (n.centro) { n.x = cx(); n.y = cy(); n.vx = 0; n.vy = 0; continue }
        n.vx *= 0.82; n.vy *= 0.82
        n.x += n.vx * alpha; n.y += n.vy * alpha
        n.x = Math.max(n.r, Math.min(W - n.r, n.x)); n.y = Math.max(n.r, Math.min(H - n.r, n.y))
      }
    }
    const atenuadoDe = i => {
      if (grupoSel != null) return !nodos[i].centro && nodos[i].com !== grupoSel
      const foco = sel != null ? sel : sobre
      return foco != null && i !== foco && !vecinos[foco].has(i)
    }
    const solapa = (a, b) => !(a[0] + a[2] < b[0] || b[0] + b[2] < a[0] || a[1] + a[3] < b[1] || b[1] + b[3] < a[1])
    const dibujar = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      // nodos y aristas en coordenadas del mundo (con zoom/desplazamiento)
      ctx.setTransform(dpr * vista.k, 0, 0, dpr * vista.k, dpr * vista.x, dpr * vista.y)
      ctx.lineCap = 'round'
      const foco = sel != null ? sel : sobre
      const enG = i => nodos[i].com === grupoSel
      for (const e of enlaces) {
        const act = grupoSel != null ? (enG(e.s) && enG(e.t))
          : (foco == null || e.s === foco || e.t === foco)
        ctx.strokeStyle = act ? (e.centro ? 'rgba(30,107,20,0.16)' : 'rgba(60,80,50,0.22)') : 'rgba(120,130,110,0.04)'
        ctx.lineWidth = Math.min(3, 0.5 + e.w * 0.6)
        const A = nodos[e.s], B = nodos[e.t]
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke()
      }
      for (let i = 0; i < nodos.length; i++) {
        const n = nodos[i]
        ctx.globalAlpha = atenuadoDe(i) ? 0.16 : 1
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 2 * Math.PI)
        ctx.fillStyle = n.centro ? '#17220f' : colorCom(n.com)
        ctx.fill()
        const seln = sel === i
        ctx.lineWidth = n.centro ? 2.5 : (seln ? 2.4 : 1.2)
        ctx.strokeStyle = (seln || n.centro) ? '#d4a80a' : '#fff'; ctx.stroke()
        ctx.globalAlpha = 1
      }
      // Etiquetas en coordenadas de pantalla (nítidas, con halo y sin solaparse).
      // Solo se escriben los nombres del grupo elegido en la leyenda, más el
      // nodo central y el coautor señalado con el cursor o seleccionado: con
      // todos a la vez la red resulta ilegible.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'
      const conNombre = (i) => {
        const n = nodos[i]
        if (n.centro || i === sobre || sel === i) return true
        return grupoSel != null && n.com === grupoSel
      }
      const rects = []
      for (const i of nodos.map((_, k) => k).filter(conNombre)) {
        if (atenuadoDe(i)) continue
        const n = nodos[i]
        const sx = n.x * vista.k + vista.x, sy = n.y * vista.k + vista.y - n.r * vista.k - 5
        if (sx < 0 || sx > W || sy < 8 || sy > H) continue
        const destacado = n.centro || i === sobre || sel === i
        ctx.font = (destacado ? '600 ' : '') + '11px Montserrat, sans-serif'
        const txt = cortar(n.name), w = ctx.measureText(txt).width
        const box = [sx - w / 2 - 2, sy - 11, w + 4, 13]
        if (!destacado && rects.some(r => solapa(r, box))) continue
        rects.push(box)
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.92)'
        ctx.strokeText(txt, sx, sy)
        ctx.fillStyle = '#17220f'; ctx.fillText(txt, sx, sy)
      }
    }
    const bucle = () => {
      if (!vivo) return
      paso(); dibujar()
      alpha *= 0.994
      raf = (alpha > 0.03 || arrastrando) ? requestAnimationFrame(bucle) : null
    }
    bucle()
    const recalienta = () => { alpha = Math.max(alpha, 0.5); if (!raf && vivo) bucle() }
    const pinta = () => { if (!raf) dibujar() }

    // zoom / desplazamiento
    const zoomA = (factor, sx, sy) => {
      const nk = clamp(vista.k * factor, 0.3, 6), real = nk / vista.k
      vista.x = sx - real * (sx - vista.x); vista.y = sy - real * (sy - vista.y); vista.k = nk
      pinta()
    }
    const scr = ev => { const r = canvas.getBoundingClientRect(); const t = ev.touches ? ev.touches[0] : ev; return [t.clientX - r.left, t.clientY - r.top] }
    const aMundo = (sx, sy) => [(sx - vista.x) / vista.k, (sy - vista.y) / vista.k]
    const buscar = (sx, sy) => { const [x, y] = aMundo(sx, sy); for (let i = nodos.length - 1; i >= 0; i--) { const n = nodos[i]; if ((n.x - x) ** 2 + (n.y - y) ** 2 <= (n.r + 4) ** 2) return i } return null }

    // panel de publicaciones en común con el autor central
    const comSel = document.getElementById('comSel')
    const compartidas = c => pubs.filter(p => [...(p.u || []), ...(p.xa || [])].some(x => String(x) === String(c)))
    const mostrarSel = i => {
      grupoSel = null; pintarLeyenda()
      if (i == null || nodos[i].centro) { sel = null; if (comSel) comSel.style.display = 'none'; pinta(); return }
      sel = i
      const n = nodos[i]
      const comp = compartidas(n.id).sort((x, y) => (y.y || 0) - (x.y || 0) || (y.c || 0) - (x.c || 0))
      if (comSel) {
        const perfil = n.utm ? ` · <a href="#/autor/${encodeURIComponent(n.id)}">Ver perfil →</a>` : ''
        comSel.innerHTML = `<div class="com-sel-cab"><div><strong>${esc(n.name)}</strong>
            <span>${comp.length} ${comp.length === 1 ? 'publicación' : 'publicaciones'} en común con ${esc(a.n)}${perfil}</span></div>
            <button type="button" class="com-sel-x" title="Cerrar">✕</button></div>
          <div class="com-sel-lista">${comp.map(p => {
          const t = p.doi ? `<a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noreferrer">${esc(p.t)}</a>` : esc(p.t)
          const ret = p.r ? ` · <span class="retirada" title="La revista o fuente fue retirada de Scopus (discontinued source).">⚑ Revista retirada de Scopus</span>` : ''
          return `<div class="com-pub"><div class="com-pt">${t}</div><div class="com-pm">${p.y || '—'} · ${esc(p.j || '—')} · ${badgeQ(p.q)} · ${num(p.c)} citas${ret}</div></div>`
        }).join('')}</div>`
        comSel.style.display = 'block'
        comSel.querySelector('.com-sel-x').addEventListener('click', () => mostrarSel(null))
      }
      pinta()
    }

    // interacción con puntero: clic en nodo selecciona, arrastre mueve, vacío desplaza
    let movido = 0, ini = null
    const abajo = ev => {
      const [sx, sy] = scr(ev); ini = { sx, sy, vx: vista.x, vy: vista.y }; movido = 0
      const i = buscar(sx, sy)
      if (i != null) { arrastrando = nodos[i]; recalienta() } else paneando = true
    }
    const mueve = ev => {
      const [sx, sy] = scr(ev)
      if (ini) movido += Math.abs(sx - ini.sx) + Math.abs(sy - ini.sy)
      if (arrastrando) {
        const [x, y] = aMundo(sx, sy); arrastrando.x = x; arrastrando.y = y; arrastrando.vx = 0; arrastrando.vy = 0
        recalienta(); if (ev.cancelable) ev.preventDefault()
      } else if (paneando) {
        vista.x = ini.vx + (sx - ini.sx); vista.y = ini.vy + (sy - ini.sy); pinta(); if (ev.cancelable) ev.preventDefault()
      } else {
        const i = buscar(sx, sy); if (i !== sobre) { sobre = i; pinta() }
        canvas.style.cursor = i != null ? 'pointer' : 'grab'
      }
    }
    const arriba = () => {
      if (arrastrando && movido < 5) mostrarSel(nodos.indexOf(arrastrando))
      else if (paneando && movido < 5) mostrarSel(null)
      arrastrando = null; paneando = false; ini = null
    }
    const salir = () => { if (sobre != null) { sobre = null; pinta() } }
    canvas.addEventListener('mousedown', abajo)
    canvas.addEventListener('mousemove', mueve)
    window.addEventListener('mouseup', arriba)
    canvas.addEventListener('mouseleave', salir)
    canvas.addEventListener('wheel', ev => { ev.preventDefault(); const [sx, sy] = scr(ev); zoomA(ev.deltaY < 0 ? 1.15 : 1 / 1.15, sx, sy) }, { passive: false })

    // táctil: un dedo arrastra/selecciona, dos dedos hacen zoom (pellizco)
    const dist2 = ev => Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY)
    let pinchD = 0
    canvas.addEventListener('touchstart', ev => { if (ev.touches.length === 2) { pinchD = dist2(ev); arrastrando = null; paneando = false } else abajo(ev) }, { passive: true })
    canvas.addEventListener('touchmove', ev => {
      if (ev.touches.length === 2) {
        const d = dist2(ev)
        if (pinchD) { const r = canvas.getBoundingClientRect(); const mx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2 - r.left, my = (ev.touches[0].clientY + ev.touches[1].clientY) / 2 - r.top; zoomA(d / pinchD, mx, my) }
        pinchD = d; if (ev.cancelable) ev.preventDefault()
      } else mueve(ev)
    }, { passive: false })
    canvas.addEventListener('touchend', () => { pinchD = 0; arriba() })

    const bIn = document.getElementById('comIn'), bOut = document.getElementById('comOut'), bReset = document.getElementById('comReset')
    if (bIn) bIn.addEventListener('click', () => zoomA(1.3, W / 2, H / 2))
    if (bOut) bOut.addEventListener('click', () => zoomA(1 / 1.3, W / 2, H / 2))
    if (bReset) bReset.addEventListener('click', () => { vista.k = 1; vista.x = 0; vista.y = 0; pinta() })
    let rt
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { medir(); recalienta() }, 200) }
    window.addEventListener('resize', onResize)

    // leyenda interactiva: clic en un grupo lo enfoca en la red (atenúa el resto)
    const focoGrupo = g => {
      grupoSel = (grupoSel === g ? null : g)
      if (grupoSel != null) { sel = null; if (comSel) comSel.style.display = 'none' }
      pintarLeyenda(); pinta()
    }
    function pintarLeyenda() {
      if (!leyenda) return
      const grupos = [...new Set(nodos.filter(n => !n.centro && n.com >= 0).map(n => n.com))].sort((x, y) => x - y)
      const haySinGrupo = nodos.some(n => n.com === -1)
      leyenda.style.display = (grupos.length || haySinGrupo) ? 'flex' : 'none'
      leyenda.innerHTML = grupos.map(g => {
        const n = nodos.filter(x => x.com === g).length
        return `<span class="com-lg${grupoSel === g ? ' on' : ''}" data-g="${g}" title="Comunidad de coautores que publican sobre todo entre sí (${n} ${n === 1 ? 'coautor' : 'coautores'}). Clic para enfocarla en la red."><i style="background:${colorCom(g)}"></i>Grupo ${g + 1}</span>`
      }).join('')
        + (haySinGrupo ? (() => {
          const n = nodos.filter(x => x.com === -1).length
          return `<span class="com-lg${grupoSel === -1 ? ' on' : ''}" data-g="-1" title="Coautores sin publicaciones en común con otros coautores de la red (${n} ${n === 1 ? 'coautor' : 'coautores'}); solo colaboran con el autor central. Clic para resaltarlos."><i style="background:${GRIS}"></i>Sin grupo</span>`
        })() : '')
      leyenda.querySelectorAll('[data-g]').forEach(el => el.addEventListener('click', () => focoGrupo(+el.dataset.g)))
    }
    pintarLeyenda()

    comStop = () => {
      vivo = false; if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('mouseup', arriba)
      window.removeEventListener('resize', onResize)
    }
  }

  // paginador genérico (sin selector de cantidad)
  function paginar(contId, pagerId, lista, rowFn, porPag) {
    let pagina = 1
    const cont = document.getElementById(contId)
    const pager = document.getElementById(pagerId)
    if (!cont) return
    function pinta() {
      const paginas = Math.max(1, Math.ceil(lista.length / porPag))
      if (pagina > paginas) pagina = paginas
      const ini = (pagina - 1) * porPag
      cont.innerHTML = lista.slice(ini, ini + porPag).map(rowFn).join('')
      if (pager) {
        pager.innerHTML = paginacionHTML(pagina, paginas)
        pager.querySelectorAll('button[data-p]').forEach(b => b.addEventListener('click', () => {
          pagina = +b.dataset.p; pinta(); cont.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }))
      }
    }
    pinta()
  }

  // lista contextual de publicaciones al hacer clic en un gráfico
  function ctxRow(p) {
    const t = p.doi ? `<a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noreferrer">${esc(p.t)}</a>` : esc(p.t)
    const retirada = p.r
      ? ` · <span class="retirada" title="La revista o fuente fue retirada de Scopus (discontinued source).">⚑ Revista retirada de Scopus</span>`
      : ''
    return `<div class="ctx-row"><div class="ctx-t">${t}</div>
      <div class="ctx-m">${p.y || ''} · ${esc(p.j || '—')} · ${badgeQ(p.q)} · ${num(p.c)} citas${retirada}</div></div>`
  }
  // popover flotante contextual (junto al cursor)
  let popEl = null
  const fueraPop = e => { if (popEl && !popEl.contains(e.target)) cerrarPop() }
  const escPop = e => { if (e.key === 'Escape') cerrarPop() }
  function cerrarPop() {
    if (!popEl) return
    popEl.remove(); popEl = null
    document.removeEventListener('mousedown', fueraPop, true)
    document.removeEventListener('keydown', escPop)
  }
  // Nombre de país (en inglés, como lo da Scopus) a código ISO-2, para la bandera.
  const PAIS_ISO = {
    'Algeria': 'DZ', 'Argentina': 'AR', 'Australia': 'AU', 'Austria': 'AT', 'Belgium': 'BE',
    'Bolivia': 'BO', 'Brazil': 'BR', 'Canada': 'CA', 'Chile': 'CL', 'China': 'CN',
    'Colombia': 'CO', 'Costa Rica': 'CR', "Cote d'Ivoire": 'CI', 'Cuba': 'CU', 'Czech Republic': 'CZ',
    'Denmark': 'DK', 'Dominican Republic': 'DO', 'Ecuador': 'EC', 'Egypt': 'EG', 'El Salvador': 'SV',
    'Finland': 'FI', 'France': 'FR', 'Germany': 'DE', 'Gibraltar': 'GI', 'Greece': 'GR',
    'Guatemala': 'GT', 'Honduras': 'HN', 'Hong Kong': 'HK', 'Hungary': 'HU', 'India': 'IN',
    'Indonesia': 'ID', 'Iran': 'IR', 'Iraq': 'IQ', 'Italy': 'IT', 'Japan': 'JP',
    'Malaysia': 'MY', 'Martinique': 'MQ', 'Mexico': 'MX', 'Morocco': 'MA', 'Mozambique': 'MZ',
    'Netherlands': 'NL', 'New Zealand': 'NZ', 'Nicaragua': 'NI', 'Nigeria': 'NG', 'Norway': 'NO',
    'Oman': 'OM', 'Pakistan': 'PK', 'Panama': 'PA', 'Paraguay': 'PY', 'Peru': 'PE',
    'Philippines': 'PH', 'Poland': 'PL', 'Portugal': 'PT', 'Puerto Rico': 'PR', 'Romania': 'RO',
    'Russian Federation': 'RU', 'Rwanda': 'RW', 'Saudi Arabia': 'SA', 'Singapore': 'SG', 'Slovenia': 'SI',
    'South Africa': 'ZA', 'South Korea': 'KR', 'Spain': 'ES', 'Sweden': 'SE', 'Switzerland': 'CH',
    'Trinidad and Tobago': 'TT', 'Tunisia': 'TN', 'United Arab Emirates': 'AE', 'United Kingdom': 'GB',
    'United States': 'US', 'Uruguay': 'UY', 'Venezuela': 'VE', 'Viet Nam': 'VN',
    // alias frecuentes por si cambia la grafía
    'USA': 'US', 'UK': 'GB', 'Russia': 'RU', 'Vietnam': 'VN', 'South Korea, Republic of': 'KR',
  }
  function banderaPais(pais) {
    const cc = PAIS_ISO[pais]
    if (!cc) return ''
    return cc.replace(/./g, (c) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
  }

  // Fila de autor para la pestaña "Autores" del menú contextual (países). El
  // nombre usa el mismo tamaño y color que el título de la publicación (.ctx-t).
  // Los autores internacionales no tienen perfil UTM, así que no llevan enlace;
  // se muestra la bandera de su país cuando se conoce.
  function ctxAutorRow(a) {
    const bandera = a.externo && a.pais
      ? `<span title="${esc(a.pais)}" style="margin-right:7px;flex-shrink:0">${banderaPais(a.pais)}</span>`
      : ''
    const nombre = a.externo
      ? `<span class="ctx-t" style="min-width:0">${bandera}${esc(a.nombre)}</span>`
      : `<a class="ctx-t" href="#/autor/${encodeURIComponent(a.id)}">${esc(a.nombre)}</a>`
    return `<div class="ctx-row" style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
      ${nombre}
      <span class="ctx-m" style="white-space:nowrap">${a.n} pub.</span></div>`
  }
  function mostrarPopover(ev, titulo, lista, color, autores) {
    cerrarPop()
    color = color || '#2e8a1f'
    const orden = [...lista].sort((a, b) => {
      const ka = a.d || ((a.y || 0) + '-00-00'), kb = b.d || ((b.y || 0) + '-00-00')
      return ka < kb ? 1 : ka > kb ? -1 : 0
    })
    const cap = 10, vis = orden.slice(0, cap)
    const pubsBody = vis.length ? vis.map(ctxRow).join('') : '<div class="ctx-m">Sin publicaciones.</div>'
    popEl = document.createElement('div')
    popEl.className = 'popover-ctx'
    const conAutores = autores && autores.length
    if (conAutores) {
      // Dos pestañas: publicaciones y autores que colaboran con ese país.
      const capA = 15, visA = autores.slice(0, capA)
      const autBody = visA.map(ctxAutorRow).join('')
      popEl.innerHTML = `<div class="pop-cab">
        <span><i class="pop-punto"></i>${esc(titulo)}</span>
        <button class="pop-x" title="Cerrar">✕</button></div>
        <div class="top-tabs" style="margin:8px 0 10px 10px">
          <button class="top-tab pop-tab on" data-pt="pubs">Publicaciones (${lista.length})</button>
          <button class="top-tab pop-tab" data-pt="aut">Autores (${autores.length})</button>
        </div>
        <div class="pop-body pop-pane" data-pt="pubs">${pubsBody}</div>
        <div class="pop-body pop-pane" data-pt="aut" style="display:none">${autBody || '<div class="ctx-m">Sin autores.</div>'}</div>`
    } else {
      popEl.innerHTML = `<div class="pop-cab">
        <span><i class="pop-punto"></i>${esc(titulo)} · ${lista.length} publicaci${lista.length !== 1 ? 'ones' : 'ón'}${lista.length > cap ? ` · últimas ${cap}` : ''}</span>
        <button class="pop-x" title="Cerrar">✕</button></div>
        <div class="pop-body">${pubsBody}</div>`
    }
    document.body.appendChild(popEl)
    if (conAutores) {
      const tabs = [...popEl.querySelectorAll('.pop-tab')]
      const panes = [...popEl.querySelectorAll('.pop-pane')]
      tabs.forEach(t => t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.toggle('on', x === t))
        panes.forEach(p => { p.style.display = p.dataset.pt === t.dataset.pt ? '' : 'none' })
      }))
    }
    const w = popEl.offsetWidth, h = popEl.offsetHeight
    let x = ev.clientX + 12, y = ev.clientY + 12
    if (x + w > window.innerWidth - 8) x = Math.max(8, window.innerWidth - w - 8)
    if (y + h > window.innerHeight - 8) y = Math.max(8, ev.clientY - h - 12)
    popEl.style.left = x + 'px'; popEl.style.top = y + 'px'
    popEl.querySelector('.pop-x').addEventListener('click', cerrarPop)
    setTimeout(() => document.addEventListener('mousedown', fueraPop, true), 0)
    document.addEventListener('keydown', escPop)
  }

  // panel de publicaciones con paginación (10 por defecto) y orden opcional
  function panelPubsHTML(titulo, n, conOrden) {
    return `<div class="panel"><h3 class="h3-flex">
      <span>${esc(titulo)} (${num(n)})</span>
      <span class="pp-ctrl">
        ${conOrden ? `Ordenar
        <select class="selector" id="pubOrden">
          <option value="recientes">Más recientes</option>
          <option value="citadas">Más citadas</option>
        </select> · ` : ''}Ítems por página
        <select class="selector" id="pp">
          <option value="10">10</option><option value="25">25</option>
          <option value="50">50</option><option value="0">Todas</option>
        </select></span></h3>
      <div class="pubs" id="pubcont"></div>
      <div class="paginacion" id="pubpager"></div></div>`
  }
  function wirePubs(lista, rowFn) {
    let pagina = 1, porPag = 10, orden = 'recientes'
    const cont = document.getElementById('pubcont')
    const pager = document.getElementById('pubpager')
    const sel = document.getElementById('pp')
    const selO = document.getElementById('pubOrden')
    let ordenada = lista
    function ordenar() {
      ordenada = [...lista].sort((a, b) => orden === 'citadas'
        ? (b.c || 0) - (a.c || 0) || (b.y || 0) - (a.y || 0)
        : (b.y || 0) - (a.y || 0) || (b.c || 0) - (a.c || 0))
    }
    ordenar()
    function pinta() {
      const total = ordenada.length
      const pp = porPag === 0 ? (total || 1) : porPag
      const paginas = Math.max(1, Math.ceil(total / pp))
      if (pagina > paginas) pagina = paginas
      const ini = (pagina - 1) * pp
      const vis = porPag === 0 ? ordenada : ordenada.slice(ini, ini + pp)
      cont.innerHTML = vis.length ? vis.map(rowFn).join('') : '<div class="vacio">Sin publicaciones.</div>'
      pager.innerHTML = paginacionHTML(pagina, paginas)
      pager.querySelectorAll('button[data-p]').forEach(b => b.addEventListener('click', () => {
        pagina = +b.dataset.p; pinta()
        cont.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }))
    }
    if (sel) sel.addEventListener('change', () => { porPag = +sel.value; pagina = 1; pinta() })
    if (selO) selO.addEventListener('change', () => { orden = selO.value; ordenar(); pagina = 1; pinta() })
    pinta()
  }

  function kpi(v, e, x, ayuda) {
    const attr = ayuda ? ` title="${esc(ayuda)}" style="cursor:help"` : ''
    return `<div class="kpi"${attr}><div class="v">${v}</div><div class="e">${esc(e)}</div>${x ? `<div class="x">${esc(x)}</div>` : ''}</div>`
  }
  // Explicación de cada cuartil SJR, para el tooltip de las pastillas.
  const TIP_Q = {
    Q1: 'Cuartil 1 (SJR): la revista está en el 25% superior de su área.',
    Q2: 'Cuartil 2 (SJR): la revista está en el segundo 25% de su área.',
    Q3: 'Cuartil 3 (SJR): la revista está en el tercer 25% de su área.',
    Q4: 'Cuartil 4 (SJR): la revista está en el 25% inferior de su área.',
    'N/A': 'No aplica: el documento no es de revista (libro, capítulo o ponencia), así que el cuartil SJR no corresponde.',
    NC: 'No clasificada: es una revista sin cuartil disponible en el ranking SJR de SCImago.',
  }
  const tipCuartil = (q) => TIP_Q[q] || TIP_Q['N/A']
  function badgeQ(q) {
    const c = COLQ[q] || '#999'
    return `<span class="insig-q" style="background:${c}1e;color:${c};cursor:help" title="${esc(tipCuartil(q))}">${esc(q)}</span>`
  }
  // Nota compacta para autores sin filiación UTM actual (directorio y top 10).
  function notaExUtm(a) {
    return a && a.xu
      ? `<div class="ex-utm-mini" title="Conserva su producción con filiación UTM, pero su afiliación actual en Scopus ya no es la UTM.">⚑ Sin afiliación vigente con la Universidad Técnica de Manabí.</div>`
      : ''
  }
  // Autores de la publicación: los primeros por orden de firma y, cuando hay
  // muchos, también el último. El total va al final.
  function autoresLinea(p) {
    const prim = p.au || []
    if (!prim.length) return ''
    const total = p.nc || prim.length
    let txt
    if (p.uf && total > prim.length) {
      const ocultos = total - prim.length - 1
      txt = esc(prim.join('; ')) + (ocultos > 0 ? ` … +${ocultos} … ` : '; ') + esc(p.uf) + ` · ${total} autores`
    } else {
      txt = esc(prim.join('; ')) + (total > prim.length ? ` … (+${total - prim.length} más)` : '')
    }
    return `<div class="m aut-pub">${txt}</div>`
  }
  function pubRow(p, dest) {
    const abierto = p.oa && p.oa !== 'Closed' && p.oa !== 'Unknown'
    const t = p.doi
      ? `<a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noreferrer">${esc(p.t)}</a>`
      : esc(p.t)
    return `<div class="pub"><div class="anio"><b>${p.y || '—'}</b></div>
      <div class="cuerpo"><div class="t">${t}${dest ? ' <span class="mas-citada">★ Más citada</span>' : ''}</div>
      <div class="m">${esc(p.j || '—')} · ${badgeQ(p.q)} · ${num(p.c)} citas${abierto ? ' · <span class="oa-tag">Acceso abierto</span>' : ''}${p.r ? ' · <span class="retirada" title="La revista o fuente fue retirada de Scopus (discontinued source).">⚑ Revista retirada de Scopus</span>' : ''}</div>${autoresLinea(p)}</div></div>`
  }

  // ---------- coautoría externa, temas y exportaciones del perfil ----------
  const paisChip = ([p, c]) => `<span class="ce-chip" data-cat="pais" data-val="${esc(p)}" style="cursor:pointer" title="Ver publicaciones con ${esc(p)}">${esc(p)}<b>${c}</b></span>`
  const instRow = ([n, c]) => {
    const pais = (D.instPais || {})[n]
    const bandera = pais ? `<span title="${esc(pais)}" style="margin-right:6px">${banderaPais(pais)}</span>` : ''
    return `<div class="ce-inst" data-cat="inst" data-val="${esc(n)}" style="cursor:pointer" title="Ver publicaciones con esta institución (${esc(pais || 'país no registrado')})"><span>${bandera}${esc(n)}</span><b>${c}</b></div>`
  }
  const coautExtRow = ([id, nombre, c]) => {
    const pais = (D.extPais || {})[id]
    const bandera = pais ? `<span title="${esc(pais)}" style="margin-right:6px;flex-shrink:0">${banderaPais(pais)}</span>` : ''
    return `<div class="ce-inst" data-cat="coautorExt" data-val="${esc(id)}" style="cursor:pointer" title="Ver publicaciones en común con ${esc(nombre)}"><span>${bandera}${esc(nombre)}</span><b>${c}</b></div>`
  }
  function coautoriaExterna(a) {
    const cx = a.cx || [], px = a.px || [], ix = a.ix || []
    if (!cx.length && !px.length && !ix.length)
      return '<div style="color:var(--texto3);font-size:13px">Sin coautoría externa registrada.</div>'
    // Coautores externos, instituciones y países como pestañas, con el mismo
    // diseño del Top 10 de la portada (top-tabs / top-tab). Solo se muestra la
    // pestaña de la categoría que tiene datos.
    const tabs = [], panes = []
    if (cx.length) {
      tabs.push(`<button class="top-tab ce-tab" data-ce="coaut">Coautores externos (${cx.length})</button>`)
      panes.push(`<div class="ce-pane" data-ce="coaut"><div id="ceCoautCont"></div><div class="paginacion" id="ceCoautPager"></div></div>`)
    }
    if (ix.length) {
      tabs.push(`<button class="top-tab ce-tab" data-ce="inst">Filiaciones (${ix.length})</button>`)
      panes.push(`<div class="ce-pane" data-ce="inst"><div id="ceInstCont"></div><div class="paginacion" id="ceInstPager"></div></div>`)
    }
    if (px.length) {
      tabs.push(`<button class="top-tab ce-tab" data-ce="pais">Países (${px.length})</button>`)
      panes.push(`<div class="ce-pane" data-ce="pais"><div class="ce-chips">${px.map(paisChip).join('')}</div></div>`)
    }
    return tabs.length
      ? `<div class="top-tabs" style="margin-bottom:12px">${tabs.join('')}</div>${panes.join('')}` : ''
  }
  // Conmuta las pestañas de Colaboración externa: misma lógica visual del Top 10.
  function wireCoautExtTabs() {
    const tabs = [...document.querySelectorAll('.ce-tab')]
    const panes = [...document.querySelectorAll('.ce-pane')]
    if (!tabs.length) return
    const activar = key => {
      tabs.forEach(t => t.classList.toggle('on', t.dataset.ce === key))
      panes.forEach(p => { p.style.display = p.dataset.ce === key ? '' : 'none' })
    }
    tabs.forEach(t => t.addEventListener('click', () => activar(t.dataset.ce)))
    activar(tabs[0].dataset.ce)
  }
  // Normaliza un texto a minúsculas sin acentos, para comparar frases con títulos.
  const normFrase = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  // Palabras significativas de un título (sin stopwords ni palabras cortas). Es la
  // MISMA tokenización que arma las frases, para que el conteo y el filtro del clic
  // coincidan aunque en el título haya palabras intermedias (ej. "Latent Dirichlet
  // Allocation, and HJ-Biplot" produce el bigrama "allocation biplot").
  const tokensFrase = (t) => normFrase(t).split(/[^a-z0-9ñ]+/).filter(w => w.length >= 4 && !STOP.has(w))
  // ¿El título contiene la frase, según esa tokenización? Bigrama = dos tokens
  // seguidos; unigrama = el token presente.
  function coincideFrase(titulo, frase) {
    const fw = frase.split(' '), ws = tokensFrase(titulo)
    if (fw.length === 1) return ws.includes(fw[0])
    for (let i = 0; i < ws.length - 1; i++) if (ws[i] === fw[0] && ws[i + 1] === fw[1]) return true
    return false
  }
  // Frases frecuentes de los títulos: bigramas (dos palabras seguidas) que se
  // repiten, más unigramas fuertes si hacen falta. Dan contexto que la palabra
  // suelta pierde ("machine learning" en vez de "machine" y "learning"). El conteo
  // es por publicación (no por ocurrencia), para que cuadre con el menú del clic.
  function frasesTitulos(pubs) {
    const big = new Map(), uni = new Map()
    pubs.forEach(p => {
      const ws = tokensFrase(p.t)
      const bigVistos = new Set()
      for (let i = 0; i < ws.length - 1; i++) {
        const b = ws[i] + ' ' + ws[i + 1]
        if (!bigVistos.has(b)) { bigVistos.add(b); big.set(b, (big.get(b) || 0) + 1) }
      }
      new Set(ws).forEach(w => uni.set(w, (uni.get(w) || 0) + 1))
    })
    const bigs = [...big.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 16)
    // Palabras ya cubiertas por un bigrama, para no repetirlas como unigrama.
    const enBig = new Set(); bigs.forEach(([b]) => b.split(' ').forEach(w => enBig.add(w)))
    // Solo se complementa con unigramas cuando hay pocos bigramas (autores con
    // poca producción), exigiendo mayor frecuencia para que valgan la pena.
    const faltan = Math.max(0, 8 - bigs.length)
    const unis = faltan
      ? [...uni.entries()].filter(([w, c]) => c >= 3 && !enBig.has(w)).sort((a, b) => b[1] - a[1]).slice(0, faltan)
      : []
    return [...bigs, ...unis].sort((a, b) => b[1] - a[1]).slice(0, 18)
  }
  function frasesHTML(frases) {
    if (!frases.length) return ''
    return '<div class="frases">' + frases.map(([f, c]) =>
      `<span class="frase-chip" data-cat="frase" data-val="${esc(f)}" style="cursor:pointer" title="Ver las publicaciones cuyo título menciona “${esc(f)}”">${esc(f)}<b>${c}</b></span>`).join('') + '</div>'
  }
  // Áreas Scopus como barras ordenadas con su conteo, clicables.
  function areasBarras(areas) {
    if (!areas.length) return '<div style="color:var(--texto3);font-size:13px">Sin áreas registradas.</div>'
    const max = areas[0][1] || 1
    return '<div class="areas-barras">' + areas.map(([n, c]) =>
      `<div class="area-fila" data-cat="area" data-val="${esc(n)}" style="cursor:pointer" title="Ver las publicaciones de ${esc(n)}">
        <span class="area-n">${esc(n)}</span>
        <span class="area-bar"><span style="width:${Math.max(6, Math.round(100 * c / max))}%"></span></span>
        <b class="area-c">${c}</b></div>`).join('') + '</div>'
  }

  function regresion(vals) {
    const n = vals.length
    const media = vals.reduce((s, v) => s + v, 0) / n
    if (n < 2) return { m: 0, b: media }
    const xm = (n - 1) / 2
    let numr = 0, den = 0
    for (let i = 0; i < n; i++) { numr += (i - xm) * (vals[i] - media); den += (i - xm) ** 2 }
    const m = den ? numr / den : 0
    return { m, b: media - m * xm }
  }

  function barsAnio(porAnio, H = 150) {
    const years = Object.keys(porAnio).map(Number).sort((a, b) => a - b)
    if (!years.length) return '<div style="color:var(--texto3)">Sin datos.</div>'
    const vals = years.map(y => porAnio[y])
    const max = Math.max(...vals)
    const n = years.length, W = Math.max(280, n * 36), base = H - 24, top = 14
    const paso = W / n, bw = Math.min(22, paso - 9)
    const yFor = v => base - (Math.max(0, v) / max) * (base - top)
    let s = `<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="#e6e9e1"/>`
    years.forEach((y, i) => {
      const x = i * paso + (paso - bw) / 2
      const yb = yFor(porAnio[y])
      s += `<rect x="${x}" y="${yb}" width="${bw}" height="${Math.max(1, base - yb)}" rx="4" fill="#2e8a1f"/>
        <text x="${x + bw / 2}" y="${yb - 4}" font-size="9.5" text-anchor="middle" fill="#6b7563">${porAnio[y]}</text>
        <text x="${x + bw / 2}" y="${base + 13}" font-size="9.5" text-anchor="middle" fill="#98a18d">${y}</text>`
    })
    // línea de tendencia (regresión lineal)
    if (n >= 2) {
      const { m, b } = regresion(vals)
      const pts = years.map((y, i) => `${(i * paso + paso / 2).toFixed(1)},${yFor(b + m * i).toFixed(1)}`).join(' ')
      s += `<polyline points="${pts}" fill="none" stroke="#e0902d" stroke-width="2" stroke-dasharray="5 3"/>`
      years.forEach((y, i) => { s += `<circle cx="${(i * paso + paso / 2).toFixed(1)}" cy="${yFor(b + m * i).toFixed(1)}" r="2.4" fill="#e0902d"/>` })
    }
    // zonas clicables (una por columna), encima de todo
    years.forEach((y, i) => {
      s += `<rect x="${(i * paso).toFixed(1)}" y="0" width="${paso.toFixed(1)}" height="${base}" fill="transparent" data-cat="anio" data-val="${y}" style="cursor:pointer"><title>Ver publicaciones de ${y}</title></rect>`
    })
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H + 10}px">${s}</svg>`
  }

  function infoAnios(porAnio) {
    const years = Object.keys(porAnio).map(Number).sort((a, b) => a - b)
    if (!years.length) return ''
    const vals = years.map(y => porAnio[y])
    const total = vals.reduce((s, v) => s + v, 0)
    const prom = (total / years.length).toFixed(1)
    let pico = years[0]
    years.forEach(y => { if (porAnio[y] > porAnio[pico]) pico = y })
    const { m } = regresion(vals)
    const tend = m > 0.15 ? 'creciente' : m < -0.15 ? 'decreciente' : 'estable'
    const flecha = m > 0.15 ? '↗' : m < -0.15 ? '↘' : '→'
    const span = years[years.length - 1] - years[0] + 1
    return `<div class="info-anios">
      <span>Promedio <b>${prom}</b> pub./año</span>
      <span>Año más productivo <b>${pico}</b> (${porAnio[pico]})</span>
      <span>Trayectoria <b>${span} año${span !== 1 ? 's' : ''}</b></span>
      <span>Tendencia <b style="color:#c07a12">${flecha} ${tend}</b> <em>(línea naranja)</em></span>
    </div>`
  }

  function donut(cq) {
    const orden = ['Q1', 'Q2', 'Q3', 'Q4', 'N/A', 'NC']
    const pres = orden.filter(q => cq[q])
    if (!pres.length) return '<div style="color:var(--texto3)">Sin datos.</div>'
    const total = pres.reduce((s, q) => s + cq[q], 0) || 1
    const R = 50, C = 2 * Math.PI * R, cx = 64, cy = 64, sw = 20
    // Texto emergente: número de documentos y su equivalencia en porcentaje.
    const pctDe = (v) => Math.round((1000 * v) / total) / 10
    const rotulo = (q) => `${q}: ${num(cq[q])} ${cq[q] === 1 ? 'documento' : 'documentos'} (${pctDe(cq[q])}%)`
    let off = 0, segs = ''
    pres.forEach(q => {
      const len = (cq[q] / total) * C
      segs += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${COLQ[q]}" stroke-width="${sw}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})" data-cat="cuartil" data-val="${q}" style="cursor:pointer"><title>${esc(rotulo(q))} · ${esc(tipCuartil(q))} · clic para ver las publicaciones</title></circle>`
      off += len
    })
    const leg = pres.map(q => `<span data-cat="cuartil" data-val="${q}" style="cursor:pointer" title="${esc(rotulo(q))} · ${esc(tipCuartil(q))} · clic para ver las publicaciones"><i style="background:${COLQ[q]}"></i>${q}<b>${cq[q]}</b><em>(${pctDe(cq[q])}%)</em></span>`).join('')
    return `<div class="donut-fila"><svg width="128" height="128" viewBox="0 0 128 128">${segs}
      <text x="64" y="61" text-anchor="middle" font-size="21" font-weight="700" fill="#185a10" font-family="Montserrat,sans-serif">${total}</text>
      <text x="64" y="79" text-anchor="middle" font-size="8.5" letter-spacing="1" fill="#98a18d">DOCS</text></svg>
      <div class="leyenda">${leg}</div></div>`
  }

  function tiposBarras(ct) {
    const arr = Object.entries(ct).sort((a, b) => b[1] - a[1])
    if (!arr.length) return ''
    const max = arr[0][1]
    const total = arr.reduce((s, [, c]) => s + c, 0) || 1
    return `<div class="tipos-barras">${arr.map(([n, c]) => {
      const pct = Math.round((1000 * c) / total) / 10
      return `<div class="tipo-fila" data-cat="tipo" data-val="${esc(n)}" style="cursor:pointer" title="${esc(n)}: ${num(c)} ${c === 1 ? 'documento' : 'documentos'} (${pct}%) · clic para ver las publicaciones">
        <span class="tn">${esc(n)}</span>
        <span class="tb"><div style="width:${Math.max(3, Math.round(100 * c / max))}%"></div></span>
        <span class="tv">${c} <em>(${pct}%)</em></span></div>`
    }).join('')}</div>`
  }

  // ---------- área temática ----------
  function pubRowArea(p) {
    const au = (p.u || []).map(u => porId.get(u)).filter(Boolean)
    const aut = au.length
      ? ' · ' + au.slice(0, 3).map(x => `<a href="#/autor/${encodeURIComponent(x.id)}">${esc(x.n)}</a>`).join(', ') +
        (au.length > 3 ? ' y ' + (au.length - 3) + ' más' : '')
      : ''
    const abierto = p.oa && p.oa !== 'Closed' && p.oa !== 'Unknown'
    const t = p.doi ? `<a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noreferrer">${esc(p.t)}</a>` : esc(p.t)
    return `<div class="pub"><div class="anio"><b>${p.y || '—'}</b></div><div class="cuerpo"><div class="t">${t}</div>
      <div class="m">${esc(p.j || '—')} · ${badgeQ(p.q)} · ${num(p.c)} citas${abierto ? ' · <span class="oa-tag">Acceso abierto</span>' : ''}${p.r ? ' · <span class="retirada" title="La revista o fuente fue retirada de Scopus (discontinued source).">⚑ Revista retirada de Scopus</span>' : ''}${aut}</div></div></div>`
  }

  function renderArea(area) {
    perfilPubs = null
    const lista = D.pubs.filter(p => (p.a || []).includes(area))
      .sort((x, y) => (y.y || 0) - (x.y || 0) || (y.c - x.c))
    app.innerHTML = `<div class="wrap">
      <a class="volver" href="#/">← Volver a la página principal</a>
      <div class="perfil-hero" style="border-left-color:var(--g3)">
        <div style="flex:1"><h2>${esc(area)}</h2>
          <div class="sub">Área temática · ${num(lista.length)} publicaciones UTM</div></div></div>
      ${panelPubsHTML('Publicaciones', lista.length)}</div>
    ${TOP_PAGE_HTML}`
    wirePubs(lista, pubRowArea)
  }

  // ---------- router ----------
  const TITULO = 'Investigadores UTM · Producción científica Scopus'
  function router() {
    const h = location.hash
    if (h.indexOf('#/autor/') === 0) {
      const id = decodeURIComponent(h.slice(8))
      renderPerfil(id)
      const a = porId.get(id)
      document.title = a ? `${a.n} · ${TITULO}` : TITULO
    } else if (h.indexOf('#/area/') === 0) {
      const ar = decodeURIComponent(h.slice(7))
      renderArea(ar)
      document.title = `${ar} · ${TITULO}`
    } else {
      renderLista()
      document.title = TITULO
    }
    window.scrollTo(0, 0)
  }
  // popover contextual delegado: funciona para elementos dinámicos (paginados)
  app.addEventListener('click', ev => {
    if (ev.target.closest('.top-page')) {
      window.scrollTo({ top: 0, behavior: 'smooth' }); return
    }
    const el = ev.target.closest('[data-cat]')
    if (!el) return
    // en el perfil se filtran sus publicaciones; en la portada (sin perfil
    // activo) el gráfico institucional filtra sobre todas las publicaciones
    const fuente = perfilPubs || D.pubs
    const cat = el.getAttribute('data-cat'), val = el.getAttribute('data-val')
    let lista, titulo, color = '#2e8a1f', autores = null
    if (cat === 'anio') { lista = fuente.filter(p => String(p.y) === val); titulo = 'Año ' + val }
    else if (cat === 'cuartil') { lista = fuente.filter(p => (p.q || 'N/A') === val); titulo = 'Cuartil ' + val; color = COLQ[val] || '#2e8a1f' }
    else if (cat === 'tipo') { lista = fuente.filter(p => (p.st || 'Otro') === val); titulo = 'Tipo: ' + val }
    else if (cat === 'revista') { lista = fuente.filter(p => (p.j || '') === val); titulo = 'Fuente: ' + val }
    else if (cat === 'area') { lista = fuente.filter(p => (p.a || []).includes(val)); titulo = 'Área: ' + val }
    else if (cat === 'frase') {
      lista = fuente.filter(p => coincideFrase(p.t, val))
      titulo = 'Tema: ' + val
    }
    else if (cat === 'pais') {
      lista = fuente.filter(p => (p.pc || []).includes(val)); titulo = 'País: ' + val
      // Autores internacionales (externos a la UTM y a Ecuador) que aparecen en
      // esas publicaciones, para la segunda pestaña. El mapa extNombres ya excluye
      // a los coautores con afiliación ecuatoriana, así que basta con filtrar por él.
      const ext = (D.extNombres) || {}, extP = (D.extPais) || {}
      const ct = {}
      lista.forEach(p => (p.xa || []).forEach(id => { if (ext[id]) ct[id] = (ct[id] || 0) + 1 }))
      autores = Object.entries(ct)
        .map(([id, n]) => ({ id, nombre: ext[id], n, externo: true, pais: extP[id] }))
        .sort((a, b) => b.n - a.n)
    }
    else if (cat === 'inst') { lista = fuente.filter(p => (p.pi || []).includes(val)); titulo = 'Institución: ' + val }
    else if (cat === 'coautorExt') {
      lista = fuente.filter(p => (p.xa || []).includes(val))
      const et = el.querySelector('span')
      titulo = 'Coautor: ' + (et ? et.textContent : val)
    }
    else if (cat === 'coautorUtm') {
      lista = fuente.filter(p => (p.u || []).map(String).includes(val))
      const co = porId.get(val)
      titulo = 'Coautor: ' + (co ? co.n : val)
    }
    // Top 10 del landing: publicaciones del autor (histórico y del año en curso).
    else if (cat === 'autorPubs') {
      lista = (D.porAutor[val] || []).map(i => D.pubs[i]).filter(Boolean)
      const co = porId.get(val); titulo = co ? co.n : val
    }
    else if (cat === 'autorPubsAnio') {
      lista = (D.porAutor[val] || []).map(i => D.pubs[i]).filter(p => p && p.y === ANIO_ACTUAL)
      const co = porId.get(val); titulo = (co ? co.n : val) + ' · ' + ANIO_ACTUAL
    }
    else return
    mostrarPopover(ev, titulo, lista, color, autores)
  })

  // Tooltip por toque para móvil: en pantalla táctil no hay "hover", así que el
  // title de las pastillas de cuartil no se muestra. Al tocar una, se abre un
  // globo con su explicación; se cierra al tocar en otro lado o al desplazarse.
  // En escritorio el title sigue funcionando al pasar el mouse.
  let globoTip = null
  function cerrarGlobo() { if (globoTip) { globoTip.remove(); globoTip = null } }
  document.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.insig-q[title]')
    if (!chip || chip.closest('[data-cat]')) { cerrarGlobo(); return }
    cerrarGlobo()
    globoTip = document.createElement('div')
    globoTip.className = 'tip-toque'
    globoTip.textContent = chip.getAttribute('title')
    document.body.appendChild(globoTip)
    const r = chip.getBoundingClientRect()
    const w = globoTip.offsetWidth, h = globoTip.offsetHeight
    let x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8))
    let y = r.top - h - 8
    if (y < 8) y = r.bottom + 8
    globoTip.style.left = x + 'px'
    globoTip.style.top = y + 'px'
  })
  window.addEventListener('scroll', cerrarGlobo, { passive: true })

  window.addEventListener('hashchange', () => { cerrarPop(); cerrarGlobo(); router() })
  router()
})()
