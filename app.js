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
  // Decimales con coma, como corresponde en español: 6,53 y no 6.53. Así no se
  // confunden con el punto de los miles (1.777).
  const dec = (v, n = 2) => (Number(v) || 0).toLocaleString('es-EC',
    { minimumFractionDigits: n, maximumFractionDigits: n })
  // Valor de un indicador según su naturaleza (entero o decimal).
  const fmtInd = (k, v) => (k === 'CP' || k === 'm') ? dec(v, 2)
    : (k === 'apu' || k === 'cc') ? dec(v, 1) : num(v)
  const esc = s => (s == null ? '' : String(s)).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  const COLQ = { Q1: '#1e6b14', Q2: '#7bbf3a', Q3: '#e0902d', Q4: '#b23b30', 'N/A': '#a8a394', NC: '#c9c4b8' }

  // Mínimo de publicaciones para entrar en el ranking de citas por publicación (C/P),
  // evitando que un único trabajo muy citado distorsione los primeros puestos.
  const MIN_PUBS_CP = 5
  const MIN_PUBS_CP_ANUAL = 2

  // explicaciones de cada indicador (tooltip al pasar el cursor sobre el KPI)
  const AY = {
    P: 'Publicaciones (P): número de documentos indexados en Scopus. Se excluyen erratas, cartas, notas y editoriales.',
    C: 'Citas (C): total de citas recibidas por esas publicaciones según Scopus.',
    h: 'Índice h: el mayor número h tal que h publicaciones tienen al menos h citas cada una. Mide productividad e impacto a la vez.',
    CP: `C/P: citas por publicación; total de citas dividido entre el total de publicaciones (C ÷ P). El puesto en la UTM y el Top 10 exigen al menos ${MIN_PUBS_CP} publicaciones.`,
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

  // quita acentos y pasa a minúsculas para buscar sin importar tildes ni comas
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[,\-]/g, ' ')

  // índice rápido de publicaciones, áreas por autor y texto buscable por documento
  const PUB_IDX = new Map(D.pubs.map((p, i) => [p, i]))
  const PUB_BUSQ = D.pubs.map(p => norm([p.t, p.j, p.doi, ...(p.a || []), ...(p.au || []), p.uf].filter(Boolean).join(' ')))
  const AUTOR_AREAS = (() => {
    const m = new Map()
    Object.entries(D.porAutor).forEach(([id, idxs]) => {
      const s = new Set()
      idxs.forEach(i => { const p = D.pubs[i]; if (p) (p.a || []).forEach(ar => s.add(ar)) })
      m.set(id, s)
    })
    return m
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
    const todasAreas = orden(areas)
    return {
      porAnio,
      todasAreas,
      topAreas: todasAreas.slice(0, 16),
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
      const elegibles = m === 'CP'
        ? D.autores.filter(a => (a.P || 0) >= MIN_PUBS_CP)
        : D.autores
      ;[...elegibles].sort((x, y) => val(y, m) - val(x, m) || (y.C - x.C) || (y.P - x.P))
        .forEach((a, i) => { rank.get(a.id)[m] = i + 1 })
    })
    return rank
  })()
  const puestoTxt = r => r ? `Puesto ${r} en UTM` : ''

  // iconos minimalistas (Feather) para las estadísticas y botones
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
    historial: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><polyline points="12 7 12 12 15 15"/>',
    scopus: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    orcid: '<circle cx="12" cy="12" r="10"/><line x1="8.8" y1="10.2" x2="8.8" y2="16"/><circle cx="8.8" cy="7.5" r="0.6" fill="currentColor"/><path d="M12 10.2h2.1a2.9 2.9 0 0 1 0 5.8H12z"/>',
    scholar: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/><line x1="22" y1="10" x2="22" y2="16"/>',
    rg: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    inst: '<polygon points="12 2 2 7 22 7 12 2"/><line x1="6" y1="7" x2="6" y2="17"/><line x1="10" y1="7" x2="10" y2="17"/><line x1="14" y1="7" x2="14" y2="17"/><line x1="18" y1="7" x2="18" y2="17"/><line x1="2" y1="21" x2="22" y2="21"/><line x1="4" y1="17" x2="20" y2="17"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    cuartil: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/>',
    qTag: '<path d="M12 2l3 6 6 .9-4.3 4.2 1 6-5.7-3-5.7 3 1-6L3 8.9 9 8z"/>',
    oa: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    primerAutor: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
    csv: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    bibtex: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/>',
    tema: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    filtro: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    copiar: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    enlace: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    alerta: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    cerrar: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    mas: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    rol: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    trayectoria: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    calidad: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    reciente: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    ritmo: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    descarga: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    recientes: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
    fuente: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    area: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    trofeo: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-1.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98 1.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  }
  const ico = n => `<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`
  const icoQ = c => `<svg class="ic-svg ic-q" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="${c}" fill-opacity="0.22" stroke="${c}"/><circle cx="12" cy="12" r="3.2" fill="${c}" stroke="none"/></svg>`
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

  // fecha de la última descarga de Scopus, en la barra superior y en el pie
  let fechaHero = ''
  const pieFecha = document.getElementById('pie-fecha')
  if (D.fecha) {
    const [dia, hora] = String(D.fecha).trim().split(/\s+/)
    const [y, m, d] = dia.split('-').map(Number)
    const fTxt = new Date(y, m - 1, d).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })
    const texto = hora ? `${fTxt}, ${hora} (GMT-5)` : fTxt
    const iso = hora ? `${dia}T${hora}-05:00` : dia
    for (const el of [pieFecha]) if (el) { el.dateTime = iso; el.textContent = texto }
    fechaHero = `<div class="hero-fecha"><span>Datos de Scopus al <time datetime="${iso}">${texto}</time></span></div>`
  } else {
    if (pieFecha) pieFecha.closest('.pie-fecha').hidden = true
  }

  // año actual y métricas por autor restringidas a ese año (mismos criterios que
  // el histórico). Se usa D.porAutor para incluir fusiones y asignaciones manuales.
  const ANIO_ACTUAL = new Date().getFullYear()
  // Publicación con fecha de portada de un año posterior al actual: salió en línea antes de su volumen.
  const adelM = p => (p.y || 0) > ANIO_ACTUAL
    ? `<span class="adelanto" title="Fecha de portada ${p.y}, posterior al año actual: se publicó en línea antes de su volumen.">En línea antes de su volumen</span> · ` : ''
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
  const estado = {
    q: '', orden: 'P', area: '', soloVig: false, letra: '', pagina: 1,
    topTab: 'anual', topMetric: 'P', topMetricAnual: 'P', topSoloVig: false, pubMetric: 'recientes',
    panTab: 'rev', perfilId: '', periodoPerfil: 'todo', modoQ: 'nombre',
  }
  const POR_PAGINA = 20
  let refGrid, refConteo, refPag, refPagTop
  let comStop = null   // limpieza del grafo de comunidades del perfil anterior
  let aplicarFiltroCtxPubs = null   // callback para filtrar la lista de publicaciones desde un popup

  // ---------- búsqueda por tema en el directorio ----------
  let PUB_TEMA = null
  // Investigadores con publicaciones cuyo título, revista o áreas contienen todas las palabras.
  function conteoTema(texto) {
    if (!PUB_TEMA) PUB_TEMA = D.pubs.map(p => norm([p.t, p.j, ...(p.a || [])].filter(Boolean).join(' ')))
    const tokens = norm(texto).split(/\s+/).filter(Boolean)
    const m = new Map()
    if (!tokens.length) return m
    const ok = PUB_TEMA.map(s => tokens.every(tk => s.includes(tk)))
    Object.entries(D.porAutor).forEach(([id, idxs]) => {
      const n = idxs.reduce((s, i) => s + (ok[i] ? 1 : 0), 0)
      if (n && porId.has(id)) m.set(id, n)
    })
    return m
  }
  function pintarModoQ() {
    document.querySelectorAll('.modo-busq button').forEach(b => {
      const on = b.dataset.m === estado.modoQ
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false')
    })
    const q = document.getElementById('q')
    if (q) q.placeholder = estado.modoQ === 'tema'
      ? 'Buscar un tema: palabra del título, revista o área…'
      : 'Buscar por nombre, apellido o Scopus ID…'
  }

  function wireCopiarEnlace() {
    document.querySelectorAll('[data-copiar-enlace]').forEach(b => b.addEventListener('click', () => {
      const lbl = b.querySelector('span'), orig = lbl ? lbl.textContent : ''
      copiarTexto(location.href)
        .then(() => { if (lbl) lbl.textContent = 'Enlace copiado' })
        .catch(() => { if (lbl) lbl.textContent = 'Copie la dirección del navegador' })
      setTimeout(() => { if (lbl) lbl.textContent = orig }, 2200)
    }))
  }

  function renderLista() {
    perfilPubs = null   // en la portada, el gráfico institucional filtra sobre D.pubs
    app.innerHTML = `
      <section class="hero"><div class="hero-inner">
        <h1>Producción científica de la UTM en Scopus</h1>
        <p>Refleja exclusivamente las investigaciones en las que los autores figuran con
           afiliación a la Universidad Técnica de Manabí (UTM).</p>
        ${buscadorHeroHTML()}
        ${fechaHero}
        <div class="hero-stats">
          ${stat('autores', num(G.autores), 'Autores',
    'Investigadores UTM con al menos una publicación indexada en Scopus.')}
          ${stat('pubs', num(G.pubs), 'Publicaciones (P)',
      'Número de documentos UTM indexados en Scopus (se excluyen erratas, cartas, notas y editoriales).')}
          ${stat('citas', num(G.citas), 'Citas (C)',
        'Suma de todas las citas recibidas por las publicaciones según Scopus.')}
          ${stat('cp', dec(G.cp, 2), 'Citas por publicación (C/P)',
          'Promedio de citas por documento: total de citas dividido entre total de publicaciones (C ÷ P).')}
          ${stat('h', num(G.h), 'Índice h',
            'El mayor número h tal que h publicaciones tienen al menos h citas cada una.')}
          ${stat('i10', num(G.i10), 'Índice i10',
            'Número de publicaciones UTM con al menos 10 citas cada una.')}
          ${stat('g', num(G.g), 'Índice g',
            'El mayor número g tal que las g publicaciones más citadas acumulan al menos g² citas en total.')}
          ${stat('m', dec(G.m, 2), 'Índice m',
            'Índice h dividido por los años desde la primera publicación indexada. Permite comparar el ritmo de crecimiento del impacto.')}
        </div></div></section>
      ${panoramaHTML()}
      <div class="wrap" style="padding-bottom:0">
        <h2 class="dir-tit">Top 10 investigadores</h2>
        <div class="ayuda-filtros">Elija entre el ranking del año en curso y el histórico, y ordene por el
          indicador que prefiera.</div>
        ${destacadosHTML()}
      </div>
      ${novedadesHTML()}
      ${actividadHTML()}
      <div class="wrap" id="dirsec">
        <h2 class="dir-tit">Directorio de investigadores</h2>
        <div class="ayuda-filtros">Busque por nombre o apellido, o cambie a «Tema» para ver quiénes publican más sobre un asunto.
          Filtre por área temática o inicial del apellido y ordene por el indicador que prefiera.</div>
        <div class="controles">
          <div class="buscador">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="q" type="search" aria-label="Buscar investigador en el directorio" placeholder="Buscar por nombre, apellido o Scopus ID…" autocomplete="off" />
          </div>
          <div class="modo-busq" role="group" aria-label="Buscar por">
            <button type="button" data-m="nombre" title="Buscar por nombre, apellido o Scopus ID">Nombre</button>
            <button type="button" data-m="tema" title="Buscar quién publica sobre un tema: palabras del título, la revista o el área">Tema</button>
          </div>
          <select class="selector" id="areaDir" aria-label="Filtrar directorio por área temática">
            <option value="">Área temática: Todas (${GI.todasAreas.length})</option>
            ${GI.todasAreas.map(([ar, c]) => `<option value="${esc(ar)}">${esc(ar)} (${c})</option>`).join('')}
          </select>
          <select class="selector" id="orden" aria-label="Ordenar directorio de investigadores">
            ${METRICAS_ORD.map(([k, et]) => `<option value="${k}">Ordenar: ${et}</option>`).join('')}
            <option value="ap">Ordenar: Apellido (A-Z)</option>
          </select>
          <button type="button" class="btn-filtro-vig${estado.soloVig ? ' on' : ''}" id="btnVigente"
            aria-pressed="${estado.soloVig ? 'true' : 'false'}"
            title="Mostrar únicamente investigadores con afiliación UTM vigente en Scopus">${ico('primerAutor')}<span>Solo filiación vigente</span></button>
          <div class="conteo" id="conteo"></div>
        </div>
        <div class="alfabeto" id="alf"></div>
        <div class="paginacion" id="pagTop"></div>
        <div class="grid-inv" id="grid"></div>
        <div class="paginacion" id="pag"></div>
      </div>
      ${TOP_PAGE_HTML}`

    wireBuscadorHero()
    const q = document.getElementById('q'); q.value = estado.q
    const orden = document.getElementById('orden'); orden.value = estado.orden
    const areaDir = document.getElementById('areaDir'); if (areaDir) areaDir.value = estado.area
    const btnVig = document.getElementById('btnVigente')
    refGrid = document.getElementById('grid')
    refConteo = document.getElementById('conteo')
    refPag = document.getElementById('pag')
    refPagTop = document.getElementById('pagTop')

    pintarModoQ()
    document.querySelectorAll('.modo-busq button').forEach(b => b.addEventListener('click', () => {
      estado.modoQ = b.dataset.m; estado.pagina = 1; pintarModoQ(); pintar(); verDirectorio(false)
    }))
    q.addEventListener('input', () => { estado.q = q.value; estado.pagina = 1; pintar(); verDirectorio(false) })
    orden.addEventListener('change', () => { estado.orden = orden.value; estado.pagina = 1; pintar(); verDirectorio(false) })
    if (areaDir) areaDir.addEventListener('change', () => { estado.area = areaDir.value; estado.pagina = 1; pintar(); verDirectorio(false) })
    if (btnVig) btnVig.addEventListener('click', () => {
      estado.soloVig = !estado.soloVig
      btnVig.classList.toggle('on', estado.soloVig)
      btnVig.setAttribute('aria-pressed', estado.soloVig ? 'true' : 'false')
      estado.pagina = 1; pintar(); verDirectorio(false)
    })

    // pestañas del panorama institucional (fuentes vs áreas temáticas)
    document.querySelectorAll('.pan-tab[data-pan]').forEach(b => b.addEventListener('click', () => {
      estado.panTab = b.dataset.pan
      document.querySelectorAll('.pan-tab[data-pan]').forEach(x => x.classList.toggle('on', x.dataset.pan === estado.panTab))
      const pr = document.getElementById('panRevPane'), pa = document.getElementById('panAreaPane')
      if (pr) pr.style.display = estado.panTab === 'rev' ? '' : 'none'
      if (pa) pa.style.display = estado.panTab === 'area' ? '' : 'none'
    }))

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
    const btnTopVig = document.getElementById('btnTopVigente')
    if (btnTopVig) btnTopVig.addEventListener('click', () => {
      estado.topSoloVig = !estado.topSoloVig
      btnTopVig.classList.toggle('on', estado.topSoloVig)
      btnTopVig.setAttribute('aria-pressed', estado.topSoloVig ? 'true' : 'false')
      pintarTop(); pintarTopAnual()
    })
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

  // ---------- portada: buscador con sugerencias (autores, especialistas por tema y áreas) ----------
  function buscadorHeroHTML() {
    return `<div class="hx-bus">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="qHero" type="search" autocomplete="off" role="combobox" aria-expanded="false"
        aria-controls="qHeroSug" aria-label="Buscar investigador, tema o Scopus ID"
        placeholder="Buscar por nombre, tema, palabra clave o Scopus ID…">
      <div class="hx-sug" id="qHeroSug" role="listbox" hidden></div>
    </div>`
  }

  function wireBuscadorHero() {
    const inp = document.getElementById('qHero'); if (!inp) return
    const caja = document.getElementById('qHeroSug')
    let halla = [], sel = -1
    const cerrar = () => { caja.hidden = true; inp.setAttribute('aria-expanded', 'false'); sel = -1 }
    const irA = (id) => { cerrar(); inp.blur(); location.hash = '#/autor/' + encodeURIComponent(id) }
    const irArea = (ar) => { cerrar(); inp.blur(); location.hash = '#/area/' + encodeURIComponent(ar) }
    // Pasa la búsqueda al directorio y baja hasta él, para ver la lista completa.
    const verTodos = () => {
      cerrar(); inp.blur()
      estado.q = inp.value.trim(); estado.letra = ''; estado.pagina = 1; estado.modoQ = 'nombre'
      const q = document.getElementById('q'); if (q) q.value = estado.q
      pintarModoQ(); marcarLetra(); pintar(); verDirectorio(true)
    }
    // Lo mismo, pero buscando el texto como tema.
    const verTema = () => {
      cerrar(); inp.blur()
      estado.q = inp.value.trim(); estado.letra = ''; estado.pagina = 1; estado.modoQ = 'tema'
      const q = document.getElementById('q'); if (q) q.value = estado.q
      pintarModoQ(); marcarLetra(); pintar(); verDirectorio(true)
    }
    const pinta = () => {
      const txt = inp.value.trim()
      if (txt.length < 2) return cerrar()
      const tokens = norm(txt).split(/\s+/).filter(Boolean)
      halla = D.autores.filter(a => {
        const n = norm(a.n), id = String(a.id || '')
        return tokens.every(tk => n.includes(tk) || id.includes(tk))
      }).sort((a, b) => (b.P || 0) - (a.P || 0))
      const visAut = halla.slice(0, 5)
      const enAut = new Set(visAut.map(a => a.id))

      // Especialistas UTM cuyas publicaciones coinciden con el tema buscado
      const porTema = new Map()
      for (let i = 0; i < PUB_BUSQ.length; i++) {
        const s = PUB_BUSQ[i]
        if (!tokens.every(tk => s.includes(tk))) continue
        const p = D.pubs[i]
        ;(p.u || []).forEach(uid => {
          if (!enAut.has(uid) && porId.has(uid)) porTema.set(uid, (porTema.get(uid) || 0) + 1)
        })
      }
      const visTema = [...porTema.entries()]
        .map(([uid, n]) => ({ a: porId.get(uid), n }))
        .sort((x, y) => y.n - x.n || (y.a.C || 0) - (x.a.C || 0))
        .slice(0, 4)

      // Áreas temáticas de Scopus que coinciden
      const visAreas = GI.todasAreas
        .filter(([ar]) => { const na = norm(ar); return tokens.every(tk => na.includes(tk)) })
        .slice(0, 3)

      let html = ''
      if (visAut.length) {
        if (visTema.length || visAreas.length) html += '<div class="hx-sec">Investigadores</div>'
        html += visAut.map(a => `<button type="button" role="option" data-autor="${esc(a.id)}">${avatar(a)}
          <span class="sn">${esc(a.n)}</span>
          <span class="sm">${a.P} pub. · ${num(a.C)} citas</span></button>`).join('')
        if (halla.length > visAut.length) {
          html += `<button type="button" class="sver" data-todos="1">Ver los ${num(halla.length)} investigadores en el directorio</button>`
        }
      }
      if (visTema.length) {
        html += `<div class="hx-sec">Investigadores con publicaciones sobre «${esc(txt)}»</div>`
        html += visTema.map(({ a, n }) => `<button type="button" role="option" data-autor="${esc(a.id)}">${avatar(a)}
          <span class="sn">${esc(a.n)}</span>
          <span class="sm">${n} pub. en el tema · ${num(a.C)} citas</span></button>`).join('')
        const nEsp = conteoTema(txt).size
        if (nEsp > visTema.length) html += `<button type="button" class="sver" data-todostema="1">Ver los ${num(nEsp)} especialistas en el directorio</button>`
      }
      if (visAreas.length) {
        html += '<div class="hx-sec">Áreas temáticas de Scopus</div>'
        html += visAreas.map(([ar, c]) => `<button type="button" role="option" data-area="${esc(ar)}">
          <span class="hx-area-ic">❖</span>
          <span class="sn">${esc(ar)}</span>
          <span class="sm">${num(c)} pub. UTM</span></button>`).join('')
      }
      if (!html) {
        html = '<div class="svacio">Sin coincidencias por nombre, tema ni ID de Scopus.</div>'
      }
      caja.innerHTML = html
      caja.hidden = false; inp.setAttribute('aria-expanded', 'true'); sel = -1
      // mousedown y no click: se adelanta al blur del campo.
      caja.querySelectorAll('button[data-autor]').forEach(b =>
        b.addEventListener('mousedown', (ev) => { ev.preventDefault(); irA(b.dataset.autor) }))
      caja.querySelectorAll('button[data-area]').forEach(b =>
        b.addEventListener('mousedown', (ev) => { ev.preventDefault(); irArea(b.dataset.area) }))
      const todos = caja.querySelector('button[data-todos]')
      if (todos) todos.addEventListener('mousedown', (ev) => { ev.preventDefault(); verTodos() })
      const todosTema = caja.querySelector('button[data-todostema]')
      if (todosTema) todosTema.addEventListener('mousedown', (ev) => { ev.preventDefault(); verTema() })
    }
    inp.addEventListener('input', pinta)
    inp.addEventListener('focus', () => { if (inp.value.trim().length >= 2) pinta() })
    inp.addEventListener('blur', () => setTimeout(cerrar, 150))
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { cerrar(); return }
      const btns = caja.hidden ? [] : [...caja.querySelectorAll('button')]
      if (ev.key === 'Enter') {
        ev.preventDefault()
        if (sel >= 0 && btns[sel]) btns[sel].dispatchEvent(new MouseEvent('mousedown'))
        else if (btns[0]) btns[0].dispatchEvent(new MouseEvent('mousedown'))
        else verTodos()
        return
      }
      if ((ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') || !btns.length) return
      ev.preventDefault()
      sel = (sel + (ev.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length
      btns.forEach((b, i) => b.classList.toggle('on', i === sel))
      btns[sel].scrollIntoView({ block: 'nearest' })
    })
  }

  // ---------- portada: tablero institucional y novedades ----------
  function panoramaHTML() {
    const maxR = GI.topRev.length ? GI.topRev[0][1] : 1
    const revHTML = GI.topRev.map(([n, c]) =>
      `<div class="tipo-fila" data-cat="revista" data-val="${esc(n)}" style="cursor:pointer" title="Ver publicaciones de ${esc(n)}"><span class="tn">${esc(n)}</span>
        <span class="tb"><div style="width:${Math.max(3, Math.round(100 * c / maxR))}%"></div></span>
        <span class="tv">${c}</span></div>`).join('')
    const topAr8 = GI.topAreas.slice(0, 8)
    const maxA = topAr8.length ? topAr8[0][1] : 1
    const areaHTML = topAr8.map(([n, c]) =>
      `<div class="tipo-fila" data-cat="area" data-val="${esc(n)}" style="cursor:pointer" title="Ver publicaciones de ${esc(n)}"><span class="tn">${esc(n)}</span>
        <span class="tb"><div style="width:${Math.max(3, Math.round(100 * c / maxA))}%"></div></span>
        <span class="tv">${c} <a href="#/area/${encodeURIComponent(n)}" onclick="event.stopPropagation()" title="Abrir página del área ${esc(n)}" style="margin-left:4px;font-weight:700">↗</a></span></div>`).join('')
    const paisesHTML = GI.topPaises.length
      ? GI.topPaises.map(([p, c]) => {
        const b = banderaPais(p)
        return `<span class="ce-chip" data-cat="pais" data-val="${esc(p)}" style="cursor:pointer" title="Ver publicaciones y autores con ${esc(p)}">${b ? b + ' ' : ''}${esc(p)}<b>${c}</b></span>`
      }).join('')
      : '<span style="color:var(--texto3);font-size:var(--fs-sm)">Sin colaboración internacional registrada.</span>'
    const enRev = estado.panTab !== 'area'
    return `<div class="wrap portada" style="padding-bottom:0">
      <h2 class="dir-tit">Panorama institucional</h2>
      <div class="ayuda-filtros">Producción científica de la Universidad Técnica de Manabí indexada en Scopus, en conjunto.</div>
      <div class="panel" style="margin-bottom:16px"><h3>Publicaciones por año</h3>${barsAnio(GI.porAnio, 200)}${infoAnios(GI.porAnio)}
        <div class="ctx-hint">Clic en una barra para ver las publicaciones de ese año.</div></div>
      <div class="grid2">
        <div class="panel">
          <div class="top-tabs" style="margin-bottom:12px">
            <button type="button" class="top-tab pan-tab${enRev ? ' on' : ''}" data-pan="rev">${ico('pubs')}<span>Fuentes más frecuentes</span></button>
            <button type="button" class="top-tab pan-tab${!enRev ? ' on' : ''}" data-pan="area">${ico('cuartil')}<span>Áreas temáticas</span></button>
          </div>
          <div id="panRevPane" style="${enRev ? '' : 'display:none'}">
            <div class="tipos-barras">${revHTML}</div>
            <div class="ctx-hint">Clic en una fuente para ver sus publicaciones más recientes.</div>
          </div>
          <div id="panAreaPane" style="${!enRev ? '' : 'display:none'}">
            <div class="tipos-barras">${areaHTML}</div>
            <div class="ctx-hint">Clic en un área para ver sus publicaciones o en ↗ para abrir el área completa.</div>
          </div>
        </div>
        <div class="panel"><h3>Colaboración internacional</h3>
          <div class="metricas-autoria intl" style="margin-top:0;border-top:none;padding-top:0">
            <div class="ma"><b>${GI.pctIntl}%</b><span>Publicaciones con coautoría internacional</span></div>
            <div class="ma"><b>${GI.nPaises}</b><span>Países colaboradores</span></div>
          </div>
          <div class="ce-sub">Principales países</div>
          <div class="ce-chips">${paisesHTML}</div>
          <div class="ctx-hint">Clic en un país para ver las publicaciones y los autores que colaboran.</div></div>
      </div>
    </div>`
  }

  function novedadesHTML() {
    return `<div class="wrap portada" style="padding-bottom:0">
      <h2 class="dir-tit">Últimas publicaciones</h2>
      <div class="ayuda-filtros">Documentos indexados más recientes; cambie a las más citadas si lo prefiere.</div>
      <div class="panel">
        <div class="top-tabs" style="margin-bottom:12px">
          <button class="top-tab pub-tab" data-pm="recientes">${ico('g')}<span>Más recientes</span></button>
          <button class="top-tab pub-tab" data-pm="citadas"
            title="Publicaciones recientes que más citas han recibido">${ico('citas')}<span>Recientes más citadas</span></button>
        </div>
        <div id="destPubs"></div>
      </div>
    </div>`
  }

  // ---------- portada: actividad desde la última actualización ----------
  // Autores con publicaciones o citas nuevas y autores que aparecen por primera
  // vez. Viene ya calculado en D.nov (lo arma el sistema al generar el sitio).
  const NOV_VISIBLES = 8
  const fechaCorta = f => {
    if (!f) return ''
    const d = new Date(String(f).replace(' ', 'T'))
    if (isNaN(d)) return esc(f)
    const fecha = d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })
    const hora = String(f).trim().split(/\s+/)[1]
    return hora ? `${fecha}, ${hora.slice(0, 5)} (GMT-5)` : fecha
  }
  function filaNov(a, extra) {
    return `<a class="nov-fila" href="#/autor/${encodeURIComponent(a.id)}" title="Ver el perfil de ${esc(a.n)}">
      <span class="nov-nom">${esc(a.n)}</span>
      <span class="nov-ins">${extra}</span></a>`
  }
  function listaNov(id, filas) {
    if (!filas.length) return '<div class="nov-vacio">Sin cambios en esta actualización.</div>'
    const ocultas = filas.length - NOV_VISIBLES
    return `<div class="nov-lista" id="${id}">${filas.map((f, i) =>
      i < NOV_VISIBLES ? f : f.replace('class="nov-fila"', 'class="nov-fila nov-oculta"')).join('')}</div>
      ${ocultas > 0 ? `<button class="nov-mas" data-lista="${id}">Ver los ${filas.length} autores</button>` : ''}`
  }
  function actividadHTML() {
    const N = D.nov
    if (!N) return ''
    const plural = (n, uno, varios) => `${num(n)} ${n === 1 ? uno : varios}`
    const conNov = (N.an || []).map(([id, np, cg]) => {
      const a = porId.get(id)
      if (!a) return null
      const b = []
      if (np) b.push(`<b class="nov-b npub">+${plural(np, 'publicación', 'publicaciones')}</b>`)
      if (cg) b.push(`<b class="nov-b cit">+${plural(cg, 'cita', 'citas')}</b>`)
      return filaNov(a, b.join(''))
    }).filter(Boolean)
    const nuevos = (N.nu || []).map(id => porId.get(id)).filter(Boolean)
      .map(a => filaNov(a, `<b class="nov-b nue">${plural(a.P, 'publicación', 'publicaciones')}</b>`))
    return `<div class="wrap portada" style="padding-bottom:0">
      <h2 class="dir-tit">Novedades de la última actualización</h2>
      <div class="ayuda-filtros">Cambios entre la actualización anterior (${fechaCorta(N.fb)}) y la última (${fechaCorta(N.fa)}).</div>
      <div class="grid2">
        <div class="panel"><h3>Autores con nuevas publicaciones o citas <span class="nov-cuenta">${num(conNov.length)}</span></h3>
          ${listaNov('novAutores', conNov)}</div>
        <div class="panel"><h3>Autores nuevos <span class="nov-cuenta">${num(nuevos.length)}</span></h3>
          <div class="ayuda-filtros" style="margin:-4px 0 8px">Aparecen por primera vez en el portal.</div>
          ${listaNov('novNuevos', nuevos)}</div>
      </div>
    </div>`
  }
  // "Ver todos" de las listas de novedades (delegado: la portada se repinta)
  document.addEventListener('click', e => {
    const b = e.target.closest('.nov-mas')
    if (!b) return
    const lista = document.getElementById(b.dataset.lista)
    if (!lista) return
    const abierta = lista.classList.toggle('abierta')
    const total = lista.querySelectorAll('.nov-fila').length
    b.textContent = abierta ? 'Ver menos' : `Ver los ${total} autores`
  })

  function marcarLetra() {
    document.querySelectorAll('#alf button').forEach(b =>
      b.classList.toggle('on', b.dataset.l === estado.letra))
  }

  function filtrar() {
    const tokens = norm(estado.q).split(/\s+/).filter(Boolean)
    let arr = D.autores
    estado.temaN = null
    // modo Tema: autores con publicaciones sobre el asunto, ordenados por cuántas tienen
    if (estado.modoQ === 'tema' && tokens.length) {
      estado.temaN = conteoTema(estado.q)
      arr = arr.filter(a => estado.temaN.has(String(a.id)))
    // cada palabra escrita debe estar en el nombre (apellido y/o nombre, en cualquier
    // orden) o en el Scopus ID del autor
    } else if (tokens.length) arr = arr.filter(a => {
      const nombre = norm(a.n)
      const id = String(a.id || '')
      return tokens.every(tk => nombre.includes(tk) || id.includes(tk))
    })
    if (estado.area) arr = arr.filter(a => {
      const s = AUTOR_AREAS.get(a.id)
      return s && s.has(estado.area)
    })
    if (estado.soloVig) arr = arr.filter(a => !a.xu)
    if (estado.letra) arr = arr.filter(a => (a.ap || a.n)[0] &&
      (a.ap || a.n)[0].toUpperCase() === estado.letra)
    const o = estado.orden, tn = estado.temaN
    return [...arr].sort((a, b) => (tn ? (tn.get(String(b.id)) || 0) - (tn.get(String(a.id)) || 0) : 0) || (o === 'ap'
      ? (a.ap || '').localeCompare(b.ap || '')
      : (b[o] || 0) - (a[o] || 0)))
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

  function destacadosHTML() {
    const optTop = (k, et, minP) => `<option value="${k}">Ordenar: ${et}${k === 'CP' ? ` (mín. ${minP} pub.)` : ''}</option>`
    return `<div class="destacados">
      <div class="panel"><div class="top-cab">
        <div class="top-tabs">
          <button class="top-tab on" data-tab="anual">${ico('fecha')}<span>Top 10 del año ${ANIO_ACTUAL}</span></button>
          <button class="top-tab" data-tab="hist">${ico('h')}<span>Top 10 histórico</span></button>
        </div>
        <div class="top-cab-der">
          <button type="button" class="btn-filtro-vig${estado.topSoloVig ? ' on' : ''}" id="btnTopVigente"
            aria-pressed="${estado.topSoloVig ? 'true' : 'false'}"
            title="Mostrar únicamente investigadores con afiliación UTM vigente en Scopus">${ico('primerAutor')}<span>Solo filiación vigente</span></button>
          <select class="selector" id="topMetricAnual" aria-label="Indicador del Top 10 del año">
            ${METRICAS_ORD.map(([k, et]) => optTop(k, et, MIN_PUBS_CP_ANUAL)).join('')}
          </select>
          <select class="selector" id="topMetric" aria-label="Indicador del Top 10 histórico" style="display:none">
            ${METRICAS_ORD.map(([k, et]) => optTop(k, et, MIN_PUBS_CP)).join('')}
          </select>
        </div></div>
        <div id="destTopAnual"></div>
        <div id="destTop" style="display:none"></div></div></div>`
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
  // Asigna puesto con empate (1, 2, 3, 3, 5...): quienes comparten el valor mostrado
  // llevan el mismo número y, si quedan entre los 3 primeros puestos, comparten medalla.
  function conPuestos(lista, valTexto, valNum) {
    let puesto = 0, prev = null
    return lista.map((item, i) => {
      const txt = valTexto(item)
      if (i === 0 || txt !== prev) { puesto = i + 1; prev = txt }
      return { item, puesto, medalla: puesto <= 3 && valNum(item) > 0 ? puesto : 0 }
    })
  }
  function badgePuesto(puesto, medalla) {
    if (!medalla) return `<div class="rk">${puesto}</div>`
    return `<div class="rk rk-med rk-${medalla}" title="Puesto ${puesto}">` +
      `<svg viewBox="0 0 28 30" aria-hidden="true">` +
      `<path class="rk-cinta" d="M9.5 19.5L8 28l6-3.2L20 28l-1.5-8.5"/>` +
      `<circle class="rk-disco" cx="14" cy="11.5" r="9.5"/></svg>` +
      `<span>${puesto}</span></div>`
  }
  function itemTop(a, puesto, medalla, m) {
    const val = fmtInd(m, a[m])
    return `<div class="destacado">${badgePuesto(puesto, medalla)}${avatar(a)}
      <div class="dn"><a href="#/autor/${encodeURIComponent(a.id)}">${esc(a.n)}</a>
        <small><span class="pub-link" data-cat="autorPubs" data-val="${esc(a.id)}" title="Ver las publicaciones">${a.P} pub</span> · ${num(a.C)} citas</small>${notaExUtm(a)}</div>
      <div class="dm pub-link" data-cat="autorPubs" data-val="${esc(a.id)}" title="Ver las publicaciones"><b>${val}</b>${ETQ_TOP[m]}</div></div>`
  }
  function pintarTop() {
    const cont = document.getElementById('destTop'); if (!cont) return
    const m = estado.topMetric
    const candidatos = estado.topSoloVig ? D.autores.filter(a => !a.xu) : D.autores
    const base = m === 'CP' ? candidatos.filter(a => (a.P || 0) >= MIN_PUBS_CP) : candidatos
    const top10 = [...base]
      .sort((a, b) => (b[m] || 0) - (a[m] || 0) || (b.C - a.C) || (b.P - a.P))
      .slice(0, 10)
    cont.innerHTML = conPuestos(top10, a => fmtInd(m, a[m]), a => Number(a[m]) || 0)
      .map(({ item, puesto, medalla }) => itemTop(item, puesto, medalla, m)).join('')
  }
  function itemTopAnual(id, r, puesto, medalla, m) {
    const a = porId.get(id)
    const val = fmtInd(m, r[m])
    return `<div class="destacado">${badgePuesto(puesto, medalla)}${avatar(a)}
      <div class="dn"><a href="#/autor/${encodeURIComponent(a.id)}">${esc(a.n)}</a>
        <small><span class="pub-link" data-cat="autorPubsAnio" data-val="${esc(id)}" title="Ver las publicaciones de ${ANIO_ACTUAL}">${r.P} pub</span> · ${num(r.C)} citas en ${ANIO_ACTUAL}</small>${notaExUtm(a)}</div>
      <div class="dm pub-link" data-cat="autorPubsAnio" data-val="${esc(id)}" title="Ver las publicaciones de ${ANIO_ACTUAL}"><b>${val}</b>${ETQ_TOP[m]}</div></div>`
  }
  function pintarTopAnual() {
    const cont = document.getElementById('destTopAnual'); if (!cont) return
    const m = estado.topMetricAnual
    const todos = [...ANUAL.entries()].filter(([id]) => {
      const au = porId.get(id)
      return au && (!estado.topSoloVig || !au.xu)
    })
    const filtrados = m === 'CP' ? todos.filter(([, r]) => (r.P || 0) >= MIN_PUBS_CP_ANUAL) : todos
    const base = filtrados.length ? filtrados : todos
    const arr = [...base]
      .sort((x, y) => (y[1][m] || 0) - (x[1][m] || 0) || (y[1].C - x[1].C) || (y[1].P - x[1].P))
      .slice(0, 10)
    cont.innerHTML = arr.length
      ? conPuestos(arr, ([, r]) => fmtInd(m, r[m]), ([, r]) => Number(r[m]) || 0)
        .map(({ item: [id, r], puesto, medalla }) => itemTopAnual(id, r, puesto, medalla, m)).join('')
      : `<div style="color:var(--texto3);font-size:var(--fs-sm);padding:8px 2px">Sin publicaciones registradas en ${ANIO_ACTUAL} todavía.</div>`
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
    return `<div class="recip"><div class="rt">${t}</div><div class="rm">${p.y || ''} · ${adelM(p)}${esc(p.j || '—')} · ${badgeQ(p.q)} · ${citas}${aut ? ' · ' + aut : ''}</div></div>`
  }

  function cardInv(a) {
    const tn = estado.temaN ? estado.temaN.get(String(a.id)) : 0
    return `<div class="card-wrap"><button class="card-inv" onclick="location.hash='#/autor/${encodeURIComponent(a.id)}'">
      ${avatar(a)}
      <div class="info">
        <div class="nom">${esc(a.n)}</div>
        ${notaExUtm(a)}
        <div class="anios">Activo ${a.pa || '—'}–${a.ua || '—'}</div>
        ${tn ? `<div class="tema-n">${tn} pub. sobre «${esc(estado.q.trim())}»</div>` : ''}
        <div class="mini">
          <div><b>${a.P}</b><span>Pub.</span></div>
          <div><b>${num(a.C)}</b><span>Citas</span></div>
          <div><b>${a.h}</b><span>h</span></div>
          <div><b>${dec(a.CP, 2)}</b><span>C/P</span></div>
        </div>
      </div></button>
      </div>`
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

  // ---------- roles de autoría, filtros por categoría y enlaces con estado ----------
  const ROL_ET = { primero: 'Primer autor', medio: 'Autor intermedio', ultimo: 'Último autor' }
  const ROL_COL = { primero: '#1e6b14', medio: '#e0902d', ultimo: '#4a6fa5' }
  // El último autor (pub.la) llega con el sitio regenerado; mientras tanto se estima por el apellido.
  const LA_DISP = D.pubs.some(p => p.la)
  const CUARTILES = ['Q1', 'Q2', 'Q3', 'Q4']
  const esAbierto = p => !!(p.oa && p.oa !== 'Closed' && p.oa !== 'Unknown')

  function rolEnPub(p, id) {
    id = String(id)
    if (String(p.fa || '') === id) return 'primero'
    if ((p.nc || (p.au || []).length) === 1 && (p.u || []).map(String).includes(id)) return 'primero'
    if (LA_DISP) return String(p.la || '') === id ? 'ultimo' : 'medio'
    const a = porId.get(id)
    if (!a) return 'medio'
    const ap = norm(a.ap || (a.n || '').split(',')[0]).trim()
    const ult = p.uf || ((p.au && p.au.length === (p.nc || p.au.length)) ? p.au[p.au.length - 1] : '')
    return ult && ap && norm(ult).trim().startsWith(ap) ? 'ultimo' : 'medio'
  }

  // Publicaciones de una categoría (año, revista, país, rol...) dentro de una fuente.
  function listaCat(fuente, cat, val) {
    const id = String(estado.perfilId || '')
    switch (cat) {
      case 'anio': return fuente.filter(p => String(p.y) === val)
      case 'cuartil': return fuente.filter(p => (p.q || 'N/A') === val)
      case 'tipo': return fuente.filter(p => (p.st || 'Otro') === val)
      case 'revista': return fuente.filter(p => (p.j || '') === val)
      case 'area': return fuente.filter(p => (p.a || []).includes(val))
      case 'frase': return fuente.filter(p => coincideFrase(p.t, val))
      case 'pais': return fuente.filter(p => (p.pc || []).includes(val))
      case 'inst': return fuente.filter(p => (p.pi || []).includes(val))
      case 'coautorExt': return fuente.filter(p => (p.xa || []).includes(val))
      case 'coautorUtm': return fuente.filter(p => (p.u || []).map(String).includes(val))
      case 'rol': return fuente.filter(p => rolEnPub(p, id) === val)
      case 'rolAnio': {
        const [y, r] = val.split('|')
        return fuente.filter(p => String(p.y) === y && rolEnPub(p, id) === r)
      }
      case 'cuartilAnio': {
        const [y, q] = val.split('|')
        return fuente.filter(p => String(p.y) === y &&
          (q === 'Q12' ? (p.q === 'Q1' || p.q === 'Q2') : (p.q || 'N/A') === q))
      }
      default: return []
    }
  }
  function tituloCat(cat, val) {
    switch (cat) {
      case 'anio': return 'Año ' + val
      case 'cuartil': return 'Cuartil ' + val
      case 'tipo': return 'Tipo: ' + val
      case 'revista': return 'Fuente: ' + val
      case 'area': return 'Área: ' + val
      case 'frase': return 'Tema: ' + val
      case 'pais': return 'País: ' + val
      case 'inst': return 'Institución: ' + val
      case 'coautorExt': return 'Coautor: ' + ((D.extNombres || {})[val] || val)
      case 'coautorUtm': { const c = porId.get(val); return 'Coautor: ' + (c ? c.n : val) }
      case 'rol': return 'Rol: ' + (ROL_ET[val] || val)
      case 'rolAnio': { const [y, r] = val.split('|'); return y + ' · ' + (ROL_ET[r] || r) }
      case 'cuartilAnio': { const [y, q] = val.split('|'); return y + ' · ' + (q === 'Q12' ? 'Q1 y Q2' : 'Cuartil ' + q) }
      default: return val
    }
  }

  // Estado de la vista en la URL (#/autor/ID?per=5a&q=Q1,Q2&oa=1&c=revista~Nombre):
  // se actualiza con replaceState, así que no dispara hashchange ni vuelve a pintar.
  function hashPartes() {
    const h = location.hash || ''
    const i = h.indexOf('?')
    return [i < 0 ? h : h.slice(0, i), i < 0 ? '' : h.slice(i + 1)]
  }
  const paramsHash = () => new URLSearchParams(hashPartes()[1])
  function fijarParams(params) {
    const qs = params.toString()
    try {
      history.replaceState(null, '', location.pathname + location.search + hashPartes()[0] + (qs ? '?' + qs : ''))
    } catch (e) { /* sin historial (vista previa): se omite */ }
  }
  function leerFiltrosURL() {
    const p = paramsHash()
    const ini = { q: [], oa: p.get('oa') === '1', fa: p.get('fa') === '1', cit: p.get('cit') === '1',
      txt: p.get('txt') || '', ord: p.get('ord') === 'citadas' ? 'citadas' : 'recientes', c: [] }
    ;(p.get('q') || '').split(',').forEach(x => { if (['Q1', 'Q2', 'Q3', 'Q4', 'N/A'].includes(x)) ini.q.push(x) })
    p.getAll('c').forEach(x => {
      const i = x.indexOf('~')
      if (i > 0) ini.c.push({ cat: x.slice(0, i), val: x.slice(i + 1) })
    })
    return ini
  }
  function copiarTexto(txt) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt)
    return new Promise((ok, fail) => {
      const t = document.createElement('textarea')
      t.value = txt; t.style.position = 'fixed'; t.style.opacity = '0'
      document.body.appendChild(t); t.select()
      let bien = false
      try { bien = document.execCommand('copy') } catch (e) { /* nada */ }
      t.remove()
      bien ? ok() : fail(new Error('copia no disponible'))
    })
  }

  // ---------- series anuales del perfil ----------
  function serieAnual(pubs, id) {
    const ys = pubs.map(p => p.y).filter(Boolean)
    if (!ys.length) return []
    const y0 = Math.min(...ys), y1 = Math.max(...ys)
    const out = []
    for (let y = y0; y <= y1; y++) {
      const del = pubs.filter(p => p.y === y)
      const hasta = pubs.filter(p => p.y && p.y <= y).map(p => p.c || 0).sort((a, b) => b - a)
      let h = 0
      for (let i = 0; i < hasta.length; i++) { if (hasta[i] >= i + 1) h = i + 1; else break }
      const r = { y, n: del.length, h, c: del.reduce((s, p) => s + (p.c || 0), 0),
        primero: 0, medio: 0, ultimo: 0, q12: 0, nq: 0 }
      del.forEach(p => {
        r[rolEnPub(p, id)]++
        if (CUARTILES.includes(p.q)) { r.nq++; if (p.q === 'Q1' || p.q === 'Q2') r.q12++ }
      })
      out.push(r)
    }
    return out
  }
  const rango = (a, b) => a === b ? String(a) : `${a} a ${b}`
  // Parte la trayectoria en dos periodos de tamaño parecido (mínimo 3 publicaciones cada uno).
  function partirPeriodos(pubs) {
    const ys = pubs.map(p => p.y).filter(Boolean).sort((a, b) => a - b)
    if (ys.length < 6) return null
    let mejor = null
    ;[...new Set(ys)].slice(1).forEach(c => {
      const nA = ys.filter(y => y < c).length, nB = ys.length - nA
      if (nA < 3 || nB < 3) return
      const d = Math.abs(nA - nB)
      if (!mejor || d < mejor.d) mejor = { c, d, nA, nB }
    })
    if (!mejor) return null
    const finA = Math.max(...ys.filter(y => y < mejor.c))
    return { corte: mejor.c, nA: mejor.nA, nB: mejor.nB,
      etA: rango(ys[0], finA), etB: rango(mejor.c, ys[ys.length - 1]) }
  }

  // ---------- gráficos de la evolución (SVG) ----------
  const pasoEtiqueta = n => Math.max(1, Math.ceil(n / 16))
  function ejeAnios(serie, paso, base) {
    const k = pasoEtiqueta(serie.length)
    return serie.map((r, i) => (i % k && i !== serie.length - 1) ? '' :
      `<text x="${(i * paso + paso / 2).toFixed(1)}" y="${base + 13}" font-size="10" text-anchor="middle" fill="${r.y >= ANIO_ACTUAL ? '#c07a12' : '#98a18d'}">${r.y}${r.y >= ANIO_ACTUAL ? '*' : ''}</text>`).join('')
  }
  function svgHCitas(serie) {
    const n = serie.length, W = Math.max(320, n * 38), H = 196, base = H - 26, top = 24
    const paso = W / n, bw = Math.min(24, paso - 10)
    const maxC = Math.max(1, ...serie.map(r => r.c)), maxH = Math.max(1, ...serie.map(r => r.h))
    const yC = v => base - (v / maxC) * (base - top)
    const yH = v => base - (v / maxH) * (base - top - 4)
    let barras = '', pts = [], puntos = '', zonas = ''
    serie.forEach((r, i) => {
      const x = i * paso + (paso - bw) / 2, cx = i * paso + paso / 2
      const parcial = r.y >= ANIO_ACTUAL
      barras += `<rect x="${x.toFixed(1)}" y="${yC(r.c).toFixed(1)}" width="${bw}" height="${Math.max(r.c ? 1 : 0, base - yC(r.c)).toFixed(1)}" rx="3" fill="#4aab30" fill-opacity="${parcial ? .3 : .6}"><title>${r.y}: ${num(r.c)} citas a las publicaciones de ese año</title></rect>`
      pts.push(`${cx.toFixed(1)},${yH(r.h).toFixed(1)}`)
      const cambia = i === 0 || r.h !== serie[i - 1].h || i === n - 1
      puntos += `<circle cx="${cx.toFixed(1)}" cy="${yH(r.h).toFixed(1)}" r="3" fill="#1e6b14" stroke="#fff" stroke-width="1.2"><title>${r.y}: índice h ${r.h}</title></circle>`
      if (cambia) puntos += `<text x="${cx.toFixed(1)}" y="${(yH(r.h) - 7).toFixed(1)}" font-size="10" font-weight="700" text-anchor="middle" fill="#1e6b14" stroke="#fff" stroke-width="2.6" paint-order="stroke">${r.h}</text>`
      zonas += `<rect x="${(i * paso).toFixed(1)}" y="0" width="${paso.toFixed(1)}" height="${base}" fill="transparent" data-cat="anio" data-val="${r.y}" style="cursor:pointer"><title>Ver publicaciones de ${r.y}</title></rect>`
    })
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H + 14}px" role="img" aria-label="Índice h acumulado y citas por año de publicación">
      <line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="#e6e9e1"/>${barras}
      <polyline points="${pts.join(' ')}" fill="none" stroke="#1e6b14" stroke-width="2.2"/>${puntos}${ejeAnios(serie, paso, base)}${zonas}</svg>`
  }
  // Carriles por rol: una fila por posición en la firma y una burbuja por año, con el tamaño
  // según el número de publicaciones. Clic en una burbuja: publicaciones de ese rol y año.
  function svgRoles(serie) {
    // Ancho de trabajo ajustado a la pantalla para que los textos se vean a su tamaño real.
    // En pantallas angostas el nombre del rol va encima de su carril y no a la izquierda.
    const n = serie.length
    const W = Math.max(280, Math.min(1080, ((document.documentElement || {}).clientWidth || 640) - 90))
    const compacto = W < 460
    const L = compacto ? 10 : 74, carril = compacto ? 60 : 46, top = compacto ? 44 : 26
    const H = top + 2 * carril + 44, paso = (W - L - 6) / n
    const maxV = Math.max(1, ...serie.flatMap(r => [r.primero, r.medio, r.ultimo]))
    const roles = ['primero', 'medio', 'ultimo'], et = { primero: 'Primer autor', medio: 'Intermedio', ultimo: 'Último autor' }
    // una etiqueta de año cada k columnas, contando desde el último año, para que no se pisen
    const k = Math.max(1, Math.ceil(36 / paso))
    let s = ''
    roles.forEach((rol, r) => {
      const y = top + r * carril
      s += `<line x1="${L}" y1="${y}" x2="${W - 4}" y2="${y}" stroke="#e6e9e1"/>`
      s += compacto
        ? `<text x="${L}" y="${y - 24}" font-size="11" font-weight="600" fill="#4f5a44">${et[rol]}</text>`
        : `<text x="${L - 8}" y="${y + 4}" font-size="11" font-weight="600" text-anchor="end" fill="#4f5a44">${et[rol]}</text>`
      serie.forEach((d, i) => {
        const v = d[rol]
        if (!v) return
        const cx = L + i * paso + paso / 2, rad = Math.max(4, Math.min(7 + 11 * Math.sqrt(v / maxV), paso / 2 - 1))
        s += `<circle cx="${cx.toFixed(1)}" cy="${y}" r="${rad.toFixed(1)}" fill="${ROL_COL[rol]}" fill-opacity="${d.y >= ANIO_ACTUAL ? .5 : .9}" data-cat="rolAnio" data-val="${d.y}|${rol}" style="cursor:pointer"><title>${d.y} · ${ROL_ET[rol]}: ${v}</title></circle>`
        if (rad >= 7.5) s += `<text x="${cx.toFixed(1)}" y="${y + 4}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" style="pointer-events:none">${v}</text>`
      })
    })
    const yEje = top + 2 * carril + 34
    serie.forEach((d, i) => {
      if ((n - 1 - i) % k) return
      s += `<text x="${(L + i * paso + paso / 2).toFixed(1)}" y="${yEje}" font-size="10" text-anchor="middle" fill="${d.y >= ANIO_ACTUAL ? '#c07a12' : '#98a18d'}">${d.y}${d.y >= ANIO_ACTUAL ? '*' : ''}</text>`
    })
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Rol de autoría por año">${s}</svg>`
  }
  function svgCalidad(serie) {
    const n = serie.length, W = Math.max(320, n * 38), H = 190, base = H - 26, top = 20
    const paso = W / n, bw = Math.min(24, paso - 10)
    const yP = v => base - (v / 100) * (base - top)
    let s = `<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="#e6e9e1"/>
      <line x1="0" y1="${yP(50).toFixed(1)}" x2="${W}" y2="${yP(50).toFixed(1)}" stroke="#d9dccf" stroke-dasharray="4 3"/>
      <text x="2" y="${(yP(50) - 3).toFixed(1)}" font-size="10" fill="#98a18d">50%</text>`
    const pts = []
    serie.forEach((r, i) => {
      if (!r.nq) return
      const pct = 100 * r.q12 / r.nq, x = i * paso + (paso - bw) / 2, cx = i * paso + paso / 2
      s += `<rect x="${x.toFixed(1)}" y="${yP(pct).toFixed(1)}" width="${bw}" height="${Math.max(pct ? 1 : 0, base - yP(pct)).toFixed(1)}" rx="3" fill="#4aab30" fill-opacity="${r.y >= ANIO_ACTUAL ? .3 : .6}"><title>${r.y}: ${r.q12} de ${r.nq} publicaciones con cuartil están en Q1 o Q2</title></rect>`
      s += `<text x="${cx.toFixed(1)}" y="${(yP(pct) - 4).toFixed(1)}" font-size="10" text-anchor="middle" fill="#6b7563" stroke="#fff" stroke-width="2.4" paint-order="stroke">${Math.round(pct)}%</text>`
      if (r.q12) s += `<rect x="${(i * paso).toFixed(1)}" y="0" width="${paso.toFixed(1)}" height="${base}" fill="transparent" data-cat="cuartilAnio" data-val="${r.y}|Q12" style="cursor:pointer"><title>Ver las publicaciones en Q1 o Q2 de ${r.y}</title></rect>`
      pts.push(`${cx.toFixed(1)},${yP(pct).toFixed(1)}`)
    })
    if (pts.length > 1) s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#1e6b14" stroke-width="2.2"/>`
    pts.forEach(pt => { const [px, py] = pt.split(','); s += `<circle cx="${px}" cy="${py}" r="3" fill="#1e6b14" stroke="#fff" stroke-width="1.2" style="pointer-events:none"/>` })
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H + 14}px" role="img" aria-label="Porcentaje de publicaciones en Q1 y Q2 por año">${s}${ejeAnios(serie, paso, base)}</svg>`
  }

  function evolucionHTML(pubs, id) {
    const serie = serieAnual(pubs, id)
    if (!serie.length) return ''
    const per = partirPeriodos(pubs)
    const tot = pubs.length
    const nRol = r => pubs.filter(p => rolEnPub(p, id) === r).length
    const pct = (a, b) => b ? Math.round(100 * a / b) : 0
    const hFinal = serie[serie.length - 1].h
    const citas = serie.reduce((s, r) => s + r.c, 0)
    // liderazgo = primer o último autor, por periodo
    const lid = arr => arr.filter(p => rolEnPub(p, id) !== 'medio').length
    let notaRol = ''
    if (per) {
      const A = pubs.filter(p => p.y && p.y < per.corte), B = pubs.filter(p => p.y && p.y >= per.corte)
      const la = pct(lid(A), A.length), lb = pct(lid(B), B.length)
      notaRol = `<span>Lidera (primer o último autor) <b>${la}%</b> en ${per.etA} y <b>${lb}%</b> en ${per.etB}</span>`
    }
    const q12 = serie.reduce((s, r) => s + r.q12, 0), nq = serie.reduce((s, r) => s + r.nq, 0)
    let notaQ = ''
    if (per) {
      const A = serie.filter(r => r.y < per.corte), B = serie.filter(r => r.y >= per.corte)
      const f = arr => { const a = arr.reduce((s, r) => s + r.q12, 0), b = arr.reduce((s, r) => s + r.nq, 0); return b ? pct(a, b) + '%' : 'N/D' }
      notaQ = `<span>Q1 y Q2: <b>${f(A)}</b> en ${per.etA} y <b>${f(B)}</b> en ${per.etB}</span>`
    }
    const parcial = serie.some(r => r.y >= ANIO_ACTUAL)
    const ast = parcial ? `<span><em>* Año en curso: cifra parcial.</em></span>` : ''
    return `<div class="panel panel-evo"><h3>Evolución en el tiempo</h3>
      <div class="top-tabs" style="margin-bottom:12px">
        <button type="button" class="top-tab evo-tab on" data-evo="h">${ico('trayectoria')}<span>Índice h y citas</span></button>
        <button type="button" class="top-tab evo-tab" data-evo="rol">${ico('rol')}<span>Rol de autoría</span></button>
        <button type="button" class="top-tab evo-tab" data-evo="q">${ico('calidad')}<span>Calidad de las revistas</span></button>
      </div>
      <div class="evo-pane" data-evo="h">
        <div class="evo-tit">Índice h acumulado (línea verde) y citas de las publicaciones de cada año (barras)</div>
        ${svgHCitas(serie)}
        <div class="info-anios"><span>Índice h al cierre <b>${hFinal}</b></span><span>Citas <b>${num(citas)}</b></span>${ast}</div>
        <div class="ctx-hint">El índice h de cada año usa las publicaciones hasta ese año con sus citas actuales en Scopus, y las barras suman las citas que hoy tienen las publicaciones de ese año. Scopus no entrega el historial de citas año a año.</div>
      </div>
      <div class="evo-pane" data-evo="rol" style="display:none">
        <div class="evo-tit">Publicaciones por año según el lugar del investigador en la firma</div>
        ${svgRoles(serie)}
        <div class="evo-leyenda">${['primero', 'medio', 'ultimo'].map(r => `<span data-cat="rol" data-val="${r}" style="cursor:pointer" title="Ver estas publicaciones"><i style="background:${ROL_COL[r]}"></i>${ROL_ET[r]} <b>${nRol(r)}</b> (${pct(nRol(r), tot)}%)</span>`).join('')}</div>
        <div class="info-anios">${notaRol}${ast}</div>
        ${LA_DISP ? '' : '<div class="ctx-hint">El último autor se estima por el apellido en la lista de firmantes; se afina al regenerar los datos del sitio.</div>'}
        <div class="ctx-hint">Clic en una burbuja para ver las publicaciones de ese año y rol.</div>
      </div>
      <div class="evo-pane" data-evo="q" style="display:none">
        <div class="evo-tit">Porcentaje de publicaciones en revistas Q1 o Q2 de cada año</div>
        ${svgCalidad(serie)}
        <div class="info-anios"><span>Q1 y Q2 en total: <b>${nq ? pct(q12, nq) + '%' : 'N/D'}</b> (${q12} de ${nq})</span>${notaQ}${ast}</div>
        <div class="ctx-hint">Solo cuentan las publicaciones con cuartil SJR (Q1 a Q4); ponencias, capítulos y libros quedan fuera. Clic en una barra para ver sus publicaciones Q1 y Q2.</div>
      </div>
    </div>`
  }
  function wireEvolucion() {
    const tabs = [...document.querySelectorAll('.evo-tab')]
    const panes = [...document.querySelectorAll('.evo-pane')]
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.toggle('on', x === t))
      panes.forEach(p => { p.style.display = p.dataset.evo === t.dataset.evo ? '' : 'none' })
    }))
  }

  // ---------- evolución temática por periodos ----------
  function evolucionTemasHTML(pubs) {
    const per = partirPeriodos(pubs)
    if (!per) return ''
    const A = pubs.filter(p => p.y && p.y < per.corte), B = pubs.filter(p => p.y && p.y >= per.corte)
    const cuenta = arr => { const m = {}; arr.forEach(p => new Set(p.a || []).forEach(x => { m[x] = (m[x] || 0) + 1 })); return m }
    const cA = cuenta(A), cB = cuenta(B)
    const filas = [...new Set([...Object.keys(cA), ...Object.keys(cB)])].map(ar => {
      const a = cA[ar] || 0, b = cB[ar] || 0
      return { ar, a, b, pa: 100 * a / A.length, pb: 100 * b / B.length }
    }).sort((x, y) => (y.a + y.b) - (x.a + x.b)).slice(0, 14)
    if (!filas.length) return ''
    filas.forEach(f => { f.d = f.pb - f.pa })
    const maxP = Math.max(1, ...filas.map(f => Math.max(f.pa, f.pb)))
    const chip = f => f.a === 0 ? '<span class="tev-chip nuevo">Nuevo</span>'
      : f.b === 0 ? '<span class="tev-chip abandona">Sin actividad reciente</span>'
        : f.d >= 5 ? `<span class="tev-chip sube">▲ +${Math.round(f.d)} pp</span>`
          : f.d <= -5 ? `<span class="tev-chip baja">▼ ${Math.round(f.d)} pp</span>`
            : '<span class="tev-chip igual">Estable</span>'
    return `<div class="evo-leyenda"><span><i style="background:#9ccf7e"></i>${per.etA} (${per.nA} pub.)</span><span><i style="background:#1e6b14"></i>${per.etB} (${per.nB} pub.)</span></div>
      <div class="tev-lista">${filas.map(f => `<div class="tev-fila" data-cat="area" data-val="${esc(f.ar)}" style="cursor:pointer" title="Ver las publicaciones de esta área">
        <span class="tev-n">${esc(f.ar)}&nbsp;<small class="tev-tot" title="Publicaciones en esta área">${f.a + f.b}</small></span>
        <span class="tev-b"><i class="a" style="width:${(100 * f.pa / maxP).toFixed(1)}%"></i><i class="b" style="width:${(100 * f.pb / maxP).toFixed(1)}%"></i></span>
        <span class="tev-p">${Math.round(f.pa)}% → ${Math.round(f.pb)}%</span>${chip(f)}</div>`).join('')}</div>
      <div class="ctx-hint">Cada barra es el porcentaje de las publicaciones del periodo que pertenecen al área (una publicación puede tener varias). pp: puntos porcentuales de cambio. Ordenado por número de publicaciones del área.</div>`
  }

  // Un solo panel con tres vistas: áreas temáticas (con su cambio entre periodos, o barras
  // simples si no hay años suficientes para partir el historial), frases frecuentes de los
  // títulos y las fuentes (revistas y conferencias) donde ha publicado.
  function temasFuentesHTML(pubs, areas, nFuentes) {
    const tev = evolucionTemasHTML(pubs)
    const fr = frasesTitulos(pubs)
    const vacio = t => `<div style="color:var(--texto3);font-size:var(--fs-sm)">${t}</div>`
    const tabs = [
      ['areas', 'area', 'Áreas temáticas'],
      ...(fr.length ? [['frases', 'tema', 'Frases frecuentes']] : []),
      ['fuentes', 'fuente', 'Fuentes (' + nFuentes + ')'],
    ]
    const panes = {
      areas: tev || areasBarras(areas),
      frases: fr.length ? `<div class="ayuda-filtros" style="margin:0 0 10px">Expresiones que más se repiten en los títulos de sus publicaciones. Clic en una para ver cuáles son.</div>${frasesHTML(fr)}` : '',
      fuentes: nFuentes
        ? '<div class="revistas" id="revCont"></div><div class="paginacion" id="revPager"></div>'
        : vacio('Sin datos de revistas o conferencias.'),
    }
    return `<div class="panel panel-tev panel-fuentes" style="margin-bottom:18px"><h3>Temas y fuentes de publicación</h3>
      <div class="top-tabs" style="margin-bottom:12px">${tabs.map(([k, ic, et]) =>
        `<button type="button" class="top-tab tf-tab" data-tf="${k}">${ico(ic)}<span>${et}</span></button>`).join('')}</div>
      ${tabs.map(([k]) => `<div class="tf-pane" data-tf="${k}">${panes[k]}</div>`).join('')}</div>`
  }

  // ---------- publicaciones destacadas ----------
  const MEDIA_ANIO = (() => {
    const s = {}, n = {}
    D.pubs.forEach(p => { if (p.y) { s[p.y] = (s[p.y] || 0) + (p.c || 0); n[p.y] = (n[p.y] || 0) + 1 } })
    const m = {}
    Object.keys(s).forEach(y => { m[y] = s[y] / n[y] })
    return m
  })()
  const claveFecha = p => p.d || ((p.y || 0) + '-00-00')
  function destacadasPubs(ps, id) {
    if (ps.length < 2) return []
    // Cada categoría toma a su ganadora real, sin saltarse publicaciones ya usadas. Si una misma
    // publicación gana varias categorías, se muestra una sola vez con las etiquetas juntas.
    const cand = []
    const porCitas = [...ps].filter(p => (p.c || 0) > 0).sort((a, b) => (b.c || 0) - (a.c || 0) || (b.y || 0) - (a.y || 0))
    const rec = [...ps].sort((a, b) => claveFecha(b).localeCompare(claveFecha(a)))
    const poner = (et, ic, p, extra) => { if (p) cand.push({ et, ic, p, extra: extra ? extra(p) : '' }) }
    poner('Más citada', 'citas', porCitas[0])
    const q1 = rec.filter(p => p.q === 'Q1')
    if (q1.length) poner('Más reciente en Q1', 'reciente', q1[0])
    else poner('Más reciente en Q2', 'reciente', rec.find(p => p.q === 'Q2'))
    const rel = [...ps].filter(p => (p.c || 0) >= 3 && MEDIA_ANIO[p.y] > 0)
      .sort((a, b) => (b.c / MEDIA_ANIO[b.y]) - (a.c / MEDIA_ANIO[a.y]))
    poner('Mayor impacto relativo', 'ritmo', rel[0],
      p => `${dec(p.c / MEDIA_ANIO[p.y], 1)} veces el promedio de citas de las publicaciones UTM de ${p.y}`)
    poner('Más citada como primer autor', 'rol', porCitas.find(p => rolEnPub(p, id) === 'primero'))
    const res = []
    cand.forEach(c => {
      const previa = res.find(r => r.p === c.p)
      if (previa) { previa.ets.push(c.et); if (c.extra && !previa.extra) previa.extra = c.extra }
      else res.push({ ets: [c.et], ic: c.ic, p: c.p, extra: c.extra })
    })
    res.forEach(r => {
      const ets = r.ets.includes('Más citada') && r.ets.includes('Más citada como primer autor')
        ? ['Más citada y como primer autor', ...r.ets.filter(e => e !== 'Más citada' && e !== 'Más citada como primer autor')]
        : r.ets
      r.et = ets.join(' · ')
    })
    return res
  }
  function destacadasHTML(ps, id) {
    const d = destacadasPubs(ps, id)
    if (d.length < 2) return ''
    return `<div class="panel panel-dest"><h3>Publicaciones destacadas</h3><div class="dest-grid">${d.map(x => {
      const p = x.p
      const t = p.doi ? `<a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noreferrer">${esc(p.t)}</a>` : esc(p.t)
      return `<div class="dest-card"><div class="dest-et">${ico(x.ic)}<span>${esc(x.et)}</span></div>
        <div class="dest-t">${t}</div>
        <div class="dest-m">${p.y || 'N/D'} · ${esc(p.j || 'N/D')} · ${badgeQ(p.q)} · ${num(p.c)} citas</div>
        ${x.extra ? `<div class="dest-x">${esc(x.extra)}</div>` : ''}</div>`
    }).join('')}</div>
      <div class="ctx-hint">Selección automática dentro de la ventana de análisis elegida.</div></div>`
  }

  // ---------- indicadores de calidad (los usa el resumen del CV) ----------
  function indicadoresCalidad(ps) {
    const c = ps.reduce((s, p) => s + (p.c || 0), 0)
    const nq = ps.filter(p => CUARTILES.includes(p.q)).length
    return { cp: ps.length ? c / ps.length : 0, q1: nq ? 100 * ps.filter(p => p.q === 'Q1').length / nq : null,
      q12: nq ? 100 * ps.filter(p => p.q === 'Q1' || p.q === 'Q2').length / nq : null,
      oa: ps.length ? 100 * ps.filter(esAbierto).length / ps.length : 0, nq }
  }
  // ---------- aviso de perfil incompleto ----------
  function avisoPerfilHTML(a, todasPubs) {
    const av = []
    if (D.autores.some(x => x.or) && !a.or) {
      av.push('Falta el ORCID. Cree su ORCID en orcid.org y vincúlelo a su perfil de Scopus desde el asistente de correcciones de Scopus (Author Feedback Wizard).')
    }
    const fx = a.fx || []
    if (fx.length) {
      av.push(`Tiene ${fx.length + 1} IDs de Scopus (${[a.id, ...fx].join(', ')}) unificados por este portal. Para que Scopus también los una, solicite la fusión de perfiles en el Author Feedback Wizard.`)
    }
    const ret = todasPubs.filter(p => p.r)
    if (ret.length) {
      const revs = [...new Set(ret.map(p => p.j).filter(Boolean))].slice(0, 3).join('; ')
      av.push(`${ret.length} publicaci${ret.length === 1 ? 'ón está' : 'ones están'} en revistas retiradas de Scopus${revs ? ` (${revs})` : ''}. Conviene revisarlas, porque pueden dejar de contar en evaluaciones.`)
    }
    if (!av.length) return ''
    return `<details class="aviso-perfil"><summary>${ico('alerta')}<span>Perfil por completar (${av.length} aviso${av.length === 1 ? '' : 's'})</span></summary>
      <ul>${av.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>`
  }

  // ---------- mapa de colaboración internacional ----------
  let MAPA_OK = null
  // Corrige los polígonos que cruzan el meridiano 180 (Rusia, Fiyi): se parten donde el trazo salta de un borde a otro.
  function mapaLimpio() {
    if (MAPA_OK) return MAPA_OK
    const M = window.MAPA_MUNDO
    if (!M || !M.paises) return null
    const out = {}
    Object.entries(M.paises).forEach(([iso, d]) => {
      out[iso] = d.split('Z').filter(s => s.trim()).map(sub => {
        const pts = [...sub.matchAll(/([-\d.]+) ([-\d.]+)/g)].map(m => [+m[1], +m[2]])
        const trozos = []; let cur = []
        pts.forEach((pt, i) => {
          if (i && Math.abs(pt[0] - pts[i - 1][0]) > 540) { trozos.push(cur); cur = [] }
          cur.push(pt)
        })
        trozos.push(cur)
        return trozos.filter(t => t.length > 2).map(t => 'M' + t.map(q => q[0] + ' ' + q[1]).join('L') + 'Z').join('')
      }).join('')
    })
    return (MAPA_OK = { w: M.w, h: M.h, paises: out })
  }
  function mapaColab(px) {
    const M = mapaLimpio()
    if (!M) return '<div style="color:var(--texto3);font-size:var(--fs-sm)">El mapa no está disponible.</div>'
    const hit = {}, fuera = []
    px.forEach(([pais, n]) => {
      const iso = PAIS_ISO[pais]
      if (iso && M.paises[iso]) hit[iso] = { pais, n }
      else fuera.push([pais, n])
    })
    const max = Math.max(1, ...px.map(x => x[1]))
    const ESC = ['#d7ecc9', '#b4dc97', '#86c466', '#4fa23a', '#1e6b14']
    const col = n => ESC[Math.min(4, Math.floor(Math.sqrt(n / max) * 5 - 1e-9))]
    let base = '', sobre = ''
    Object.entries(M.paises).forEach(([iso, d]) => {
      const h = hit[iso]
      if (h) sobre += `<path d="${d}" fill="${col(h.n)}" stroke="#fff" stroke-width=".6" data-cat="pais" data-val="${esc(h.pais)}" style="cursor:pointer"><title>${esc(h.pais)}: ${h.n} pub. conjunta${h.n === 1 ? '' : 's'}</title></path>`
      else base += `<path d="${d}" fill="#eceee7" stroke="#fff" stroke-width=".6"/>`
    })
    return `<div class="mapa-colab"><svg viewBox="0 0 ${M.w} ${M.h}" width="100%" role="img" aria-label="Mapa de países de los coautores">${base}${sobre}</svg>
      <div class="mapa-leyenda"><span>1 pub.</span><span class="mapa-barra">${ESC.map(c => `<i style="background:${c}"></i>`).join('')}</span><span>${max} pub.</span>
      <em>Clic en un país para ver las publicaciones conjuntas.</em></div>
      </div>`
  }

  // ---------- resumen para el PDF del perfil (solo al imprimir) ----------
  function qrSvg(url) {
    try {
      if (!window.qrcode) return ''
      const q = window.qrcode(0, 'M')
      q.addData(url); q.make()
      return q.createSvgTag(4, 0)
    } catch (e) { return '' }
  }
  function cvResumenHTML(a, r) {
    const url = location.href.split('#')[0] + '#/autor/' + encodeURIComponent(a.id)
    const celdas = [
      ['Publicaciones', num(r.P)], ['Citas', num(r.C)], ['Índice h', r.h], ['Índice i10', r.i10],
      ['Índice g', r.g], ['Citas / pub.', dec(r.CP, 2)], ['Índice m', dec(r.m, 2)], ['Acceso abierto', r.oa + '%'],
      ['En Q1 o Q2', r.q12 == null ? 'N/D' : Math.round(r.q12) + '%'], ['Primer autor', r.pfa + '%'],
      ['Autores / pub.', r.apu == null ? 'N/D' : dec(r.apu, 1)], ['Países de coautoría', r.paises],
    ]
    const qr = qrSvg(url)
    return `<div class="cv-resumen">
      <div class="cv-datos"><div class="cv-tit">Resumen de indicadores · ${esc(r.ventana)}</div>
        <div class="cv-grid">${celdas.map(([e, v]) => `<div><b>${v}</b><span>${e}</span></div>`).join('')}</div>
        ${r.fuentes ? `<div class="cv-linea"><b>Principales fuentes:</b> ${esc(r.fuentes)}</div>` : ''}
        ${r.areas ? `<div class="cv-linea"><b>Áreas:</b> ${esc(r.areas)}</div>` : ''}
        ${D.fecha ? `<div class="cv-linea cv-fuente">Datos de Scopus al ${esc(String(D.fecha).split(' ')[0])}</div>` : ''}</div>
      ${qr ? `<div class="cv-qr"><div class="cv-qr-img">${qr}</div><span>Perfil en línea</span></div>` : ''}</div>`
  }

  // ---------- perfil ----------
  function renderPerfil(id, mantenerScroll) {
    const a = porId.get(id)
    if (!a) {
      perfilPubs = null
      aplicarFiltroCtxPubs = null
      app.innerHTML = `<div class="wrap"><a class="volver" href="#/">← Volver a la página principal</a>
        <div class="panel"><div class="vacio">Investigador no encontrado.</div></div></div>`
      return
    }
    // Al entrar (o pegar un enlace) el periodo viene de la URL; al cambiar de pestaña ya está en estado.
    if (!mantenerScroll) {
      const per0 = paramsHash().get('per')
      estado.periodoPerfil = per0 === '5a' || per0 === 'actual' ? per0 : 'todo'
    }
    estado.perfilId = id
    const per = estado.periodoPerfil || 'todo'
    const todasPubs = (D.porAutor[id] || []).map(i => D.pubs[i]).filter(Boolean)
    const n5a = todasPubs.filter(p => (p.y || 0) >= ANIO_ACTUAL - 4).length
    const nAct = todasPubs.filter(p => (p.y || 0) >= ANIO_ACTUAL).length
    const pubs = per === '5a'
      ? todasPubs.filter(p => (p.y || 0) >= ANIO_ACTUAL - 4)
      : per === 'actual'
        ? todasPubs.filter(p => (p.y || 0) >= ANIO_ACTUAL)
        : todasPubs

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

    // Métricas y colaboración externa adaptadas a la ventana temporal activa
    let kP = a.P, kC = a.C, kH = a.h, kCP = a.CP, kI10 = a.i10, kG = a.g ?? 0, kM = a.m ?? 0
    let mApu = a.apu, mPfa = a.pfa ?? 0, mCc = a.cc ?? 0
    let extData = { cx: a.cx || [], ix: a.ix || [], px: a.px || [] }
    const etPer = per === '5a' ? `${ANIO_ACTUAL - 4} a ${ANIO_ACTUAL}` : `Año ${ANIO_ACTUAL}`
    if (per !== 'todo') {
      kP = pubs.length
      const citOrd = pubs.map(p => p.c || 0).sort((x, y) => y - x)
      kC = citOrd.reduce((s, v) => s + v, 0)
      kH = 0
      for (let i = 0; i < citOrd.length; i++) if (citOrd[i] >= i + 1) kH = i + 1
      kG = 0
      let acum = 0
      for (let i = 0; i < citOrd.length; i++) { acum += citOrd[i]; if (acum >= (i + 1) * (i + 1)) kG = i + 1 }
      kI10 = citOrd.filter(c => c >= 10).length
      kCP = kP ? kC / kP : 0
      const ys = pubs.map(p => p.y).filter(Boolean)
      const tray = ys.length ? Math.max(1, ANIO_ACTUAL - Math.min(...ys) + 1) : 1
      kM = kH / tray
      const sumAut = pubs.reduce((s, p) => s + (p.nc || (p.au || []).length || 1), 0)
      mApu = kP ? sumAut / kP : null
      const nFirst = pubs.filter(p => String(p.fa || (p.u || [])[0] || '') === String(id)).length
      mPfa = kP ? Math.round(100 * nFirst / kP) : 0
      const nCit = pubs.filter(p => (p.c || 0) > 0).length
      mCc = kP ? (100 * nCit / kP) : 0
      const nomMap = new Map((a.cx || []).map(([cid, nom]) => [String(cid), nom]))
      const extNom = D.extNombres || {}
      const mCx = {}, mIx = {}, mPx = {}
      pubs.forEach(p => {
        ;(p.xa || []).forEach(xid => {
          const sx = String(xid)
          if (nomMap.has(sx) || extNom[sx]) mCx[sx] = (mCx[sx] || 0) + 1
        })
        ;(p.pi || []).forEach(inst => { mIx[inst] = (mIx[inst] || 0) + 1 })
        ;(p.pc || []).forEach(pais => { mPx[pais] = (mPx[pais] || 0) + 1 })
      })
      extData = {
        cx: Object.entries(mCx).map(([cid, n]) => [cid, nomMap.get(cid) || extNom[cid] || cid, n]).sort((x, y) => y[2] - x[2]),
        ix: Object.entries(mIx).sort((x, y) => y[1] - x[1]),
        px: Object.entries(mPx).sort((x, y) => y[1] - x[1]),
      }
    }
    const subRank = (puestoHist, textoAlt) => {
      if (per === 'todo') return textoAlt || puestoTxt(puestoHist)
      return etPer
    }

    // consulta para búsquedas externas: "Nombres Apellido" (el dato viene como "Apellido, Nombres")
    const orcid = encodeURIComponent(
      (a.n || '').includes(',')
        ? `${a.n.split(',').slice(1).join(' ').trim()} ${a.n.split(',')[0].trim()}`
        : (a.n || ''))

    const indC = indicadoresCalidad(pubs)
    const resumenCv = {
      P: kP, C: kC, h: kH, i10: kI10, g: kG, CP: kCP, m: kM, oa: pctOA, q12: indC.q12, pfa: mPfa, apu: mApu,
      paises: extData.px.length, ventana: per === 'todo' ? 'todo el historial' : etPer,
      fuentes: revistas.slice(0, 3).map(r => r[0]).join('; '), areas: areas.slice(0, 4).map(x => x[0]).join('; '),
    }
    const scrollPrev = mantenerScroll ? window.scrollY : 0
    app.innerHTML = `<div class="wrap">
      <a class="volver" href="#/">← Volver a la página principal</a>
      <div class="perfil-hero">
        ${avatar(a)}
        <div style="flex:1;min-width:240px">
          <h1>${esc(a.n)}</h1>
          ${a.xu ? `<div class="ex-utm" title="Conserva su producción con filiación UTM, pero su afiliación actual en Scopus ya no es la UTM.">⚑ Sin afiliación vigente con la Universidad Técnica de Manabí.</div>` : ''}
          <div class="sub">Autor UTM en Scopus · Activo ${a.pa || 'N/D'} a ${a.ua || 'N/D'}${a.rP ? ` · Puesto ${a.rP} en publicaciones en la UTM` : ''}</div>
          ${idsScopusHTML(a)}
          <div class="pie-print-ficha">Dirección de Investigación · Observatorio de Investigadores de la Universidad Técnica de Manabí, parte del proyecto de investigación <b>ObservaIA</b></div>
          <div class="enlaces">
            <a class="btn-ext" href="https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(a.id)}" target="_blank" rel="noreferrer">${ico('scopus')}<span>Perfil en Scopus ↗</span></a>
            ${a.or
        ? `<a class="btn-ext" href="https://orcid.org/${esc(a.or)}" target="_blank" rel="noreferrer">${ico('orcid')}<span>ORCID ${esc(a.or)} ↗</span></a>`
        : `<a class="btn-ext" href="https://orcid.org/orcid-search/search?searchQuery=${orcid}" target="_blank" rel="noreferrer">${ico('orcid')}<span>Buscar en ORCID ↗</span></a>`}
            <a class="btn-ext" href="https://scholar.google.com/citations?view_op=search_authors&mauthors=${orcid}" target="_blank" rel="noreferrer">${ico('scholar')}<span>Buscar en Google Scholar ↗</span></a>
            <a class="btn-ext" href="https://www.researchgate.net/search/researcher?q=${orcid}" target="_blank" rel="noreferrer">${ico('rg')}<span>Buscar en ResearchGate ↗</span></a>
            <button type="button" class="btn-ext btn-print" id="btnPrintPerfil" title="Imprimir o guardar ficha en PDF, con resumen de indicadores y código QR">${ico('print')}<span>Imprimir / PDF</span></button>
            <button type="button" class="btn-ext" data-copiar-enlace="1" title="Copia el enlace de esta vista, con el periodo y los filtros activos">${ico('enlace')}<span>Copiar enlace</span></button>
          </div>
        </div>
      </div>

      ${avisoPerfilHTML(a, todasPubs)}
      ${cvResumenHTML(a, resumenCv)}
      <div class="periodo-bar" role="tablist" aria-label="Ventana temporal del perfil">
        <span class="periodo-et">Ventana de análisis:</span>
        <div class="top-tabs">
          <button type="button" class="top-tab per-tab${per === 'todo' ? ' on' : ''}" data-per="todo">${ico('historial')}<span>Todo el historial (${todasPubs.length})</span></button>
          <button type="button" class="top-tab per-tab${per === '5a' ? ' on' : ''}" data-per="5a">${ico('g')}<span>Últimos 5 años · ${ANIO_ACTUAL - 4} a ${ANIO_ACTUAL} (${n5a})</span></button>
          <button type="button" class="top-tab per-tab${per === 'actual' ? ' on' : ''}" data-per="actual">${ico('fecha')}<span>Año ${ANIO_ACTUAL} (${nAct})</span></button>
        </div>
      </div>

      <div class="kpis">
        ${kpi(kP, 'Publicaciones', subRank(a.rP), AY.P)}
        ${kpi(num(kC), 'Citas', subRank(a.rC), AY.C)}
        ${kpi(kH, 'Índice h', subRank(a.rH), AY.h)}
        ${kpi(dec(kCP, 2), 'Citas / pub.', subRank(R.CP, R.CP ? puestoTxt(R.CP) : `Mín. ${MIN_PUBS_CP} pub. para puesto`), AY.CP)}
        ${kpi(kI10, 'Índice i10', subRank(R.i10), AY.i10)}
        ${kpi(kG, 'Índice g', subRank(R.g), AY.g)}
        ${kpi(dec(kM, 2), 'Índice m', subRank(R.m), AY.m)}
        ${kpi(pctOA + '%', 'Acceso abierto', subRank(R.oa), AY.oa)}
      </div>
      ${destacadasHTML(pubs, a.id)}

      <div class="grid2">
        <div class="panel"><h3>Publicaciones por año</h3>${barsAnio(porAnio)}${infoAnios(porAnio)}
          <div class="ctx-hint">Clic en una barra para ver las publicaciones de ese año.</div></div>
        <div class="panel"><h3>Distribución por cuartil SJR y tipo</h3>${donut(cq)}
          <div class="subtitulo-panel">Por tipo de documento</div>${tiposBarras(ct)}
          <div class="metricas-autoria">
            <div class="ma"><b>${mApu == null ? 'N/D' : dec(mApu, 1)}</b><span>Autores por publicación (promedio)</span></div>
            <div class="ma"><b>${mPfa}%</b><span>Publicaciones como primer autor</span></div>
            <div class="ma"><b>${dec(mCc, 1)}%</b><span>Publicaciones con al menos 1 cita</span></div>
          </div>
          <div class="ctx-hint">Clic en un cuartil o tipo para ver sus publicaciones.</div></div>
      </div>

      ${evolucionHTML(pubs, a.id)}

      ${temasFuentesHTML(pubs, areas, revistas.length)}

      <div class="panel" style="margin-bottom:18px"><h3>Coautorías</h3>${coautoriaExterna(extData, coaut.length, a.n)}</div>

      ${panelPubsHTML('Publicaciones', pubs.length, true, a.id)}
    </div>
    ${TOP_PAGE_HTML}`

    if (mantenerScroll) window.scrollTo(0, scrollPrev)

    const btnPr = document.getElementById('btnPrintPerfil')
    if (btnPr) btnPr.addEventListener('click', () => {
      window.dispatchEvent(new Event('beforeprint'))
      window.print()
    })
    document.querySelectorAll('.per-tab').forEach(b => b.addEventListener('click', () => {
      if (estado.periodoPerfil === b.dataset.per) return
      estado.periodoPerfil = b.dataset.per
      const pr = paramsHash()
      if (b.dataset.per === 'todo') pr.delete('per'); else pr.set('per', b.dataset.per)
      fijarParams(pr)
      cerrarPop()
      renderPerfil(id, true)
    }))

    // Solo se marca la publicación número 1 en citas (cuando el autor tiene más de una),
    // para que la etiqueta en singular ("★ Más citada") sea exacta.
    const topCit = new Set(pubs.length > 1
      ? [...pubs].filter(p => (p.c || 0) > 0).sort((x, y) => (y.c || 0) - (x.c || 0)).slice(0, 1)
      : [])
    perfilPubs = pubs   // usado por el manejador delegado del popover
    wirePubs(pubsOrd, p => pubRow(p, topCit.has(p)), a.id, 'publicaciones-' + a.id, leerFiltrosURL())
    wireEvolucion()
    wireCopiarEnlace()
    const POR_PAG_PANEL = 10
    paginar('coautCont', 'coautPager', coaut, coautRow, POR_PAG_PANEL)
    paginar('revCont', 'revPager', revistas, revistaRow, POR_PAG_PANEL)
    if (extData.cx.length) paginar('ceCoautCont', 'ceCoautPager', extData.cx, coautExtRow, POR_PAG_PANEL)
    if (extData.ix.length) paginar('ceInstCont', 'ceInstPager', extData.ix, instRow, POR_PAG_PANEL)
    if (comStop) { comStop(); comStop = null }
    let comListo = false
    wireCoautExtTabs(key => { if (key === 'com' && !comListo) { comListo = true; wireComunidades(a, pubs) } })
    wireTemasTabs()
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
    if (top.length < 2) {
      canvas.style.display = 'none'
      wrap.classList.add('com-vacio')
      const zoom = wrap.querySelector('.com-zoom')
      if (zoom) zoom.style.display = 'none'
      if (vacio) vacio.style.display = 'flex'
      if (leyenda) leyenda.style.display = 'none'
      return
    }
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
    const vista = { k: 1, x: 0, y: 0 }
    const ctx = canvas.getContext('2d')
    const medir = (forzarW, forzarH) => {
      const nw = forzarW || wrap.clientWidth, nh = forzarH || wrap.clientHeight
      if (!nw || !nh) return false
      if (nw === W && nh === H) return false
      if (W > 0 && H > 0) {
        const dx = (nw - W) / 2, dy = (nh - H) / 2
        for (const n of nodos) { n.x += dx; n.y += dy }
        vista.x += dx * (1 - vista.k)
        vista.y += dy * (1 - vista.k)
      }
      W = nw; H = nh
      canvas.width = W * dpr; canvas.height = H * dpr
      return true
    }
    medir()
    const cx = () => W / 2, cy = () => H / 2
    nodos.forEach((n, i) => {
      if (n.centro) { n.x = cx(); n.y = cy() }
      else { const ang = 2 * Math.PI * i / nodos.length; n.x = cx() + Math.cos(ang) * Math.min(W, H) * 0.32; n.y = cy() + Math.sin(ang) * Math.min(W, H) * 0.32 }
      n.vx = 0; n.vy = 0
    })

    let alpha = 1, sobre = null, sel = null, grupoSel = null, arrastrando = null, paneando = false, raf = null, vivo = true
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
      // Reservar el círculo del nodo central para que ninguna etiqueta lo tape.
      const c0 = nodos[0]
      if (c0) {
        const cx0 = c0.x * vista.k + vista.x, cy0 = c0.y * vista.k + vista.y, r0 = c0.r * vista.k + 4
        rects.push([cx0 - r0, cy0 - r0, r0 * 2, r0 * 2])
      }
      const candidatos = nodos.map((_, k) => k).filter(conNombre)
        .sort((a, b) => ((nodos[b].centro || b === sobre || b === sel) ? 1 : 0) - ((nodos[a].centro || a === sobre || a === sel) ? 1 : 0))
      const aPintar = []
      for (const i of candidatos) {
        if (atenuadoDe(i)) continue
        const n = nodos[i]
        const destacado = n.centro || i === sobre || sel === i
        const gap = n.centro ? Math.max(12, n.r * vista.k + 11) : (n.r * vista.k + 7)
        const sx = n.x * vista.k + vista.x, sy = n.y * vista.k + vista.y - gap
        if (sx < 0 || sx > W || sy < 14 || sy > H) continue
        ctx.font = (destacado ? '600 ' : '') + '11px Montserrat, sans-serif'
        const txt = cortar(n.name), w = ctx.measureText(txt).width
        const padX = destacado ? 6 : 2, padTop = destacado ? 12 : 11, alto = destacado ? 17 : 13
        const box = [sx - w / 2 - padX, sy - padTop, w + padX * 2, alto]
        if (!destacado && rects.some(r => solapa(r, box))) continue
        rects.push(box)
        aPintar.push({ sx, sy, txt, destacado, box })
      }
      // Dibujar primero las etiquetas secundarias y al final las destacadas (con pastilla clara).
      for (const et of aPintar.reverse()) {
        if (et.destacado) {
          const [bx, by, bw, bh] = et.box
          ctx.beginPath()
          if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 5)
          else ctx.rect(bx, by, bw, bh)
          ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.fill()
          ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(23,34,15,0.18)'; ctx.stroke()
          ctx.font = '600 11px Montserrat, sans-serif'
          ctx.fillStyle = '#17220f'; ctx.fillText(et.txt, et.sx, et.sy)
        } else {
          ctx.font = '11px Montserrat, sans-serif'
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.92)'
          ctx.strokeText(et.txt, et.sx, et.sy)
          ctx.fillStyle = '#17220f'; ctx.fillText(et.txt, et.sx, et.sy)
        }
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
          return `<div class="com-pub"><div class="com-pt">${t}</div><div class="com-pm">${p.y || '—'} · ${adelM(p)}${esc(p.j || '—')} · ${badgeQ(p.q)} · ${num(p.c)} citas${ret}</div></div>`
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
    const centrarNodos = () => {
      if (!nodos.length || !W || !H) return
      const c0 = nodos[0]
      const dx = W / 2 - c0.x, dy = H / 2 - c0.y
      if (dx || dy) {
        for (const n of nodos) { n.x += dx; n.y += dy }
      }
    }
    const onResize = () => {
      if (medir()) { centrarNodos(); dibujar() }
      clearTimeout(rt)
      rt = setTimeout(() => recalienta(), 200)
    }
    const onBeforePrint = () => {
      clearTimeout(rt)
      const pw = Math.min(wrap.clientWidth || W, 660)
      const ph = wrap.clientHeight || H
      medir(pw, ph)
      while (alpha > 0.05) { paso(); alpha *= 0.95 }
      vista.k = 1; vista.x = 0; vista.y = 0
      centrarNodos()
      dibujar()
    }
    const onAfterPrint = () => {
      if (medir()) { centrarNodos(); dibujar() }
    }
    const mqlPrint = window.matchMedia ? window.matchMedia('print') : null
    const onPrintMedia = e => {
      if (e && e.matches) onBeforePrint()
      else onAfterPrint()
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      if (medir()) { centrarNodos(); dibujar() }
    }) : null
    if (ro) ro.observe(wrap)
    window.addEventListener('resize', onResize)
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    if (mqlPrint && mqlPrint.addEventListener) mqlPrint.addEventListener('change', onPrintMedia)

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
      if (ro) ro.disconnect()
      window.removeEventListener('mouseup', arriba)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
      if (mqlPrint && mqlPrint.removeEventListener) mqlPrint.removeEventListener('change', onPrintMedia)
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
      <div class="ctx-m">${p.y || ''} · ${adelM(p)}${esc(p.j || '—')} · ${badgeQ(p.q)} · ${num(p.c)} citas${retirada}</div></div>`
  }
  // popover flotante contextual (junto al cursor)
  let popEl = null
  const fueraPop = e => { if (popEl && !popEl.contains(e.target)) cerrarPop() }
  const escPop = e => { if (e.key === 'Escape') cerrarPop() }
  // País elegido (en el mapa o en la lista): se resalta en ambos mientras el menú contextual está abierto.
  function marcarPais(val) {
    document.querySelectorAll('[data-cat="pais"].sel').forEach(x => x.classList.remove('sel'))
    if (val == null) return
    document.querySelectorAll('[data-cat="pais"]').forEach(x => {
      if (x.getAttribute('data-val') !== val) return
      x.classList.add('sel')
      if (x.tagName.toLowerCase() === 'path' && x.parentNode) x.parentNode.appendChild(x)
    })
  }
  function cerrarPop() {
    marcarPais(null)
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
    return `<div class="ctx-row" style="display:flex;justify-content:space-between;gap:10px;align-items:center">
      ${nombre}
      <span class="ctx-aut-n">${a.n} pub.</span></div>`
  }
  function mostrarPopover(ev, titulo, lista, color, autores, autoresUtm, opts) {
    cerrarPop()
    color = color || '#2e8a1f'
    opts = opts || {}
    const sub = opts.sub || 'Detalle de publicaciones'
    const valorHtml = opts.valorHtml || esc(titulo)
    const iconoHtml = opts.iconoHtml || ico('recientes')
    const orden = [...lista].sort((a, b) => {
      const ka = a.d || ((a.y || 0) + '-00-00'), kb = b.d || ((b.y || 0) + '-00-00')
      return ka < kb ? 1 : ka > kb ? -1 : 0
    })
    const cap = 10, vis = orden.slice(0, cap)
    const pubsBody = vis.length ? vis.map(ctxRow).join('') : '<div class="ctx-m">Sin publicaciones.</div>'
    popEl = document.createElement('div')
    popEl.className = 'popover-ctx'
    const conAutores = autores && autores.length
    const conUtm = autoresUtm && autoresUtm.length
    const badgeTxt = `${lista.length} pub.${lista.length > cap && !conAutores && !conUtm ? ` · últ. ${cap}` : ''}`
    const cabHtml = `<div class="pop-cab">
      <span class="pop-ico">${iconoHtml}</span>
      <div class="pop-tit-wrap">
        <div class="pop-sub">${esc(sub)}</div>
        <div class="pop-val">${valorHtml}</div>
      </div>
      <div class="pop-cab-der">
        <span class="pop-badge">${badgeTxt}</span>
        <button type="button" class="pop-x" title="Cerrar" aria-label="Cerrar">✕</button>
      </div>
    </div>`
    const pieFiltro = (perfilPubs && aplicarFiltroCtxPubs && lista.length)
      ? `<div class="pop-pie"><button type="button" class="pop-ir-lista">${ico('filtro')}<span>Filtrar estas ${lista.length} publicaci${lista.length === 1 ? 'ón' : 'ones'} en la lista inferior ↓</span></button></div>`
      : ''
    if (conAutores || conUtm) {
      const capA = 15
      const autBody = conAutores ? autores.slice(0, capA).map(ctxAutorRow).join('') : ''
      const utmBody = conUtm ? autoresUtm.slice(0, capA).map(ctxAutorRow).join('') : ''
      popEl.innerHTML = `${cabHtml}
        <div class="pop-subtabs">
          <button type="button" class="pop-stab pop-tab on" data-pt="pubs">${ico('recientes')}<span>Publicaciones (${lista.length})</span></button>
          ${conUtm ? `<button type="button" class="pop-stab pop-tab" data-pt="utm">${ico('primerAutor')}<span>Autores UTM (${autoresUtm.length})</span></button>` : ''}
          ${conAutores ? `<button type="button" class="pop-stab pop-tab" data-pt="aut">${ico('autores')}<span>Coautores ext. (${autores.length})</span></button>` : ''}
        </div>
        <div class="pop-body pop-pane" data-pt="pubs">${pubsBody}</div>
        ${conUtm ? `<div class="pop-body pop-pane" data-pt="utm" style="display:none">${utmBody}</div>` : ''}
        ${conAutores ? `<div class="pop-body pop-pane" data-pt="aut" style="display:none">${autBody}</div>` : ''}
        ${pieFiltro}`
    } else {
      popEl.innerHTML = `${cabHtml}
        <div class="pop-body">${pubsBody}</div>
        ${pieFiltro}`
    }
    document.body.appendChild(popEl)
    if (conAutores || conUtm) {
      const tabs = [...popEl.querySelectorAll('.pop-tab')]
      const panes = [...popEl.querySelectorAll('.pop-pane')]
      tabs.forEach(t => t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.toggle('on', x === t))
        panes.forEach(p => { p.style.display = p.dataset.pt === t.dataset.pt ? '' : 'none' })
      }))
    }
    const btnIr = popEl.querySelector('.pop-ir-lista')
    if (btnIr) btnIr.addEventListener('click', () => {
      if (aplicarFiltroCtxPubs) aplicarFiltroCtxPubs(titulo, lista, opts.ctx)
      cerrarPop()
      const panel = document.getElementById('panelPubs')
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    const w = popEl.offsetWidth, h = popEl.offsetHeight
    let x = ev.clientX + 12, y = ev.clientY + 12
    if (x + w > window.innerWidth - 8) x = Math.max(8, window.innerWidth - w - 8)
    if (y + h > window.innerHeight - 8) y = Math.max(8, ev.clientY - h - 12)
    popEl.style.left = x + 'px'; popEl.style.top = y + 'px'
    popEl.querySelector('.pop-x').addEventListener('click', cerrarPop)
    setTimeout(() => document.addEventListener('mousedown', fueraPop, true), 0)
    document.addEventListener('keydown', escPop)
  }

  // Generación de citas (APA 7 y BibTeX) y exportación de publicaciones
  function citaAPA(p) {
    const prim = p.au || []
    const total = p.nc || prim.length
    let aut = ''
    if (prim.length) {
      if (p.uf && total > prim.length) aut = prim.join(', ') + ', ... ' + p.uf
      else if (prim.length === 1) aut = prim[0]
      else aut = prim.slice(0, -1).join(', ') + ' y ' + prim[prim.length - 1]
      if (!aut.endsWith('.')) aut += '.'
    }
    const anio = p.y ? `(${p.y}).` : '(s. f.).'
    const tit = (p.t || 'Sin título').replace(/\.\s*$/, '') + '.'
    const rev = p.j ? `${p.j}.` : ''
    const doi = p.doi ? `https://doi.org/${p.doi}` : ''
    return [aut, anio, tit, rev, doi].filter(Boolean).join(' ')
  }

  function citaBibtex(p, idx) {
    const esConf = (p.st || '').toLowerCase().includes('conference')
    const tipo = esConf ? 'inproceedings' : 'article'
    const prim = (p.au && p.au[0]) ? p.au[0].split(',')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : 'utm'
    const clave = `${prim || 'utm'}${p.y || 'nd'}_${idx != null ? idx : (PUB_IDX.get(p) || 1)}`
    const listaAut = [...(p.au || [])]
    if (p.uf && (p.nc || 0) > listaAut.length) listaAut.push(p.uf)
    const campoFuente = esConf ? 'booktitle' : 'journal'
    const lineas = [
      `@${tipo}{${clave},`,
      listaAut.length ? `  author = {${listaAut.join(' and ')}},` : null,
      `  title = {${p.t || ''}},`,
      p.j ? `  ${campoFuente} = {${p.j}},` : null,
      p.y ? `  year = {${p.y}},` : null,
      p.doi ? `  doi = {${p.doi}},` : null,
      `}`
    ].filter(Boolean)
    return lineas.join('\n')
  }

  function descargarArchivo(nombre, contenido, mime) {
    const blob = new Blob([contenido], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url) }, 150)
  }

  function mostrarCitaPopover(ev, p) {
    cerrarPop()
    if (!p) return
    const apa = citaAPA(p)
    const bib = citaBibtex(p)
    popEl = document.createElement('div')
    popEl.className = 'popover-ctx'
    let fmt = 'apa'
    popEl.innerHTML = `<div class="pop-cab">
      <span class="pop-ico">${ico('citas')}</span>
      <div class="pop-tit-wrap">
        <div class="pop-sub">Referencia bibliográfica</div>
        <div class="pop-val">Citar publicación</div>
      </div>
      <div class="pop-cab-der">
        <span class="pop-badge">APA / BibTeX</span>
        <button type="button" class="pop-x" title="Cerrar" aria-label="Cerrar">✕</button>
      </div>
    </div>
      <div class="pop-subtabs">
        <button type="button" class="pop-stab pop-tab on" data-cf="apa">APA 7</button>
        <button type="button" class="pop-stab pop-tab" data-cf="bib">BibTeX</button>
      </div>
      <div class="pop-body" style="padding:10px 14px 12px">
        <div class="cita-box" id="citaTexto">${esc(apa)}</div>
        <div class="cita-acciones">
          <button type="button" class="cita-btn pri" id="btnCopiarCita">${ico('copiar')}<span>Copiar referencia</span></button>
          <button type="button" class="cita-btn" id="btnDescBib">${ico('descarga')}<span>Descargar .bib</span></button>
        </div>
      </div>`
    document.body.appendChild(popEl)
    const caja = popEl.querySelector('#citaTexto')
    const btnCop = popEl.querySelector('#btnCopiarCita')
    const btnBib = popEl.querySelector('#btnDescBib')
    popEl.querySelectorAll('.pop-tab').forEach(t => t.addEventListener('click', () => {
      fmt = t.dataset.cf
      popEl.querySelectorAll('.pop-tab').forEach(x => x.classList.toggle('on', x === t))
      caja.classList.toggle('mono', fmt === 'bib')
      caja.textContent = fmt === 'bib' ? bib : apa
    }))
    btnCop.addEventListener('click', () => {
      const txt = fmt === 'bib' ? bib : apa
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => {
          btnCop.innerHTML = `${ico('copiar')}<span>✓ Copiado</span>`
          setTimeout(() => { btnCop.innerHTML = `${ico('copiar')}<span>Copiar referencia</span>` }, 1600)
        })
      }
    })
    btnBib.addEventListener('click', () => {
      descargarArchivo(`cita-${p.y || 'utm'}.bib`, bib + '\n', 'application/x-bibtex;charset=utf-8')
    })
    const w = popEl.offsetWidth, h = popEl.offsetHeight
    let x = ev.clientX - w + 24, y = ev.clientY + 10
    if (x < 8) x = 8
    if (x + w > window.innerWidth - 8) x = Math.max(8, window.innerWidth - w - 8)
    if (y + h > window.innerHeight - 8) y = Math.max(8, ev.clientY - h - 10)
    popEl.style.left = x + 'px'; popEl.style.top = y + 'px'
    popEl.querySelector('.pop-x').addEventListener('click', cerrarPop)
    setTimeout(() => document.addEventListener('mousedown', fueraPop, true), 0)
    document.addEventListener('keydown', escPop)
  }

  // panel de publicaciones con filtros cruzados, buscador, exportación y paginación
  function panelPubsHTML(titulo, n, conOrden, autorId) {
    return `<div class="panel" id="panelPubs"><h3 class="h3-flex">
      <span id="pubTitCont" data-base="${esc(titulo)}">${esc(titulo)} (${num(n)})</span>
      <span class="pp-ctrl">
        ${conOrden ? `<select class="selector" id="pubOrden" aria-label="Ordenar publicaciones">
          <option value="recientes">Ordenar: Más recientes</option>
          <option value="citadas">Ordenar: Más citadas</option>
        </select>` : ''}
        <select class="selector" id="pp" aria-label="Publicaciones por página">
          <option value="10">Ítems por página: 10</option>
          <option value="25">Ítems por página: 25</option>
          <option value="50">Ítems por página: 50</option>
          <option value="0">Ítems por página: Todas</option>
        </select></span></h3>
      <div class="pub-filtros">
        <input id="pubQ" class="entrada pub-busq" placeholder="Filtrar por título, revista, coautor o DOI…" aria-label="Filtrar publicaciones por texto">
        <div class="pub-fchips">
          <button type="button" class="pub-fchip pub-qchip on" data-q="todos" title="Mostrar todos los cuartiles">${ico('cuartil')}<span>Todos los Q</span></button>
          <button type="button" class="pub-fchip pub-qchip" data-q="Q1" title="Cuartil 1 (SJR)">${icoQ(COLQ.Q1)}<span>Q1</span></button>
          <button type="button" class="pub-fchip pub-qchip" data-q="Q2" title="Cuartil 2 (SJR)">${icoQ(COLQ.Q2)}<span>Q2</span></button>
          <button type="button" class="pub-fchip pub-qchip" data-q="Q3" title="Cuartil 3 (SJR)">${icoQ(COLQ.Q3)}<span>Q3</span></button>
          <button type="button" class="pub-fchip pub-qchip" data-q="Q4" title="Cuartil 4 (SJR)">${icoQ(COLQ.Q4)}<span>Q4</span></button>
          <button type="button" class="pub-fchip pub-qchip" data-q="N/A" title="Sin cuartil SJR (ponencia, capítulo o libro)">${icoQ(COLQ['N/A'])}<span>N/A</span></button>
          <span class="pub-fsep" aria-hidden="true"></span>
          <button type="button" class="pub-fchip" data-pf="oa">${ico('oa')}<span>Acceso abierto</span></button>
          ${autorId ? `<button type="button" class="pub-fchip" data-pf="fa">${ico('primerAutor')}<span>Primer autor</span></button>` : ''}
          <button type="button" class="pub-fchip" data-pf="cit">${ico('citas')}<span>Con citas</span></button>
          <span id="pubCtxWrap" class="pub-ctx-wrap"></span>
        </div>
        <div class="pub-exp-wrap">
          ${autorId ? `<button type="button" class="btn-exp" data-copiar-enlace="1" title="Copia el enlace con el periodo y los filtros activos">${ico('enlace')}<span>Copiar enlace</span></button>` : ''}
          <button type="button" class="btn-exp" id="btnExpCsv" title="Descargar las publicaciones listadas en CSV">${ico('csv')}<span>CSV</span></button>
          <button type="button" class="btn-exp" id="btnExpBib" title="Descargar las publicaciones listadas en BibTeX">${ico('bibtex')}<span>BibTeX</span></button>
        </div>
      </div>
      ${autorId ? `<div class="ctx-hint pub-hint">Haga clic en un año, revista, coautor, país, área o tema del perfil y elija «Filtrar»; con Ctrl o ⌘ + clic se filtra al instante. Los filtros se combinan y quedan guardados en el enlace.</div>` : ''}
      <div class="pubs" id="pubcont"></div>
      <div class="paginacion" id="pubpager"></div></div>`
  }

  function wirePubs(lista, rowFn, autorId, nombreBase, ini) {
    let pagina = 1, porPag = 10, orden = 'recientes', qTxt = ''
    const chips = new Set()
    const qSel = new Set() // vacío = todos los cuartiles
    let ctxFiltros = [] // [{ cat, val, titulo, set }]
    const cont = document.getElementById('pubcont')
    const pager = document.getElementById('pubpager')
    const sel = document.getElementById('pp')
    const selO = document.getElementById('pubOrden')
    const inpQ = document.getElementById('pubQ')
    const titEl = document.getElementById('pubTitCont')
    const ctxChipEl = document.getElementById('pubCtxWrap')
    const btnCsv = document.getElementById('btnExpCsv')
    const btnBib = document.getElementById('btnExpBib')
    let ordenada = lista

    function filtrarOrdenar() {
      const tokens = qTxt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().split(/\s+/).filter(Boolean)
      const filtrada = lista.filter(p => {
        if (ctxFiltros.length && !ctxFiltros.every(f => f.set.has(p))) return false
        if (qSel.size > 0) {
          const qp = p.q || 'N/A'
          if (!qSel.has(qp)) return false
        }
        if (chips.has('oa') && !(p.oa && p.oa !== 'Closed' && p.oa !== 'Unknown')) return false
        if (chips.has('fa') && autorId && String(p.fa || (p.u || [])[0] || '') !== String(autorId)) return false
        if (chips.has('cit') && !(p.c > 0)) return false
        if (tokens.length) {
          const idx = PUB_IDX.get(p)
          const texto = idx != null ? PUB_BUSQ[idx] : ((p.t || '') + ' ' + (p.j || '')).toLowerCase()
          if (!tokens.every(t => texto.includes(t))) return false
        }
        return true
      })
      ordenada = filtrada.sort((a, b) => orden === 'citadas'
        ? (b.c || 0) - (a.c || 0) || (b.y || 0) - (a.y || 0)
        : (b.y || 0) - (a.y || 0) || (b.c || 0) - (a.c || 0))
    }

    function pinta() {
      const total = ordenada.length
      if (titEl) {
        const base = titEl.getAttribute('data-base') || 'Publicaciones'
        titEl.textContent = total === lista.length
          ? `${base} (${num(total)})`
          : `${base} (${num(total)} de ${num(lista.length)})`
      }
      if (ctxChipEl) {
        ctxChipEl.innerHTML = ctxFiltros.map((f, i) => `<span class="pub-ctx-chip"><span>${esc(f.titulo)}</span><button type="button" data-q-ctx="${i}" title="Quitar filtro" aria-label="Quitar filtro">✕</button></span>`).join('')
        ctxChipEl.querySelectorAll('button[data-q-ctx]').forEach(b => b.addEventListener('click', () => {
          ctxFiltros.splice(+b.dataset.qCtx, 1); pagina = 1; filtrarOrdenar(); pinta()
        }))
      }
      const pp = porPag === 0 ? (total || 1) : porPag
      const paginas = Math.max(1, Math.ceil(total / pp))
      if (pagina > paginas) pagina = paginas
      const ini = (pagina - 1) * pp
      const vis = porPag === 0 ? ordenada : ordenada.slice(ini, ini + pp)
      cont.innerHTML = vis.length ? vis.map(rowFn).join('') : '<div class="vacio">Sin publicaciones que coincidan con los filtros activos.</div>'
      pager.innerHTML = paginacionHTML(pagina, paginas)
      pager.querySelectorAll('button[data-p]').forEach(b => b.addEventListener('click', () => {
        pagina = +b.dataset.p; pinta()
        cont.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }))
      sincronizar()
    }

    // Guarda en la URL (solo en el perfil) el periodo, los cuartiles, el acceso abierto, el texto y los filtros por categoría.
    function sincronizar() {
      if (!autorId) return
      const pr = paramsHash()
      ;['q', 'oa', 'fa', 'cit', 'txt', 'ord', 'c'].forEach(k => pr.delete(k))
      if (qSel.size) pr.set('q', [...qSel].join(','))
      ;['oa', 'fa', 'cit'].forEach(k => { if (chips.has(k)) pr.set(k, '1') })
      if (qTxt.trim()) pr.set('txt', qTxt.trim())
      if (orden !== 'recientes') pr.set('ord', orden)
      ctxFiltros.forEach(f => { if (f.cat) pr.append('c', f.cat + '~' + f.val) })
      fijarParams(pr)
    }
    // Los filtros de distinta categoría se combinan; uno nuevo de la misma categoría sustituye al anterior.
    aplicarFiltroCtxPubs = (tituloCtx, subLista, ctx) => {
      if (ctx && ctx.cat) ctxFiltros = ctxFiltros.filter(f => f.cat !== ctx.cat)
      else ctxFiltros = []
      ctxFiltros.push({ cat: ctx ? ctx.cat : null, val: ctx ? ctx.val : null, titulo: tituloCtx, set: new Set(subLista) })
      pagina = 1
      filtrarOrdenar()
      pinta()
    }

    if (inpQ) inpQ.addEventListener('input', e => { qTxt = e.target.value; pagina = 1; filtrarOrdenar(); pinta() })
    document.querySelectorAll('.pub-qchip[data-q]').forEach(b => b.addEventListener('click', () => {
      const qk = b.dataset.q
      if (qk === 'todos') {
        qSel.clear()
      } else {
        if (qSel.has(qk)) qSel.delete(qk)
        else qSel.add(qk)
      }
      document.querySelectorAll('.pub-qchip[data-q]').forEach(x => {
        const k = x.dataset.q
        x.classList.toggle('on', k === 'todos' ? qSel.size === 0 : qSel.has(k))
      })
      pagina = 1; filtrarOrdenar(); pinta()
    }))
    document.querySelectorAll('.pub-fchip[data-pf]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.pf
      if (chips.has(k)) chips.delete(k)
      else chips.add(k)
      document.querySelectorAll('.pub-fchip[data-pf]').forEach(x => x.classList.toggle('on', chips.has(x.dataset.pf)))
      pagina = 1; filtrarOrdenar(); pinta()
    }))
    if (btnCsv) btnCsv.addEventListener('click', () => {
      const escCsv = s => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`
      const cab = ['Anio', 'Titulo', 'Fuente', 'Cuartil_SJR', 'Tipo', 'Citas', 'Acceso_abierto', 'DOI', 'Autores'].join(',')
      const filas = ordenada.map(p => [
        p.y || '',
        escCsv(p.t || ''),
        escCsv(p.j || ''),
        escCsv(p.q || 'N/A'),
        escCsv(p.st || ''),
        p.c || 0,
        (p.oa && p.oa !== 'Closed' && p.oa !== 'Unknown') ? 'Si' : 'No',
        escCsv(p.doi || ''),
        escCsv((p.au || []).join('; '))
      ].join(','))
      descargarArchivo(`${nombreBase || 'publicaciones-utm'}.csv`, '\uFEFF' + [cab, ...filas].join('\n'), 'text/csv;charset=utf-8')
    })
    if (btnBib) btnBib.addEventListener('click', () => {
      const contenido = ordenada.map((p, i) => citaBibtex(p, i + 1)).join('\n\n') + '\n'
      descargarArchivo(`${nombreBase || 'publicaciones-utm'}.bib`, contenido, 'application/x-bibtex;charset=utf-8')
    })
    if (sel) sel.addEventListener('change', () => { porPag = +sel.value; pagina = 1; pinta() })
    if (selO) selO.addEventListener('change', () => { orden = selO.value; filtrarOrdenar(); pagina = 1; pinta() })
    if (ini) {
      ini.q.forEach(x => qSel.add(x))
      ;['oa', 'fa', 'cit'].forEach(k => { if (ini[k]) chips.add(k) })
      qTxt = ini.txt || ''
      if (inpQ) inpQ.value = qTxt
      if (ini.ord === 'citadas') { orden = 'citadas'; if (selO) selO.value = 'citadas' }
      ini.c.forEach(({ cat, val }) => {
        ctxFiltros = ctxFiltros.filter(f => f.cat !== cat)
        ctxFiltros.push({ cat, val, titulo: tituloCat(cat, val), set: new Set(listaCat(lista, cat, val)) })
      })
      document.querySelectorAll('.pub-qchip[data-q]').forEach(x => {
        const kq = x.dataset.q
        x.classList.toggle('on', kq === 'todos' ? qSel.size === 0 : qSel.has(kq))
      })
      document.querySelectorAll('.pub-fchip[data-pf]').forEach(x => x.classList.toggle('on', chips.has(x.dataset.pf)))
    }
    filtrarOrdenar()
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
    return `<span class="insig-q" style="background:${c}1e;color:${q === 'Q2' ? '#3f7d12' : c};cursor:help" title="${esc(tipCuartil(q))}">${esc(q)}</span>`
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
    const idx = PUB_IDX.get(p)
    const btnCit = idx != null ? ` · <button type="button" class="btn-citar" data-cite="${idx}" title="Citar en formato APA 7 o BibTeX">❞ Citar</button>` : ''
    return `<div class="pub"><div class="anio"><b>${p.y || 'N/D'}</b></div>
      <div class="cuerpo"><div class="t">${t}${dest ? ' <span class="mas-citada">★ Más citada</span>' : ''}</div>
      <div class="m">${adelM(p)}${esc(p.j || 'N/D')} · ${badgeQ(p.q)} · ${num(p.c)} citas${abierto ? ' · <span class="oa-tag">Acceso abierto</span>' : ''}${p.r ? ' · <span class="retirada" title="La revista o fuente fue retirada de Scopus (discontinued source).">⚑ Revista retirada de Scopus</span>' : ''}${btnCit}</div>${autoresLinea(p)}</div></div>`
  }

  // ---------- coautoría externa, temas y exportaciones del perfil ----------
  const paisChip = ([p, c]) => {
    const b = banderaPais(p)
    return `<span class="ce-chip" data-cat="pais" data-val="${esc(p)}" style="cursor:pointer" title="Ver publicaciones con ${esc(p)}">${b ? b + ' ' : ''}${esc(p)}<b>${c}</b></span>`
  }
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
  function coautoriaExterna(a, nUtm, nombre) {
    const cx = a.cx || [], px = a.px || [], ix = a.ix || []
    if (!nUtm && !cx.length && !px.length && !ix.length)
      return '<div style="color:var(--texto3);font-size:var(--fs-sm)">Sin coautorías registradas.</div>'
    // Coautores externos, instituciones y países como pestañas, con el mismo
    // diseño del Top 10 de la portada (top-tabs / top-tab). Solo se muestra la
    // pestaña de la categoría que tiene datos.
    const tabs = [], panes = []
    // Países y mapa van juntos: el mapa arriba y, debajo, la lista de países con su número de publicaciones.
    if (px.length) {
      tabs.push(`<button class="top-tab ce-tab" data-ce="pais">${ico('globe')}<span>Países (${px.length})</span></button>`)
      panes.push(`<div class="ce-pane" data-ce="pais">${window.MAPA_MUNDO ? mapaColab(px) : ''}<div class="ce-chips"${window.MAPA_MUNDO ? ' style="margin-top:12px"' : ''}>${px.map(paisChip).join('')}</div></div>`)
    }
    if (ix.length) {
      tabs.push(`<button class="top-tab ce-tab" data-ce="inst">${ico('inst')}<span>Filiaciones (${ix.length})</span></button>`)
      panes.push(`<div class="ce-pane" data-ce="inst"><div id="ceInstCont"></div><div class="paginacion" id="ceInstPager"></div></div>`)
    }
    // Comunidades: el grafo se dibuja la primera vez que se abre la pestaña (oculto no tiene tamaño).
    if (nUtm || cx.length) {
      tabs.push(`<button class="top-tab ce-tab" data-ce="com">${ico('rg')}<span>Comunidades</span></button>`)
      panes.push(`<div class="ce-pane" data-ce="com"><p class="ayuda-filtros" style="margin:0 0 12px">
          Cada nodo es un coautor y su tamaño indica los trabajos en común; las líneas unen a quienes
          han publicado juntos. Los colores agrupan a los coautores que publican entre sí. Elija un
          grupo en la leyenda para ver sus nombres, o haga clic en un coautor para ver las
          publicaciones que comparte con ${esc(nombre)}.
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
        <div id="comSel" class="com-sel" style="display:none"></div></div>`)
    }
    if (cx.length) {
      tabs.push(`<button class="top-tab ce-tab" data-ce="coaut">${ico('autores')}<span>Coautores externos (${cx.length})</span></button>`)
      panes.push(`<div class="ce-pane" data-ce="coaut"><div id="ceCoautCont"></div><div class="paginacion" id="ceCoautPager"></div></div>`)
    }
    if (nUtm) {
      tabs.push(`<button class="top-tab ce-tab" data-ce="utm">${ico('primerAutor')}<span>Coautores UTM (${nUtm})</span></button>`)
      panes.push(`<div class="ce-pane" data-ce="utm"><div class="coautores" id="coautCont"></div><div class="paginacion" id="coautPager"></div></div>`)
    }
    return tabs.length
      ? `<div class="top-tabs" style="margin-bottom:12px">${tabs.join('')}</div>${panes.join('')}` : ''
  }
  // Conmuta las pestañas del panel Temas y fuentes de publicación.
  function wireTemasTabs() {
    const tabs = [...document.querySelectorAll('.tf-tab')]
    const panes = [...document.querySelectorAll('.tf-pane')]
    if (!tabs.length) return
    const activar = key => {
      tabs.forEach(t => t.classList.toggle('on', t.dataset.tf === key))
      panes.forEach(p => { p.style.display = p.dataset.tf === key ? '' : 'none' })
    }
    tabs.forEach(t => t.addEventListener('click', () => activar(t.dataset.tf)))
    activar(tabs[0].dataset.tf)
  }
  // Conmuta las pestañas de Colaboración externa: misma lógica visual del Top 10.
  function wireCoautExtTabs(alActivar) {
    const tabs = [...document.querySelectorAll('.ce-tab')]
    const panes = [...document.querySelectorAll('.ce-pane')]
    if (!tabs.length) return
    const activar = key => {
      tabs.forEach(t => t.classList.toggle('on', t.dataset.ce === key))
      panes.forEach(p => { p.style.display = p.dataset.ce === key ? '' : 'none' })
      if (alActivar) alActivar(key)
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
    if (!areas.length) return '<div style="color:var(--texto3);font-size:var(--fs-sm)">Sin áreas registradas.</div>'
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

  // El año en curso aún no ha terminado: sus barras se dibujan con otro tono y
  // queda fuera de la tendencia y del promedio, que compararían un año completo
  // con uno a medias.
  // También son parciales los años posteriores al actual (adelantos de volumen).
  const esParcial = (years) => years.some(y => y >= ANIO_ACTUAL)
  const aniosCompletos = (years) => years.filter(y => y < ANIO_ACTUAL)

  function barsAnio(porAnio, H) {
    const years = Object.keys(porAnio).map(Number).sort((a, b) => a - b)
    if (!years.length) return '<div style="color:var(--texto3)">Sin datos.</div>'
    const vals = years.map(y => porAnio[y])
    const parcial = esParcial(years)
    const nComp = years.filter(y => y < ANIO_ACTUAL).length
    const max = Math.max(...vals)
    const n = years.length
    if (H == null) H = n <= 2 ? 102 : n <= 4 ? 122 : 150
    const W = Math.max(280, n * 36), base = H - 24, top = 14
    const paso = W / n, bw = Math.min(22, paso - 9)
    const yFor = v => base - (Math.max(0, v) / max) * (base - top)
    let s = `<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="#e6e9e1"/>`
    let rotulos = ''
    years.forEach((y, i) => {
      const x = i * paso + (paso - bw) / 2
      const yb = yFor(porAnio[y])
      const enCurso = y >= ANIO_ACTUAL
      const relleno = enCurso
        ? 'fill="#2e8a1f" fill-opacity=".45" stroke="#2e8a1f" stroke-width="1.2" stroke-dasharray="3 2"'
        : 'fill="#2e8a1f"'
      s += `<rect x="${x}" y="${yb}" width="${bw}" height="${Math.max(1, base - yb)}" rx="4" ${relleno}>${enCurso ? `<title>${y}: ${y === ANIO_ACTUAL ? 'año en curso' : 'adelanto de volumen'}, cifra parcial</title>` : ''}</rect>`
      // Las cifras se dibujan al final, sobre la línea de tendencia, con un halo
      // blanco detrás para que no se confundan con ella.
      rotulos += `<text x="${x + bw / 2}" y="${yb - 4}" font-size="10" text-anchor="middle" fill="#6b7563"
          stroke="#fff" stroke-width="2.6" paint-order="stroke">${porAnio[y]}</text>
        <text x="${x + bw / 2}" y="${base + 13}" font-size="10" text-anchor="middle" fill="${enCurso ? '#c07a12' : '#98a18d'}">${y}${enCurso ? '*' : ''}</text>`
    })
    // línea de tendencia (regresión lineal), solo sobre los años completos
    if (nComp >= 2) {
      const { m, b } = regresion(vals.slice(0, nComp))
      const pts = years.slice(0, nComp).map((y, i) => `${(i * paso + paso / 2).toFixed(1)},${yFor(b + m * i).toFixed(1)}`).join(' ')
      s += `<polyline points="${pts}" fill="none" stroke="#e0902d" stroke-width="2" stroke-dasharray="5 3"/>`
      years.slice(0, nComp).forEach((y, i) => { s += `<circle cx="${(i * paso + paso / 2).toFixed(1)}" cy="${yFor(b + m * i).toFixed(1)}" r="2.4" fill="#e0902d"/>` })
    }
    s += rotulos
    // zonas clicables (una por columna), encima de todo
    years.forEach((y, i) => {
      s += `<rect x="${(i * paso).toFixed(1)}" y="0" width="${paso.toFixed(1)}" height="${base}" fill="transparent" data-cat="anio" data-val="${y}" style="cursor:pointer"><title>Ver publicaciones de ${y}</title></rect>`
    })
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H + 10}px">${s}</svg>`
  }

  function infoAnios(porAnio) {
    const years = Object.keys(porAnio).map(Number).sort((a, b) => a - b)
    if (!years.length) return ''
    const parcial = esParcial(years)
    // El promedio, el pico y la tendencia se calculan solo con los años cerrados.
    const comp = aniosCompletos(years)
    const base = comp.length ? comp : years
    const vals = base.map(y => porAnio[y])
    const total = vals.reduce((s, v) => s + v, 0)
    const prom = dec(total / base.length, 1)
    let pico = base[0]
    base.forEach(y => { if (porAnio[y] > porAnio[pico]) pico = y })
    const { m } = regresion(vals)
    const tend = m > 0.15 ? 'creciente' : m < -0.15 ? 'decreciente' : 'estable'
    const flecha = m > 0.15 ? '↗' : m < -0.15 ? '↘' : '→'
    const span = years[years.length - 1] - years[0] + 1
    return `<div class="info-anios">
      <span>Promedio <b>${prom}</b> pub./año${parcial && comp.length ? ' <em>(años cerrados)</em>' : ''}</span>
      <span>Año más productivo <b>${pico}</b> (${porAnio[pico]})</span>
      <span>Trayectoria <b>${span} año${span !== 1 ? 's' : ''}</b></span>
      ${comp.length >= 2 ? `<span>Tendencia <b style="color:#9a5f0a">${flecha} ${tend}</b> <em>(línea naranja)</em></span>` : ''}
      ${parcial ? `<span><em>* ${years.filter(y => y >= ANIO_ACTUAL).join(' y ')}: ${years.some(y => y > ANIO_ACTUAL) ? 'cifras parciales (año en curso y adelantos de volumen)' : 'en curso, cifra parcial'}; no entran en el promedio ni en la tendencia.</em></span>` : ''}
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
      <text x="64" y="78" text-anchor="middle" font-size="10" fill="#8f9985">${total === 1 ? 'Doc.' : 'Docs.'}</text></svg>
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
    const idx = PUB_IDX.get(p)
    const btnCit = idx != null ? ` · <button type="button" class="btn-citar" data-cite="${idx}" title="Citar en formato APA 7 o BibTeX">❞ Citar</button>` : ''
    return `<div class="pub"><div class="anio"><b>${p.y || 'N/D'}</b></div><div class="cuerpo"><div class="t">${t}</div>
      <div class="m">${adelM(p)}${esc(p.j || 'N/D')} · ${badgeQ(p.q)} · ${num(p.c)} citas${abierto ? ' · <span class="oa-tag">Acceso abierto</span>' : ''}${p.r ? ' · <span class="retirada" title="La revista o fuente fue retirada de Scopus (discontinued source).">⚑ Revista retirada de Scopus</span>' : ''}${aut}${btnCit}</div></div></div>`
  }

  function renderArea(area) {
    perfilPubs = null
    aplicarFiltroCtxPubs = null
    const lista = D.pubs.filter(p => (p.a || []).includes(area))
      .sort((x, y) => (y.y || 0) - (x.y || 0) || (y.c - x.c))
    const conteoAut = new Map()
    lista.forEach(p => {
      ;(p.u || []).forEach(u => {
        const s = String(u)
        if (porId.has(s)) conteoAut.set(s, (conteoAut.get(s) || 0) + 1)
      })
    })
    const autArea = [...conteoAut.entries()]
      .map(([uid, n]) => [porId.get(uid), n])
      .sort((a, b) => b[1] - a[1] || (b[0].C || 0) - (a[0].C || 0))
    const slug = 'area-' + (area || 'utm').toLowerCase().replace(/[^a-z0-9]+/g, '-')

    app.innerHTML = `<div class="wrap">
      <a class="volver" href="#/">← Volver a la página principal</a>
      <div class="perfil-hero" style="border-left-color:var(--g3)">
        <div style="flex:1"><h1>${esc(area)}</h1>
          <div class="sub">Área temática de Scopus · ${num(lista.length)} publicaciones UTM · ${num(autArea.length)} investigadores UTM</div></div></div>
      ${autArea.length ? `<div class="panel" style="margin-bottom:18px">
        <h3>Investigadores UTM en esta área (${num(autArea.length)})</h3>
        <div class="coautores" id="areaAutCont"></div>
        <div class="paginacion" id="areaAutPager"></div>
      </div>` : ''}
      ${panelPubsHTML('Publicaciones', lista.length, true)}</div>
    ${TOP_PAGE_HTML}`
    wirePubs(lista, pubRowArea, null, slug)
    if (autArea.length) {
      paginar('areaAutCont', 'areaAutPager', autArea, ([au, c]) => `<div class="coautor">
        <a class="coautor-ir" href="#/autor/${encodeURIComponent(au.id)}" title="Ver perfil de ${esc(au.n)}">${avatar(au)}<span class="cn">${esc(au.n)}</span></a>
        <span class="cc" data-area-aut="${esc(au.id)}" title="Filtrar las publicaciones de ${esc(au.n)} en esta área">${c} pub. en el área</span>
      </div>`, 10)
    }
  }

  // ---------- router ----------
  const TITULO = 'Investigadores UTM · Producción científica Scopus'
  function router() {
    const h = hashPartes()[0]
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
    const btnCit = ev.target.closest('.btn-citar[data-cite]')
    if (btnCit) {
      const p = D.pubs[+btnCit.dataset.cite]
      if (p) mostrarCitaPopover(ev, p)
      return
    }
    const btnAreaAut = ev.target.closest('[data-area-aut]')
    if (btnAreaAut && aplicarFiltroCtxPubs) {
      const uid = btnAreaAut.getAttribute('data-area-aut')
      const au = porId.get(uid)
      const areaNombre = location.hash.indexOf('#/area/') === 0 ? decodeURIComponent(location.hash.slice(7)) : ''
      const sub = D.pubs.filter(p => (!areaNombre || (p.a || []).includes(areaNombre)) && (p.u || []).map(String).includes(uid))
      aplicarFiltroCtxPubs('Autor: ' + (au ? au.n : uid), sub)
      const panel = document.getElementById('panelPubs')
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const el = ev.target.closest('[data-cat]')
    if (!el) return
    // en el perfil se filtran sus publicaciones; en la portada (sin perfil
    // activo) el gráfico institucional filtra sobre todas las publicaciones
    const fuente = perfilPubs || D.pubs
    const cat = el.getAttribute('data-cat'), val = el.getAttribute('data-val')
    let lista, titulo, color = '#2e8a1f', autores = null, autoresUtm = null, opts = {}
    const calcAutoresUtm = (pubsLista) => {
      const ctU = {}
      const excluir = perfilPubs ? String(estado.perfilId || '') : ''
      pubsLista.forEach(p => (p.u || []).forEach(u => {
        const s = String(u)
        if (s !== excluir && porId.has(s)) ctU[s] = (ctU[s] || 0) + 1
      }))
      return Object.entries(ctU)
        .map(([id, n]) => ({ id, nombre: porId.get(id).n, n, externo: false }))
        .sort((a, b) => b.n - a.n)
    }
    if (cat === 'anio') {
      lista = listaCat(fuente, cat, val); titulo = 'Año ' + val
      opts = { sub: 'Producción anual', valorHtml: 'Año ' + esc(val), iconoHtml: ico('calendario') }
    }
    else if (cat === 'cuartil') {
      lista = listaCat(fuente, cat, val); titulo = 'Cuartil ' + val; color = COLQ[val] || '#2e8a1f'
      opts = { sub: 'Cuartil SJR', valorHtml: 'Cuartil ' + esc(val), iconoHtml: icoQ(val === 'N/A' ? 'NA' : val) }
    }
    else if (cat === 'tipo') {
      lista = listaCat(fuente, cat, val); titulo = 'Tipo: ' + val
      opts = { sub: 'Tipo de documento', valorHtml: esc(val), iconoHtml: ico('recientes') }
    }
    else if (cat === 'revista') {
      lista = listaCat(fuente, cat, val); titulo = 'Fuente: ' + val
      opts = { sub: 'Revista o conferencia', valorHtml: esc(val), iconoHtml: ico('fuente') }
    }
    else if (cat === 'area') {
      lista = listaCat(fuente, cat, val); titulo = 'Área: ' + val
      opts = { sub: 'Área temática Scopus', valorHtml: esc(val), iconoHtml: ico('area') }
    }
    else if (cat === 'frase') {
      lista = listaCat(fuente, cat, val)
      titulo = 'Tema: ' + val
      opts = { sub: 'Tema recurrente', valorHtml: esc(val), iconoHtml: ico('tema') }
    }
    else if (cat === 'pais') {
      lista = listaCat(fuente, cat, val); titulo = 'País: ' + val
      const band = banderaPais(val)
      opts = { sub: 'Colaboración internacional', valorHtml: (band ? band + ' ' : '') + esc(val), iconoHtml: ico('globe') }
      const ext = (D.extNombres) || {}, extP = (D.extPais) || {}
      const ct = {}
      lista.forEach(p => (p.xa || []).forEach(id => { if (ext[id]) ct[id] = (ct[id] || 0) + 1 }))
      autores = Object.entries(ct)
        .map(([id, n]) => ({ id, nombre: ext[id], n, externo: true, pais: extP[id] }))
        .sort((a, b) => b.n - a.n)
      autoresUtm = calcAutoresUtm(lista)
    }
    else if (cat === 'inst') {
      lista = listaCat(fuente, cat, val); titulo = 'Institución: ' + val
      opts = { sub: 'Filiación externa', valorHtml: esc(val), iconoHtml: ico('inst') }
      autoresUtm = calcAutoresUtm(lista)
    }
    else if (cat === 'coautorExt') {
      lista = listaCat(fuente, cat, val)
      const et = el.querySelector('span')
      const nomExt = et ? et.textContent : val
      titulo = 'Coautor: ' + nomExt
      opts = { sub: 'Coautor externo', valorHtml: esc(nomExt), iconoHtml: ico('autores') }
    }
    else if (cat === 'coautorUtm') {
      lista = listaCat(fuente, cat, val)
      const co = porId.get(val)
      const nomUtm = co ? co.n : val
      titulo = 'Coautor: ' + nomUtm
      opts = { sub: 'Coautor UTM', valorHtml: esc(nomUtm), iconoHtml: ico('primerAutor') }
    }
    else if (cat === 'rol') {
      lista = listaCat(fuente, cat, val); titulo = 'Rol: ' + ROL_ET[val]; color = ROL_COL[val]
      opts = { sub: 'Rol de autoría', valorHtml: esc(ROL_ET[val]), iconoHtml: ico('rol') }
    }
    else if (cat === 'rolAnio') {
      const [y, r] = val.split('|')
      lista = listaCat(fuente, cat, val); titulo = y + ' · ' + ROL_ET[r]; color = ROL_COL[r]
      opts = { sub: 'Rol de autoría en ' + y, valorHtml: esc(ROL_ET[r]) + ' · ' + esc(y), iconoHtml: ico('rol') }
    }
    else if (cat === 'cuartilAnio') {
      const [y, q] = val.split('|')
      const q12 = q === 'Q12'
      lista = listaCat(fuente, cat, val); titulo = tituloCat(cat, val); color = q12 ? COLQ.Q1 : (COLQ[q] || '#2e8a1f')
      opts = { sub: 'Cuartil SJR en ' + y, valorHtml: (q12 ? 'Q1 y Q2' : 'Cuartil ' + esc(q)) + ' · ' + esc(y), iconoHtml: icoQ(color) }
    }
    // Top 10 del landing: publicaciones del autor (histórico y del año en curso).
    else if (cat === 'autorPubs') {
      lista = (D.porAutor[val] || []).map(i => D.pubs[i]).filter(Boolean)
      const co = porId.get(val); titulo = co ? co.n : val
      opts = { sub: 'Investigador UTM · Historial', valorHtml: esc(titulo), iconoHtml: ico('trofeo') }
    }
    else if (cat === 'autorPubsAnio') {
      lista = (D.porAutor[val] || []).map(i => D.pubs[i]).filter(p => p && p.y === ANIO_ACTUAL)
      const co = porId.get(val); titulo = (co ? co.n : val) + ' · ' + ANIO_ACTUAL
      opts = { sub: 'Investigador UTM · Año ' + ANIO_ACTUAL, valorHtml: esc(co ? co.n : val), iconoHtml: ico('calendario') }
    }
    else return
    opts.ctx = { cat, val }
    // Ctrl, Cmd o Mayús + clic: filtra la lista de publicaciones sin abrir el menú.
    if ((ev.ctrlKey || ev.metaKey || ev.shiftKey) && perfilPubs && aplicarFiltroCtxPubs && lista.length) {
      ev.preventDefault(); cerrarPop()
      aplicarFiltroCtxPubs(titulo, lista, opts.ctx)
      const panel = document.getElementById('panelPubs')
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    mostrarPopover(ev, titulo, lista, color, autores, autoresUtm, opts)
    if (cat === 'pais') marcarPais(val)
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
