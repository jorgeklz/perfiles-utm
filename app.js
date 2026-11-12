/* Investigadores UTM — portal público estático. Lee window.DATOS (datos.js). */
(function () {
  const D = window.DATOS
  const app = document.getElementById('app')
  let perfilPubs = null   // publicaciones del perfil activo (para el popover contextual)
  // botón "Inicio de la página" (se muestra al final de cada vista, antes del pie)
  // Ya no hay botón al final de cada vista: "Ir a arriba" es un botón flotante global (ver más abajo).
  const TOP_PAGE_HTML = ''
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
      topRev: orden(rev).slice(0, 15),
      topPaises: orden(paises).slice(0, 32),
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
  const TOTAL_AUT = D.autores.length || 1
  const TOTAL_CP = D.autores.filter(a => (a.P || 0) >= MIN_PUBS_CP).length || 1
  const puestoTxt = (r, total = TOTAL_AUT) => {
    if (!r) return ''
    if (r === 1) return 'Puesto 1 en UTM'
    const pct = Math.max(1, Math.ceil(100 * r / total))
    return pct <= 50 ? `Puesto ${r} en UTM · ${pct}% superior` : `Puesto ${r} de ${num(total)} en UTM`
  }

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
    tabla: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>',
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
    fechaHero = `<div class="hero-fecha"><span>Datos de Scopus al <time datetime="${iso}">${texto}</time></span> <a class="hero-metod" href="#/metodologia" title="Cómo se calculan los indicadores" aria-label="Cómo se calculan los indicadores"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><path d="M9.4 9.4a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 3.9"/><circle cx="12" cy="17.4" r=".6" fill="currentColor"/></svg></a></div>`
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
        .then(() => { if (lbl) lbl.textContent = 'Enlace copiado, pégalo en WhatsApp' })
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
        <a class="hero-pubs" href="#/publicaciones">Explorar todas las publicaciones →</a>
        <div class="hero-panel">
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
        </div></div></div></section>
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
          <button type="button" class="btn-filtros" id="btnFiltros" aria-expanded="false" aria-controls="hojaFiltros">${ico('filtro')}<span>Filtros</span><b class="btn-filtros-n" hidden></b></button>
          <div class="hoja-vel" id="hojaVel"></div>
          <div class="hoja-filtros" id="hojaFiltros" role="dialog" aria-label="Filtros del directorio">
            <div class="hoja-cab"><span>Filtros del directorio</span><button type="button" class="hoja-x" data-cerrar-hoja aria-label="Cerrar filtros">×</button></div>
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
            <div class="hoja-pie"><button type="button" class="hoja-aplicar" data-cerrar-hoja></button></div>
          </div>
          <button type="button" class="btn-exp" id="btnExpDir" title="Descargar en CSV los investigadores de la lista, con los filtros aplicados">${ico('csv')}<span>CSV</span></button>
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
    const btnExpDir = document.getElementById('btnExpDir')
    if (btnExpDir) btnExpDir.addEventListener('click', () => {
      if (window.registrarEvento) window.registrarEvento('csv', 'directorio')
      const cel = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`
      const nd = (v, d) => v == null || v === '' ? '' : cel(dec(v, d))
      const cab = ['ID Scopus', 'Investigador', 'Publicaciones', 'Citas', 'Índice h', 'Índice i10', 'Índice g', 'Citas por publicación', 'Índice m',
        'Primer año', 'Último año', 'Afiliación UTM vigente'].map(cel).join(',')
      const filas = filtrar().map(a => [cel(scopusIdsAutor(a).join('; ')), cel(a.n), a.P || 0, a.C || 0, a.h || 0, a.i10 || 0, a.g || 0, nd(a.CP, 2), nd(a.m, 2),
        a.pa || '', a.ua || '', cel(a.xu ? 'No' : 'Sí')].join(','))
      const hoy = new Date().toISOString().slice(0, 10)
      descargarArchivo(`directorio-utm-${hoy}.csv`, '\uFEFF' + [cab, ...filas].join('\n'), 'text/csv;charset=utf-8')
    })
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
      const pr = document.getElementById('panRevPane'), pa = document.getElementById('panAreaPane'), pc = document.getElementById('panColPane')
      if (pr) pr.style.display = estado.panTab === 'rev' ? '' : 'none'
      if (pa) pa.style.display = estado.panTab === 'area' ? '' : 'none'
      if (pc) pc.style.display = estado.panTab === 'col' ? '' : 'none'
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
    hojaFiltros({ btn: 'btnFiltros', hoja: 'hojaFiltros', vel: 'hojaVel' }, {
      contar: () => filtrar().length, unidad: ['investigador', 'investigadores'],
      activos: () => (estado.area ? 1 : 0) + (estado.soloVig ? 1 : 0) + (estado.orden !== 'P' ? 1 : 0),
    })
  }

  // ---------- panel de filtros en celular (hoja inferior) ----------
  // En pantallas anchas la hoja no se ve y los controles quedan en la barra. En celular, el botón
  // "Filtros" abre la hoja desde abajo; los cambios se aplican al momento y "Ver N" solo la cierra.
  let hojaResize = null
  function hojaFiltros(ids, { contar, activos, unidad }) {
    const btn = document.getElementById(ids.btn), hoja = document.getElementById(ids.hoja), vel = document.getElementById(ids.vel)
    if (!btn || !hoja || !vel) return
    const cerrar = () => {
      hoja.classList.remove('abierta'); vel.classList.remove('on')
      document.body.classList.remove('hoja-abierta')
      btn.setAttribute('aria-expanded', 'false')
    }
    const abrir = () => {
      actualizar()
      hoja.classList.add('abierta'); vel.classList.add('on')
      document.body.classList.add('hoja-abierta')
      btn.setAttribute('aria-expanded', 'true')
      const primero = hoja.querySelector('select, input, button.btn-filtro-vig')
      if (primero) primero.focus({ preventScroll: true })
    }
    function actualizar() {
      const n = activos()
      const bn = btn.querySelector('.btn-filtros-n')
      if (bn) { bn.textContent = n ? String(n) : ''; bn.hidden = !n }
      const pie = hoja.querySelector('.hoja-aplicar')
      if (pie) { const t = contar(); pie.textContent = `Ver ${num(t)} ${t === 1 ? unidad[0] : unidad[1]}` }
    }
    btn.addEventListener('click', () => (hoja.classList.contains('abierta') ? cerrar() : abrir()))
    vel.addEventListener('click', cerrar)
    hoja.querySelectorAll('[data-cerrar-hoja]').forEach(b => b.addEventListener('click', () => { cerrar(); btn.focus({ preventScroll: true }) }))
    hoja.addEventListener('change', () => setTimeout(actualizar, 0))
    hoja.addEventListener('click', ev => { if (ev.target.closest('.btn-filtro-vig, .btn-filtro')) setTimeout(actualizar, 0) })
    hoja.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.stopPropagation(); cerrar(); btn.focus({ preventScroll: true }); return }
      if (ev.key !== 'Tab') return
      const foco = [...hoja.querySelectorAll('select, input, button')].filter(e => e.offsetParent !== null)
      if (!foco.length) return
      const a = foco[0], z = foco[foco.length - 1]
      if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus() }
      else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus() }
    })
    if (hojaResize) window.removeEventListener('resize', hojaResize)
    hojaResize = () => { if (window.innerWidth > 640) cerrar() }
    window.addEventListener('resize', hojaResize)
    actualizar()
    return actualizar
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

  // Revistas y conferencias con su número de publicaciones, para las sugerencias del buscador.
  let REV_SUG = null
  function revistasSug() {
    if (!REV_SUG) {
      const m = new Map()
      D.pubs.forEach(p => { if (p.j) m.set(p.j, (m.get(p.j) || 0) + 1) })
      REV_SUG = [...m.entries()].map(([n, c]) => [n, c, norm(n)]).sort((a, b) => b[1] - a[1])
    }
    return REV_SUG
  }
  // Abre la ventana de publicaciones de una revista, como al hacer clic en ella en cualquier gráfica.
  function abrirRevista(nombre, origen) {
    const t = document.createElement('span')
    t.dataset.cat = 'revista'; t.dataset.val = nombre
    t.style.cssText = 'position:fixed;left:50%;top:25%;width:1px;height:1px;pointer-events:none'
    app.appendChild(t)
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: Math.round(window.innerWidth / 2), clientY: Math.round(window.innerHeight * 0.25) }))
    t.remove()
  }

  function wireBuscadorHero() {
    const inp = document.getElementById('qHero'); if (!inp) return
    const caja = document.getElementById('qHeroSug')
    let halla = [], sel = -1, timerBusq = 0
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
      // Se registra la búsqueda cuando la persona deja de escribir (sin guardar nada más que el texto)
      clearTimeout(timerBusq)
      timerBusq = setTimeout(() => {
        if (txt.length >= 3 && window.registrarEvento) window.registrarEvento('busqueda', norm(txt), halla.length + porTema.size)
      }, 1500)
      const visTema = [...porTema.entries()]
        .map(([uid, n]) => ({ a: porId.get(uid), n }))
        .sort((x, y) => y.n - x.n || (y.a.C || 0) - (x.a.C || 0))
        .slice(0, 4)

      // Áreas temáticas de Scopus que coinciden
      const visAreas = GI.todasAreas
        .filter(([ar]) => { const na = norm(ar); return tokens.every(tk => na.includes(tk)) })
        .slice(0, 3)

      // Revistas y conferencias que coinciden con el texto
      const visRev = txt.length >= 3
        ? revistasSug().filter(([, , nn]) => tokens.every(tk => nn.includes(tk))).slice(0, 3)
        : []

      let html = ''
      if (visAut.length) {
        if (visTema.length || visAreas.length || visRev.length) html += '<div class="hx-sec">Investigadores</div>'
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
      if (visRev.length) {
        html += '<div class="hx-sec">Revistas y conferencias</div>'
        html += visRev.map(([n, c]) => `<button type="button" role="option" data-revista="${esc(n)}">
          <span class="hx-area-ic">${ico('fuente')}</span>
          <span class="sn">${esc(n)}</span>
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
      caja.querySelectorAll('button[data-revista]').forEach(b =>
        b.addEventListener('mousedown', (ev) => { ev.preventDefault(); cerrar(); inp.blur(); abrirRevista(b.dataset.revista) }))
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
    const topAr8 = GI.topAreas.slice(0, 15)
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
    const tabPan = estado.panTab === 'area' || estado.panTab === 'col' ? estado.panTab : 'rev'
    // Distribución institucional por cuartil SJR y tipo, con las mismas métricas del perfil
    const gq = {}, gt = {}
    let gAut = 0, gPrim = 0, gCit = 0
    D.pubs.forEach(p => {
      gq[p.q] = (gq[p.q] || 0) + 1
      gt[p.st || 'Otro'] = (gt[p.st || 'Otro'] || 0) + 1
      gAut += p.nc || (p.au || []).length || 1
      if (p.fa != null && porId.has(String(p.fa))) gPrim++
      if ((p.c || 0) > 0) gCit++
    })
    const nP = D.pubs.length || 1
    const distHTML = `<div class="panel"><h3>Distribución por cuartil SJR y tipo</h3>${donut(gq)}
        <div class="subtitulo-panel">Por tipo de documento</div>${tiposBarras(gt)}
        <div class="metricas-autoria">
          <div class="ma"><b>${dec(gAut / nP, 1)}</b><span>Autores por publicación (promedio)</span></div>
          <div class="ma"><b>${Math.round(100 * gPrim / nP)}%</b><span>Publicaciones con primer autor UTM</span></div>
          <div class="ma"><b>${dec(100 * gCit / nP, 1)}%</b><span>Publicaciones con al menos 1 cita</span></div>
        </div>
        <div class="ctx-hint">Clic en un cuartil o tipo para ver sus publicaciones.</div></div>`
    return `<div class="wrap portada" style="padding-bottom:0">
      <h2 class="dir-tit">Panorama institucional</h2>
      <div class="ayuda-filtros">Producción científica de la Universidad Técnica de Manabí indexada en Scopus, en conjunto.</div>
      <div class="panel" style="margin-bottom:16px"><h3>Publicaciones por año</h3>${barsAnio(GI.porAnio, 200)}${infoAnios(GI.porAnio)}
        <div class="ctx-hint">Clic en una barra para ver las publicaciones de ese año.</div></div>
      <div class="grid2">
        ${distHTML}
        <div class="panel"><h3>Fuentes, temas y colaboración</h3>
          <div class="top-tabs" style="margin-bottom:12px">
            <button type="button" class="top-tab pan-tab${tabPan === 'rev' ? ' on' : ''}" data-pan="rev">${ico('pubs')}<span>Fuentes</span></button>
            <button type="button" class="top-tab pan-tab${tabPan === 'area' ? ' on' : ''}" data-pan="area">${ico('cuartil')}<span>Áreas temáticas</span></button>
            <button type="button" class="top-tab pan-tab${tabPan === 'col' ? ' on' : ''}" data-pan="col">${ico('globe')}<span>Colaboración internacional</span></button>
          </div>
          <div id="panRevPane" style="${tabPan === 'rev' ? '' : 'display:none'}">
            <div class="tipos-barras">${revHTML}</div>
            <div class="ctx-hint">Clic en una fuente para ver sus publicaciones más recientes.</div>
          </div>
          <div id="panAreaPane" style="${tabPan === 'area' ? '' : 'display:none'}">
            <div class="tipos-barras">${areaHTML}</div>
            <div class="ctx-hint">Clic en un área para ver sus publicaciones o en ↗ para abrir el área completa.</div>
          </div>
          <div id="panColPane" style="${tabPan === 'col' ? '' : 'display:none'}">
            <div class="metricas-autoria intl" style="margin-top:0;border-top:none;padding-top:0">
              <div class="ma"><b>${GI.pctIntl}%</b><span>Publicaciones con coautoría internacional</span></div>
              <div class="ma"><b>${GI.nPaises}</b><span>Países colaboradores</span></div>
            </div>
            <div class="ce-sub">Principales países</div>
            <div class="ce-chips">${paisesHTML}</div>
            <div class="ctx-hint">Clic en un país para ver las publicaciones y los autores que colaboran.</div>
          </div>
        </div>
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
      <div class="ayuda-filtros">Cambios entre la actualización anterior (${fechaCorta(N.fb)}) y la última (${fechaCorta(N.fa)}). <a href="novedades.xml" target="_blank" rel="noopener noreferrer" data-nueva="1" title="Feed RSS para recibir estas novedades en un lector de noticias">Suscribirse por RSS</a></div>
      <div class="grid2${nuevos.length ? '' : ' grid1'}">
        <div class="panel"><h3>Autores con nuevas publicaciones o citas <span class="nov-cuenta">${num(conNov.length)}</span></h3>
          ${listaNov('novAutores', conNov)}</div>
        ${nuevos.length
          ? `<div class="panel"><h3>Autores nuevos <span class="nov-cuenta">${num(nuevos.length)}</span></h3>
          <div class="ayuda-filtros" style="margin:-4px 0 8px">Aparecen por primera vez en el portal.</div>
          ${listaNov('novNuevos', nuevos)}</div>`
          : ''}
      </div>
      ${nuevos.length ? '' : '<div class="ayuda-filtros">No hay autores nuevos en esta actualización.</div>'}
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

  function scopusIdsAutor(a) {
    return [...new Set([a.id, ...(a.fx || [])].filter(Boolean).map(String))]
  }

  // Identificadores de Scopus del autor: uno si el perfil es único, o todos los
  // que se unificaron. Cada uno enlaza a su ficha en Scopus.
  function idsScopusHTML(a) {
    const ids = scopusIdsAutor(a)
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
      puntos += `<circle cx="${cx.toFixed(1)}" cy="${yH(r.h).toFixed(1)}" r="3" fill="#e0902d" stroke="#fff" stroke-width="1.2"><title>${r.y}: índice h ${r.h}</title></circle>`
      if (cambia) puntos += `<text x="${cx.toFixed(1)}" y="${(yH(r.h) - 7).toFixed(1)}" font-size="10" font-weight="700" text-anchor="middle" fill="#9a5f0a" stroke="#fff" stroke-width="2.6" paint-order="stroke">${r.h}</text>`
      zonas += `<rect x="${(i * paso).toFixed(1)}" y="0" width="${paso.toFixed(1)}" height="${base}" fill="transparent" data-cat="anio" data-val="${r.y}" style="cursor:pointer"><title>Ver publicaciones de ${r.y}</title></rect>`
    })
    const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H + 14}px" role="img" aria-label="Índice h acumulado y citas por año de publicación">
      <line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="#e6e9e1"/>${barras}
      <polyline points="${pts.join(' ')}" fill="none" stroke="#e0902d" stroke-width="2.2"/>${puntos}${ejeAnios(serie, paso, base)}${zonas}</svg>`
    return conTabla(svg, 'Índice h acumulado y citas por año',
      [{ t: 'Año' }, { t: 'Índice h acumulado', num: true }, { t: 'Citas recibidas', num: true }],
      serie.map(r => [r.y + (r.y >= ANIO_ACTUAL ? '*' : ''), r.h, num(r.c)]))
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
    const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Rol de autoría por año">${s}</svg>`
    return conTabla(svg, 'Rol de autoría por año',
      [{ t: 'Año' }, { t: 'Primer autor', num: true }, { t: 'Autor intermedio', num: true }, { t: 'Último autor', num: true }],
      serie.map(d => [d.y + (d.y >= ANIO_ACTUAL ? '*' : ''), d.primero, d.medio, d.ultimo]))
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
    if (pts.length > 1) s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#e0902d" stroke-width="2.2"/>`
    pts.forEach(pt => { const [px, py] = pt.split(','); s += `<circle cx="${px}" cy="${py}" r="3" fill="#e0902d" stroke="#fff" stroke-width="1.2" style="pointer-events:none"/>` })
    const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H + 14}px" role="img" aria-label="Porcentaje de publicaciones en Q1 y Q2 por año">${s}${ejeAnios(serie, paso, base)}</svg>`
    return conTabla(svg, 'Porcentaje de publicaciones en Q1 y Q2 por año',
      [{ t: 'Año' }, { t: 'Q1 y Q2', num: true }, { t: 'Con cuartil', num: true }, { t: '% Q1 y Q2', num: true }],
      serie.filter(r => r.nq > 0).map(r => [r.y + (r.y >= ANIO_ACTUAL ? '*' : ''), r.q12, r.nq, Math.round(100 * r.q12 / r.nq) + '%']))
  }

  // Hitos del investigador: primeras veces y cifras redondas, a partir de sus publicaciones y de su serie anual.
  function hitosAutor(pubs, id, serie) {
    const cron = pubs.filter(p => p.y).sort((a, b) => claveFecha(a).localeCompare(claveFecha(b)))
    if (!cron.length) return []
    const corto = t => { const x = String(t || 'Sin título'); return x.length > 95 ? x.slice(0, 92).trimEnd() + '…' : x }
    const out = []
    const poner = (y, et, p) => out.push({ y, et, t: p ? corto(p.t) : '', p })
    poner(cron[0].y, 'Primera publicación en Scopus', cron[0])
    const q1 = cron.find(p => p.q === 'Q1')
    if (q1) poner(q1.y, 'Primera publicación en una revista Q1', q1)
    else { const q2 = cron.find(p => p.q === 'Q2'); if (q2) poner(q2.y, 'Primera publicación en una revista Q2', q2) }
    const pa = cron.find(p => rolEnPub(p, id) === 'primero')
    if (pa && pa !== cron[0]) poner(pa.y, 'Primera publicación como primer autor', pa)
    ;[10, 25, 50, 100, 150, 200, 300].forEach(n => { if (cron.length >= n) poner(cron[n - 1].y, `Publicación número ${n}`, cron[n - 1]) })
    ;[5, 10, 15, 20, 30, 40].forEach(n => {
      const r = serie.find(x => x.h >= n)
      if (r) poner(r.y, `Índice h de ${n}`, null)
    })
    const porAnio = {}
    cron.forEach(p => { porAnio[p.y] = (porAnio[p.y] || 0) + 1 })
    const mejor = Object.entries(porAnio).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]
    if (mejor && mejor[1] >= 3) out.push({ y: +mejor[0], et: `Año más productivo: ${mejor[1]} publicaciones`, t: '', p: null })
    return out.sort((a, b) => a.y - b.y)
  }
  function hitosHTML(hitos) {
    return `<div class="hitos">${hitos.map(h => `<div class="hito"><span class="hito-y">${h.y}</span><span class="hito-p" aria-hidden="true"></span>
      <div class="hito-c"><b>${esc(h.et)}</b>${h.t ? `<span>${h.p && h.p.doi ? `<a href="https://doi.org/${esc(h.p.doi)}" target="_blank" rel="noreferrer" title="Abrir la publicación">${esc(h.t)}</a>` : esc(h.t)}</span>` : ''}</div></div>`).join('')}</div>`
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
    const hitos = hitosAutor(pubs, id, serie)
    const parcial = serie.some(r => r.y >= ANIO_ACTUAL)
    const ast = parcial ? `<span><em>* Año en curso: cifra parcial.</em></span>` : ''
    return `<div class="panel panel-evo"><h2>Evolución en el tiempo</h2>
      <div class="top-tabs" style="margin-bottom:12px">
        <button type="button" class="top-tab evo-tab on" data-evo="h">${ico('trayectoria')}<span>Índice h y citas</span></button>
        <button type="button" class="top-tab evo-tab" data-evo="rol">${ico('rol')}<span>Rol de autoría</span></button>
        <button type="button" class="top-tab evo-tab" data-evo="q">${ico('calidad')}<span>Calidad de las revistas</span></button>
        ${hitos.length >= 2 ? `<button type="button" class="top-tab evo-tab" data-evo="hitos">${ico('citas')}<span>Hitos</span></button>` : ''}
      </div>
      <div class="evo-pane" data-evo="h">
        <div class="evo-tit">Índice h acumulado (línea naranja) y citas de las publicaciones de cada año (barras)</div>
        <div data-lazy-graf="evo-h"><div class="graf-skeleton">Cargando gráfico…</div></div>
        <div class="info-anios"><span>Índice h al cierre <b>${hFinal}</b></span><span>Citas <b>${num(citas)}</b></span>${ast}</div>
        <div class="ctx-hint">El índice h de cada año usa las publicaciones hasta ese año con sus citas actuales en Scopus, y las barras suman las citas que hoy tienen las publicaciones de ese año. Scopus no entrega el historial de citas año a año.</div>
      </div>
      <div class="evo-pane" data-evo="rol" style="display:none">
        <div class="evo-tit">Publicaciones por año según el lugar del investigador en la firma</div>
        <div data-lazy-graf="evo-rol"><div class="graf-skeleton">Cargando gráfico…</div></div>
        <div class="evo-leyenda">${['primero', 'medio', 'ultimo'].map(r => `<span data-cat="rol" data-val="${r}" style="cursor:pointer" title="Ver estas publicaciones"><i style="background:${ROL_COL[r]}"></i>${ROL_ET[r]} <b>${nRol(r)}</b> (${pct(nRol(r), tot)}%)</span>`).join('')}</div>
        <div class="info-anios">${notaRol}${ast}</div>
        ${LA_DISP ? '' : '<div class="ctx-hint">El último autor se estima por el apellido en la lista de firmantes; se afina al regenerar los datos del sitio.</div>'}
        <div class="ctx-hint">Clic en una burbuja para ver las publicaciones de ese año y rol.</div>
      </div>
      <div class="evo-pane" data-evo="q" style="display:none">
        <div class="evo-tit">Porcentaje de publicaciones en revistas Q1 o Q2 de cada año</div>
        <div data-lazy-graf="evo-q"><div class="graf-skeleton">Cargando gráfico…</div></div>
        <div class="info-anios"><span>Q1 y Q2 en total: <b>${nq ? pct(q12, nq) + '%' : 'N/D'}</b> (${q12} de ${nq})</span>${notaQ}${ast}</div>
        <div class="ctx-hint">Solo cuentan las publicaciones con cuartil SJR (Q1 a Q4); ponencias, capítulos y libros quedan fuera. Clic en una barra para ver sus publicaciones Q1 y Q2.</div>
      </div>
      ${hitos.length >= 2 ? `<div class="evo-pane" data-evo="hitos" style="display:none">
        <div class="evo-tit">Primeras veces y cifras redondas de su trayectoria en Scopus</div>
        ${hitosHTML(hitos)}
      </div>` : ''}
    </div>`
  }
  function wireEvolucion(alCambiar) {
    const tabs = [...document.querySelectorAll('.evo-tab')]
    const panes = [...document.querySelectorAll('.evo-pane')]
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.toggle('on', x === t))
      panes.forEach(p => { p.style.display = p.dataset.evo === t.dataset.evo ? '' : 'none' })
      if (alCambiar) alCambiar(t.dataset.evo)
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
    return `<div class="panel panel-tev panel-fuentes" style="margin-bottom:18px"><h2>Temas y fuentes de publicación</h2>
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
  const citasPorAnio = p => {
    if (!p || !(p.c > 0) || !p.y || p.y > ANIO_ACTUAL) return 0
    return p.c / Math.max(1, ANIO_ACTUAL - p.y + 1)
  }
  const esEnAscenso = (p, cpaRef) => {
    if (!p || !p.y || p.y > ANIO_ACTUAL || p.y < ANIO_ACTUAL - 3 || (p.c || 0) < 3) return false
    const tasa = citasPorAnio(p)
    const mediaAnio = MEDIA_ANIO[p.y] ? MEDIA_ANIO[p.y] / Math.max(1, ANIO_ACTUAL - p.y + 1) : 0
    return tasa >= Math.max(2, (cpaRef || 0) * 1.5, mediaAnio * 1.4)
  }

  // Envuelve cualquier gráfico con un botón "Ver como tabla" para lectores de pantalla y copia a Excel.
  function conTabla(grafHtml, caption, cols, rows) {
    if (!rows || !rows.length) return grafHtml
    const ths = cols.map(c => `<th scope="col"${c.num ? ' class="num"' : ''}>${esc(c.t)}</th>`).join('')
    const trs = rows.map(r => `<tr>${r.map((v, i) => `<td${cols[i] && cols[i].num ? ' class="num"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')
    return `<div class="graf-wrap">
      <div class="graf-vis">${grafHtml}</div>
      <div class="graf-tbl" hidden><div class="graf-tbl-scroll">
        <table class="graf-tabla" aria-label="${esc(caption)}"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
      </div></div>
      <div class="graf-pie-ctrl"><button type="button" class="btn-graf-tbl" aria-expanded="false">${ico('tabla')}<span>Ver como tabla</span></button></div>
    </div>`
  }

  // Dibujo diferido de gráficos: se montan al entrar en pantalla (o antes de imprimir).
  let grafObs = null
  let grafMaterializarTodo = null
  function limpiarGrafObs() {
    if (grafObs) { grafObs.disconnect(); grafObs = null }
    grafMaterializarTodo = null
  }
  function observarGraficosLazy(mapaRender) {
    limpiarGrafObs()
    const cargar = el => {
      const k = el && el.getAttribute('data-lazy-graf')
      if (!k || !mapaRender[k]) return
      el.removeAttribute('data-lazy-graf')
      el.innerHTML = mapaRender[k]()
      if (grafObs) grafObs.unobserve(el)
    }
    grafMaterializarTodo = () => {
      document.querySelectorAll('[data-lazy-graf]').forEach(cargar)
    }
    const nodos = [...document.querySelectorAll('[data-lazy-graf]')]
    if (!nodos.length) return
    if (typeof IntersectionObserver === 'undefined') { nodos.forEach(cargar); return }
    grafObs = new IntersectionObserver(ents => {
      ents.forEach(e => { if (e.isIntersecting) cargar(e.target) })
    }, { rootMargin: '220px 0px' })
    nodos.forEach(el => grafObs.observe(el))
  }
  window.addEventListener('beforeprint', () => { if (grafMaterializarTodo) grafMaterializarTodo() })
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
    return `<div class="panel panel-dest"><h2>Publicaciones destacadas</h2><div class="dest-grid">${d.map(x => {
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
    const html = `<div class="mapa-colab"><div class="mapa-scroll"><svg viewBox="0 12 ${M.w} ${M.h - 56}" width="100%" role="img" aria-label="Mapa de países de los coautores">${base}${sobre}</svg></div>
      <div class="mapa-leyenda"><span>1 pub.</span><span class="mapa-barra">${ESC.map(c => `<i style="background:${c}"></i>`).join('')}</span><span>${max} pub.</span>
      <em>Clic en un país para ver las publicaciones conjuntas.</em></div>
      </div>`
    return conTabla(html, 'Colaboración por país',
      [{ t: 'País' }, { t: 'Publicaciones conjuntas', num: true }],
      px.map(([pais, n]) => [pais, num(n)]))
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
  // Ficha de una página (A4): se arma al momento, se muestra solo al imprimir y se retira después.
  function fichaHTML(a) {
    const pubsA = (D.porAutor[a.id] || []).map(i => D.pubs[i])
    const top = [...pubsA].sort((x, y) => (y.c || 0) - (x.c || 0) || (y.y || 0) - (x.y || 0)).slice(0, 8)
    const cuenta = {}
    pubsA.forEach(p => (p.a || []).forEach(ar => { cuenta[ar] = (cuenta[ar] || 0) + 1 }))
    const areas = Object.entries(cuenta).sort((x, y) => y[1] - x[1]).slice(0, 5).map(x => x[0])
    const url = location.href.split('#')[0].replace(/[^/]*$/, '') + 'p/' + encodeURIComponent(a.id) + '.html'
    const kpis = [['Publicaciones', num(a.P)], ['Citas', num(a.C)], ['Índice h', a.h], ['Índice i10', a.i10],
      ['Índice g', a.g ?? 0], ['Citas / pub.', dec(a.CP, 2)]]
    const fecha = D.fecha ? String(D.fecha).split(' ')[0] : ''
    return `<div class="ficha-hoja">
      <div class="ficha-cab"><img src="logo_utm_2022.png" alt="Universidad Técnica de Manabí"><span>Ficha de investigador · Scopus</span></div>
      <h1 class="ficha-nombre">${esc(a.n)}</h1>
      <div class="ficha-sub">Universidad Técnica de Manabí · ID Scopus ${esc(a.id)}${a.or ? ' · ORCID ' + esc(a.or) : ''}</div>
      <div class="ficha-kpis">${kpis.map(([e, v]) => `<div><b>${v}</b><span>${e}</span></div>`).join('')}</div>
      ${areas.length ? `<div class="ficha-sec">Áreas principales</div><div class="ficha-areas">${areas.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      <div class="ficha-sec">Publicaciones más citadas</div>
      <table class="ficha-tabla"><tbody>${top.map(p => `<tr><td class="y">${p.y || ''}</td>
        <td><div class="t">${esc(p.t || '')}</div><div class="j">${esc(p.j || '')}${p.q && p.q !== 'N/A' ? ' · ' + esc(p.q) : ''}</div></td>
        <td class="c"><b>${num(p.c)}</b><span>citas</span></td></tr>`).join('')}</tbody></table>
      <div class="ficha-pie"><div class="ficha-qr">${qrSvg(url)}</div>
        <div><b>Perfil completo en línea</b><br>${esc(url)}<br><span>Datos de Scopus${fecha ? ' al ' + esc(fecha) : ''}.</span><br><span class="ficha-obs">Generado por el observatorio Investigadores UTM, parte del proyecto de investigación ObservaIA</span></div></div>
    </div>`
  }
  function imprimirFicha(a) {
    document.getElementById('fichaPrint')?.remove()
    const div = document.createElement('div')
    div.id = 'fichaPrint'
    div.innerHTML = fichaHTML(a)
    document.body.appendChild(div)
    document.body.classList.add('imprime-ficha')
    const limpiar = () => {
      document.body.classList.remove('imprime-ficha')
      div.remove()
      window.removeEventListener('afterprint', limpiar)
    }
    window.addEventListener('afterprint', limpiar)
    const img = div.querySelector('img')
    const lanzar = () => window.print()
    if (img && !img.complete) { img.addEventListener('load', lanzar, { once: true }); img.addEventListener('error', lanzar, { once: true }) }
    else lanzar()
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
  // Ruta de navegación: "Inicio › página actual". El primer tramo vuelve a la portada.
  const migas = actual => `<nav class="migas" aria-label="Ruta de navegación"><a href="#/" title="Volver a la página principal"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7.5 9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg><span>Inicio</span></a><span class="mg-sep" aria-hidden="true">›</span><span class="mg-act" aria-current="page">${esc(actual)}</span></nav>`
  function renderPerfil(id, mantenerScroll) {
    const a = porId.get(id)
    if (!a) {
      perfilPubs = null
      aplicarFiltroCtxPubs = null
      limpiarGrafObs()
      const unif = D.autores.find(x => (x.fx || []).map(String).includes(String(id)))
      const sug = unif
        ? [unif]
        : D.autores.filter(x => norm(x.n).includes(norm(id))).slice(0, 6)
      const dest = sug.length ? sug : [...D.autores].sort((x, y) => (y.P || 0) - (x.P || 0)).slice(0, 6)
      app.innerHTML = `<div class="wrap">${migas('Investigador no encontrado')}
        <div class="panel nf-panel">
          <h1>${unif ? 'Este perfil fue unificado en Scopus' : 'Investigador no encontrado'}</h1>
          <p>${unif
            ? `El identificador <b>${esc(id)}</b> ahora forma parte del perfil principal de <b>${esc(unif.n)}</b>.`
            : `No existe un investigador con el identificador «${esc(id)}». Puede deberse a una fusión de perfiles o a un enlace antiguo. Busca por nombre o apellido:`}</p>
          ${unif ? `<p><a class="btn-ext" style="display:inline-flex;background:var(--g2);color:#fff;border-color:var(--g2)" href="#/autor/${encodeURIComponent(unif.id)}">Abrir perfil de ${esc(unif.n)} →</a></p>` : ''}
          <div class="nf-busq">
            <input id="nfQ" type="search" placeholder="Escribe un nombre, apellido o ID de Scopus…" aria-label="Buscar investigador">
            <a class="btn-ext" href="#/">Ir al directorio completo</a>
          </div>
          <div class="subtitulo-panel" id="nfSub">${unif ? 'Perfil unificado' : (sug.length ? 'Coincidencias cercanas' : 'Investigadores destacados en la UTM')}</div>
          <div class="nf-sug" id="nfSug">${dest.map(cardInv).join('')}</div>
        </div></div>`
      const inp = document.getElementById('nfQ')
      const caja = document.getElementById('nfSug')
      const sub = document.getElementById('nfSub')
      if (inp && caja) {
        inp.addEventListener('input', () => {
          const tks = norm(inp.value).trim().split(/\s+/).filter(Boolean)
          if (!tks.length) {
            sub.textContent = unif ? 'Perfil unificado' : 'Investigadores destacados en la UTM'
            caja.innerHTML = dest.map(cardInv).join('')
            return
          }
          const halla = D.autores.filter(x => {
            const tx = norm(x.n) + ' ' + String(x.id || '') + ' ' + (x.fx || []).join(' ')
            return tks.every(k => tx.includes(k))
          }).slice(0, 9)
          sub.textContent = halla.length ? `Resultados (${halla.length})` : 'Sin coincidencias'
          caja.innerHTML = halla.length ? halla.map(cardInv).join('') : '<div class="vacio">Ningún investigador coincide con esa búsqueda.</div>'
        })
      }
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
      ${migas(a.n)}
      <div class="perfil-hero">
        ${avatar(a)}
        <div style="flex:1;min-width:240px">
          <h1>${esc(a.n)}</h1>
          ${a.xu ? `<div class="ex-utm" title="Conserva su producción con filiación UTM, pero su afiliación actual en Scopus ya no es la UTM.">⚑ Sin afiliación vigente con la Universidad Técnica de Manabí.</div>` : ''}
          <div class="sub">Autor UTM en Scopus · Activo ${a.pa || 'N/D'} a ${a.ua || 'N/D'}${a.rP ? ` · ${(() => {
            const pct = Math.max(1, Math.ceil(100 * a.rP / TOTAL_AUT))
            return pct <= 50 ? `Puesto ${a.rP} en publicaciones en la UTM · ${pct}% superior` : `Puesto ${a.rP} de ${num(TOTAL_AUT)} en publicaciones en la UTM`
          })()}` : ''}</div>
          ${idsScopusHTML(a)}
          <div class="pie-print-ficha">Dirección de Investigación · Observatorio de Investigadores de la Universidad Técnica de Manabí, parte del proyecto de investigación <b>ObservaIA</b></div>
          <div class="enlaces">
            <a class="btn-ext" href="https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(a.id)}" target="_blank" rel="noreferrer">${ico('scopus')}<span>Perfil en Scopus ↗</span></a>
            ${a.or
        ? `<a class="btn-ext" href="https://orcid.org/${esc(a.or)}" target="_blank" rel="noreferrer">${ico('orcid')}<span>ORCID ${esc(a.or)} ↗</span></a>`
        : `<a class="btn-ext" href="https://orcid.org/orcid-search/search?searchQuery=${orcid}" target="_blank" rel="noreferrer">${ico('orcid')}<span>Buscar en ORCID ↗</span></a>`}
            <a class="btn-ext" href="https://scholar.google.com/citations?view_op=search_authors&mauthors=${orcid}" target="_blank" rel="noreferrer">${ico('scholar')}<span>Buscar en Google Scholar ↗</span></a>
            <a class="btn-ext" href="https://www.researchgate.net/search/researcher?q=${orcid}" target="_blank" rel="noreferrer">${ico('rg')}<span>Buscar en ResearchGate ↗</span></a>
            <button type="button" class="btn-ext btn-print" id="btnFichaA4" title="Ficha de una página (A4) con indicadores, mejores publicaciones y código QR, lista para guardar en PDF">${ico('print')}<span>Ficha A4</span></button>
            <button type="button" class="btn-ext" id="btnCompartir" title="Copia el enlace del perfil. Al pegarlo en WhatsApp, LinkedIn o correo se muestra una tarjeta con sus indicadores">${ico('enlace')}<span>Copiar enlace para WhatsApp</span></button>
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
        ${kpi(dec(kCP, 2), 'Citas / pub.', subRank(R.CP, R.CP ? puestoTxt(R.CP, TOTAL_CP) : `Mín. ${MIN_PUBS_CP} pub. para puesto`), AY.CP)}
        ${kpi(kI10, 'Índice i10', subRank(R.i10), AY.i10)}
        ${kpi(kG, 'Índice g', subRank(R.g), AY.g)}
        ${kpi(dec(kM, 2), 'Índice m', subRank(R.m), AY.m)}
        ${kpi(pctOA + '%', 'Acceso abierto', per === 'todo' ? (R.oa && R.oa <= 100 ? puestoTxt(R.oa) : '') : etPer, AY.oa)}
      </div>
      ${destacadasHTML(pubs, a.id)}

      <div class="grid2">
        <div class="panel"><h2>Publicaciones por año</h2><div data-lazy-graf="anios"><div class="graf-skeleton">Cargando gráfico…</div></div>${infoAnios(porAnio)}
          <div class="ctx-hint">Clic en una barra para ver las publicaciones de ese año.</div></div>
        <div class="panel"><h2>Distribución por cuartil SJR y tipo</h2><div data-lazy-graf="donut"><div class="graf-skeleton">Cargando gráfico…</div></div>
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

      <div class="panel" style="margin-bottom:18px"><h2>Coautorías</h2>${coautoriaExterna(extData, coaut.length, a.n)}</div>

      ${panelPubsHTML('Publicaciones', pubs.length, true, a.id)}
    </div>
    ${TOP_PAGE_HTML}`

    if (mantenerScroll) window.scrollTo(0, scrollPrev)

    const btnFicha = document.getElementById('btnFichaA4')
    if (btnFicha) btnFicha.addEventListener('click', () => imprimirFicha(a))
    const btnComp = document.getElementById('btnCompartir')
    if (btnComp) btnComp.addEventListener('click', () => {
      const lbl = btnComp.querySelector('span'), orig = lbl.textContent
      const url = location.href.split('#')[0].replace(/[^/]*$/, '') + 'p/' + encodeURIComponent(a.id) + '.html'
        // El parámetro cambia con cada actualización de datos: así WhatsApp y LinkedIn vuelven a leer la tarjeta
        + '?v=' + String(D.fecha || '').replace(/\D/g, '')
      copiarTexto(url)
        .then(() => { lbl.textContent = 'Enlace copiado, pégalo en WhatsApp' })
        .catch(() => { lbl.textContent = 'No se pudo copiar' })
      setTimeout(() => { lbl.textContent = orig }, 2200)
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
    const cpas = pubs.map(citasPorAnio).filter(v => v > 0)
    const cpaAutor = cpas.length ? cpas.reduce((s, v) => s + v, 0) / cpas.length : 0
    perfilPubs = pubs   // usado por el manejador delegado del popover
    wirePubs(pubsOrd, p => pubRow(p, topCit.has(p), cpaAutor), a.id, 'publicaciones-' + a.id, leerFiltrosURL())
    const serieEvo = serieAnual(pubs, a.id)
    const grafRenders = {
      anios: () => barsAnio(porAnio),
      donut: () => donut(cq),
      'evo-h': () => svgHCitas(serieEvo),
      'evo-rol': () => svgRoles(serieEvo),
      'evo-q': () => svgCalidad(serieEvo),
      'mapa-pais': () => mapaColab(extData.px || []),
    }
    const cargarGraf = k => {
      const el = document.querySelector(`[data-lazy-graf="${k}"]`)
      if (el && grafRenders[k]) {
        el.removeAttribute('data-lazy-graf')
        el.innerHTML = grafRenders[k]()
        if (grafObs) grafObs.unobserve(el)
      }
    }
    observarGraficosLazy(grafRenders)
    wireEvolucion(clave => cargarGraf('evo-' + clave))
    wireCopiarEnlace()
    const POR_PAG_PANEL = 10
    paginar('coautCont', 'coautPager', coaut, coautRow, POR_PAG_PANEL)
    paginar('revCont', 'revPager', revistas, revistaRow, POR_PAG_PANEL)
    if (extData.cx.length) paginar('ceCoautCont', 'ceCoautPager', extData.cx, coautExtRow, POR_PAG_PANEL)
    if (extData.ix.length) paginar('ceInstCont', 'ceInstPager', extData.ix, instRow, POR_PAG_PANEL)
    if (comStop) { comStop(); comStop = null }
    let comListo = false
    wireCoautExtTabs(key => {
      if (key === 'pais') cargarGraf('mapa-pais')
      if (key === 'com' && !comListo) { comListo = true; wireComunidades(a, pubs) }
    })
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
  let focoOrigen = null
  const escPop = e => {
    if (e.key === 'Escape') { cerrarPop(); return }
    if (!popEl) return
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && popEl.querySelector('.pop-body')) {
      const pane = [...popEl.querySelectorAll('.pop-body')].find(x => x.style.display !== 'none')
      if (pane) {
        const filas = [...pane.querySelectorAll('.ctx-row')]
        if (filas.length) {
          e.preventDefault()
          const cur = filas.findIndex(r => r.classList.contains('kbd-on') || r.contains(document.activeElement))
          const dir = e.key === 'ArrowDown' ? 1 : -1
          const sig = cur < 0 ? (dir > 0 ? 0 : filas.length - 1) : (cur + dir + filas.length) % filas.length
          filas.forEach(r => r.classList.remove('kbd-on'))
          filas[sig].classList.add('kbd-on')
          const foco = filas[sig].querySelector('a, button')
          if (foco) foco.focus({ preventScroll: true })
          filas[sig].scrollIntoView({ block: 'nearest' })
          return
        }
      }
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('pop-tab')) {
      const tabs = [...popEl.querySelectorAll('.pop-tab')]
      const idx = tabs.indexOf(document.activeElement)
      if (idx >= 0 && tabs.length > 1) {
        e.preventDefault()
        const next = tabs[(idx + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
        next.click(); next.focus({ preventScroll: true })
        return
      }
    }
    // Tab queda dentro de la ventana mientras está abierta.
    if (e.key !== 'Tab') return
    const f = [...popEl.querySelectorAll('a[href], button, input, select, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null)
    if (!f.length) { e.preventDefault(); return }
    const i = f.indexOf(document.activeElement)
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus() }
    else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus() }
  }
  // Al abrir: el foco pasa a la ventana. Al cerrar: vuelve al elemento desde el que se abrió.
  function origenPop(ev) {
    let o = document.activeElement
    if (!o || o === document.body) {
      o = ev && ev.target && ev.target.closest ? ev.target.closest('[data-cat],[data-cite]') : null
      if (o && !o.hasAttribute('tabindex') && !/^(a|button|input|select)$/i.test(o.tagName)) o.setAttribute('tabindex', '-1')
    }
    return o
  }
  function armarPop(previo) {
    focoOrigen = previo || null
    popEl.setAttribute('role', 'dialog')
    popEl.setAttribute('aria-label', (popEl.querySelector('.pop-val') || {}).textContent || 'Detalle')
    const x = popEl.querySelector('.pop-x')
    if (x) x.focus({ preventScroll: true })
  }
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
    const o = focoOrigen; focoOrigen = null
    if (o && o.isConnected && o.focus) o.focus({ preventScroll: true })
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
  // Tono de la barra de título del popup, por grupo de función y con la paleta del portal:
  // verde = producción, azul = colaboración, ocre = temas. Cuartil SJR usa el color de cada Q del
  // gráfico de distribución; el rol de autoría, el de su gráfico en versión oscura.
  const POP_TONO = { 'Colaboración internacional': '#2f4f7a', 'Filiación externa': '#2f4f7a', 'Coautor externo': '#2f4f7a',
    'Área temática': '#8a5a0c', 'Tema recurrente': '#8a5a0c' }
  const POP_TONO_ROL = { '#1e6b14': '#185a10', '#e0902d': '#9a5f0a', '#4a6fa5': '#2f4f7a' }
  const POP_CLAROS = ['#7bbf3a', '#e0902d', '#a8a394', '#c9c4b8']
  function tonoPop(sub, color) {
    const c = String(color || '').toLowerCase()
    if (/^Cuartil SJR/.test(sub) && /^#[0-9a-f]{6}$/.test(c)) return c
    if (/^Rol de autoría/.test(sub) && POP_TONO_ROL[c]) return POP_TONO_ROL[c]
    const k = Object.keys(POP_TONO).find(x => sub.startsWith(x))
    return k ? POP_TONO[k] : '#185a10'
  }
  function estiloPop(sub, color) {
    const t = tonoPop(sub, color), claro = POP_CLAROS.includes(t)
    return `--pop-t:${t};--pop-fg:${claro ? '#16210e' : '#fff'};--pop-b:${claro ? '#16210e' : t}`
  }
  function mostrarPopover(ev, titulo, lista, color, autores, autoresUtm, opts) {
    const previo = focoOrigen || origenPop(ev)
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
    const cabHtml = `<div class="pop-cab" style="${estiloPop(sub, color)}">
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
    let cx = ev.clientX, cy = ev.clientY
    if (!cx && !cy && ev.target && ev.target.getBoundingClientRect) {
      const r = ev.target.getBoundingClientRect()
      cx = r.left + r.width / 2; cy = r.bottom
    }
    let x = cx + 12, y = cy + 12
    if (x + w > window.innerWidth - 8) x = Math.max(8, window.innerWidth - w - 8)
    if (y + h > window.innerHeight - 8) y = Math.max(8, cy - h - 12)
    popEl.style.left = x + 'px'; popEl.style.top = y + 'px'
    popEl.querySelector('.pop-x').addEventListener('click', cerrarPop)
    setTimeout(() => document.addEventListener('mousedown', fueraPop, true), 0)
    document.addEventListener('keydown', escPop)
    armarPop(previo)
  }

  // Generación de citas (BibTeX y RIS) y exportación de publicaciones
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

  function tipoRIS(st) {
    const s = String(st || '').toLowerCase()
    if (s.includes('conference')) return 'CONF'
    if (s.includes('chapter')) return 'CHAP'
    if (s === 'book') return 'BOOK'
    return 'JOUR'
  }
  function citaRIS(p) {
    const ty = tipoRIS(p.st)
    const lineas = [`TY  - ${ty}`, `TI  - ${p.t || ''}`]
    const auts = [...(p.au || [])]
    if (p.uf && (p.nc || 0) > auts.length) auts.push(p.uf)
    auts.forEach(a => lineas.push(`AU  - ${a}`))
    if (p.y) lineas.push(`PY  - ${p.y}`)
    if (p.j) lineas.push(`${ty === 'JOUR' ? 'JO' : 'T2'}  - ${p.j}`)
    if (p.doi) {
      lineas.push(`DO  - ${p.doi}`)
      lineas.push(`UR  - https://doi.org/${p.doi}`)
    }
    lineas.push('ER  - ')
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

  function exportarListaCitas(pubs, fmt, baseNombre) {
    const base = baseNombre || 'publicaciones-utm'
    if (fmt === 'csv') {
      const escCsv = s => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`
      const cab = ['Anio', 'Titulo', 'Fuente', 'Cuartil_SJR', 'Tipo', 'Citas', 'Acceso_abierto', 'DOI', 'Autores'].join(',')
      const filas = pubs.map(p => [
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
      descargarArchivo(`${base}.csv`, '\uFEFF' + [cab, ...filas].join('\n'), 'text/csv;charset=utf-8')
    } else if (fmt === 'bib') {
      const contenido = pubs.map((p, i) => citaBibtex(p, i + 1)).join('\n\n') + '\n'
      descargarArchivo(`${base}.bib`, contenido, 'application/x-bibtex;charset=utf-8')
    } else if (fmt === 'ris') {
      const contenido = pubs.map(p => citaRIS(p)).join('\n\n') + '\n'
      descargarArchivo(`${base}.ris`, contenido, 'application/x-research-info-systems;charset=utf-8')
    }
  }

  function ajustarMenuPos(menu) {
    menu.style.left = ''
    menu.style.right = ''
    menu.style.transform = ''
    const vw = document.documentElement.clientWidth || window.innerWidth
    let r = menu.getBoundingClientRect()
    if (r.right > vw - 12) {
      menu.style.left = 'auto'
      menu.style.right = '0'
      r = menu.getBoundingClientRect()
    } else if (r.left < 12) {
      menu.style.left = '0'
      menu.style.right = 'auto'
      r = menu.getBoundingClientRect()
    }
    if (r.left < 12) {
      menu.style.transform = `translateX(${Math.round(12 - r.left)}px)`
    } else if (r.right > vw - 12) {
      menu.style.transform = `translateX(${Math.round((vw - 12) - r.right)}px)`
    }
  }

  function cerrarMenuCita() {
    document.querySelectorAll('.cite-menu').forEach(m => m.remove())
    document.querySelectorAll('.btn-citar[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'))
  }
  function toggleMenuCita(btn, p) {
    const wrap = btn.closest('.cite-drop')
    if (!wrap) return
    const abierto = wrap.querySelector('.cite-menu')
    cerrarMenuCita()
    if (abierto) return
    const menu = document.createElement('div')
    menu.className = 'exp-menu cite-menu'
    menu.setAttribute('role', 'menu')
    menu.innerHTML = `
      <button type="button" role="menuitem" data-ca="csv">${ico('csv')}<span>CSV (.csv)</span></button>
      <button type="button" role="menuitem" data-ca="bib">${ico('bibtex')}<span>BibTeX (.bib)</span></button>
      <button type="button" role="menuitem" data-ca="ris">${ico('bibtex')}<span>RIS (.ris)</span></button>`
    wrap.appendChild(menu)
    btn.setAttribute('aria-expanded', 'true')
    ajustarMenuPos(menu)
    menu.addEventListener('click', ev => {
      const b = ev.target.closest('button[data-ca]')
      if (!b) return
      ev.stopPropagation()
      exportarListaCitas([p], b.dataset.ca, `cita-${p.y || 'utm'}`)
      cerrarMenuCita()
    })
  }

  // panel de publicaciones con filtros cruzados, buscador, exportación y paginación
  function panelPubsHTML(titulo, n, conOrden, autorId) {
    return `<div class="panel" id="panelPubs"><h2 class="h3-flex">
      <span id="pubTitCont" data-base="${esc(titulo)}">${esc(titulo)} (${num(n)})</span>
      <span class="pp-ctrl">
        ${conOrden ? `<select class="selector" id="pubOrden" aria-label="Ordenar publicaciones">
          <option value="recientes">Ordenar: Más recientes</option>
          <option value="citadas">Ordenar: Más citadas</option>
          <option value="ritmo">Ordenar: Citas por año</option>
        </select>` : ''}
        <select class="selector" id="pp" aria-label="Publicaciones por página">
          <option value="10">Ítems por página: 10</option>
          <option value="25">Ítems por página: 25</option>
          <option value="50">Ítems por página: 50</option>
          <option value="0">Ítems por página: Todas</option>
        </select></span></h2>
      <div class="pub-filtros">
        <input id="pubQ" class="entrada pub-busq" placeholder="Filtrar por título, revista, coautor o DOI…" aria-label="Filtrar publicaciones por texto">
        <div class="pub-fchips">
          <button type="button" class="pub-fchip pub-qchip on" data-q="todos" title="Mostrar todos los cuartiles">${ico('cuartil')}<span>Todas</span></button>
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
          <div class="exp-drop">
            <button type="button" class="btn-exp" id="btnExpMenu" aria-haspopup="menu" aria-expanded="false" title="Seleccionar formato para descargar las publicaciones listadas"><span>❞ Citar ▾</span></button>
            <div class="exp-menu" id="expMenu" role="menu" hidden>
              <button type="button" role="menuitem" data-exp="csv">${ico('csv')}<span>CSV (.csv)</span></button>
              <button type="button" role="menuitem" data-exp="bib">${ico('bibtex')}<span>BibTeX (.bib)</span></button>
              <button type="button" role="menuitem" data-exp="ris">${ico('bibtex')}<span>RIS (.ris)</span></button>
            </div>
          </div>
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
    const btnExpMenu = document.getElementById('btnExpMenu')
    const expMenu = document.getElementById('expMenu')
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
        : orden === 'ritmo'
          ? citasPorAnio(b) - citasPorAnio(a) || (b.c || 0) - (a.c || 0)
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
      if (vis.length) {
        cont.innerHTML = vis.map(rowFn).join('')
      } else {
        const hayFiltros = qSel.size > 0 || chips.size > 0 || ctxFiltros.length > 0 || qTxt.trim().length > 0
        cont.innerHTML = `<div class="vacio">Sin publicaciones que coincidan con los filtros activos.${hayFiltros ? ' <button type="button" class="btn-exp" id="btnLimpiarPubFiltros" style="margin-left:8px">Limpiar filtros</button>' : ''}</div>`
        const btnLim = document.getElementById('btnLimpiarPubFiltros')
        if (btnLim) btnLim.addEventListener('click', () => {
          qSel.clear(); chips.clear(); ctxFiltros = []; qTxt = ''
          if (inpQ) inpQ.value = ''
          document.querySelectorAll('.pub-qchip[data-q]').forEach(x => x.classList.toggle('on', x.dataset.q === 'todos'))
          document.querySelectorAll('.pub-fchip[data-pf]').forEach(x => x.classList.remove('on'))
          pagina = 1; filtrarOrdenar(); pinta()
        })
      }
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
    const descargarFormato = fmt => exportarListaCitas(ordenada, fmt, nombreBase)
    if (btnExpMenu && expMenu) {
      const cerrarExp = () => { expMenu.hidden = true; btnExpMenu.setAttribute('aria-expanded', 'false') }
      btnExpMenu.addEventListener('click', ev => {
        ev.stopPropagation()
        const abrir = expMenu.hidden
        expMenu.hidden = !abrir
        btnExpMenu.setAttribute('aria-expanded', abrir ? 'true' : 'false')
        if (abrir) ajustarMenuPos(expMenu)
      })
      expMenu.querySelectorAll('button[data-exp]').forEach(b => b.addEventListener('click', () => {
        descargarFormato(b.dataset.exp)
        cerrarExp()
      }))
    }
    if (sel) sel.addEventListener('change', () => { porPag = +sel.value; pagina = 1; pinta() })
    if (selO) selO.addEventListener('change', () => { orden = selO.value; filtrarOrdenar(); pagina = 1; pinta() })
    if (ini) {
      ini.q.forEach(x => qSel.add(x))
      ;['oa', 'fa', 'cit'].forEach(k => { if (ini[k]) chips.add(k) })
      qTxt = ini.txt || ''
      if (inpQ) inpQ.value = qTxt
      if (ini.ord === 'citadas' || ini.ord === 'ritmo') { orden = ini.ord; if (selO) selO.value = ini.ord }
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
  // Mapa de coautores en móvil: más alto y desplazable; se centra en América al aparecer.
  if (typeof MutationObserver !== 'undefined') new MutationObserver(() => {
    document.querySelectorAll('.mapa-scroll:not([data-c])').forEach(m => {
      m.dataset.c = '1'
      if (m.scrollWidth > m.clientWidth) m.scrollLeft = (m.scrollWidth - m.clientWidth) * 0.2
    })
    document.querySelectorAll('#app [data-cat]:not([tabindex])').forEach(el => {
      if (/^(a|button|input|select)$/i.test(el.tagName)) return
      el.setAttribute('tabindex', '0')
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button')
    })
  }).observe(document.body, { childList: true, subtree: true })
  function notaExUtm(a) {
    return a && a.xu
      ? `<div class="ex-utm-mini" title="Conserva su producción con filiación UTM, pero su afiliación actual en Scopus ya no es la Universidad Técnica de Manabí.">⚑ Sin afiliación vigente</div>`
      : ''
  }
  // Autores de la publicación: los primeros por orden de firma y, cuando hay
  // muchos, también el último. El total va al final.
  // Los firmantes que son investigadores UTM enlazan a su perfil. La firma de Scopus ("Apellido I.")
  // se empareja con el nombre del autor UTM por apellido e inicial, solo entre los autores UTM de esa publicación.
  const limpiaClave = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const CLAVE_UTM = new Map()
  function claveUtm(id) {
    if (CLAVE_UTM.has(id)) return CLAVE_UTM.get(id)
    const a = porId.get(String(id))
    let k = null
    if (a && a.n) { const [ap, nom] = a.n.split(','); k = limpiaClave(ap) + '|' + limpiaClave((nom || '').trim()[0]) }
    CLAVE_UTM.set(id, k)
    return k
  }
  function claveFirma(nombre) {
    const t = String(nombre || '').trim().split(/\s+/)
    const ult = t[t.length - 1]
    if (t.length > 1 && /^([A-ZÁÉÍÓÚÑ]\.?-?)+$/.test(ult)) return limpiaClave(t.slice(0, -1).join(' ')) + '|' + limpiaClave(ult[0])
    return limpiaClave(nombre) + '|'
  }
  function autoresLinea(p) {
    const prim = p.au || []
    if (!prim.length) return ''
    const total = p.nc || prim.length
    // Se asigna cada autor UTM de la publicación a una sola firma. Primero la regla exacta
    // (apellido e inicial del primer nombre); luego, para los que quedaron sin enlace, se acepta
    // cualquier inicial de sus nombres ("Zambrano M." para "Zambrano, Dannyll Michellc") o un
    // apellido compuesto incompleto, solo si hay un único candidato sin ambigüedad.
    const nombres = [...prim, ...(p.uf ? [p.uf] : [])]
    const asig = new Map()
    const usados = new Set()
    const ids = (p.u || []).map(String).filter(id => porId.has(id))
    const utm = new Map()
    ids.forEach(id => { const k = claveUtm(id); if (k && !utm.has(k)) utm.set(k, id) })
    const parcial = new Map()
    ids.forEach(id => {
      const [ap, nom] = porId.get(id).n.split(',')
      const ini = limpiaClave((nom || '').trim()[0])
      String(ap).split(/[\s\-‑]+/).map(limpiaClave).filter(t => t.length > 2).forEach(t => {
        const k = t + '|' + ini
        parcial.set(k, parcial.has(k) && parcial.get(k) !== id ? null : id)
      })
    })
    nombres.forEach((n, i) => {
      const kf = claveFirma(n)
      const id = utm.get(kf) || parcial.get(kf)
      if (id && !usados.has(id) && !asig.has(i)) { asig.set(i, id); usados.add(id) }
    })
    const partes = n => {
      const t = String(n || '').trim().split(/\s+/)
      const ult = t[t.length - 1]
      const ini = t.length > 1 && /^([A-ZÁÉÍÓÚÑ]\.?-?)+$/.test(ult)
      const ap = (ini ? t.slice(0, -1) : t).join(' ').split(/[\s\-‑]+/).map(limpiaClave).filter(x => x.length > 2)
      return { ap, ini: ini ? [...new Set(limpiaClave(ult).split(''))] : [] }
    }
    const mismoAp = (x, y) => x.some(a => y.some(b => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)))))
    const pend = ids.filter(id => !usados.has(id))
    if (pend.length) {
      const libres = nombres.map((n, i) => i).filter(i => !asig.has(i))
      const info = pend.map(id => {
        const [ap, nom] = porId.get(id).n.split(',')
        return { id, ap: String(ap).split(/[\s\-‑]+/).map(limpiaClave).filter(x => x.length > 2),
          ini: String(nom || '').trim().split(/\s+/).map(w => limpiaClave(w[0])).filter(Boolean) }
      })
      for (const nivel of [1, 2]) {
        info.forEach(u => {
          if (usados.has(u.id)) return
          const cand = libres.filter(i => !asig.has(i)).filter(i => {
            const f = partes(nombres[i])
            return mismoAp(f.ap, u.ap) && (nivel === 2 || f.ini.some(x => u.ini.includes(x)))
          })
          const otros = info.filter(o => o !== u && !usados.has(o.id))
          if (cand.length === 1 && !otros.some(o => mismoAp(partes(nombres[cand[0]]).ap, o.ap))) {
            asig.set(cand[0], u.id); usados.add(u.id)
          }
        })
      }
    }
    const firma = (nombre, i) => {
      const id = asig.get(i)
      return id ? `<a href="#/autor/${encodeURIComponent(id)}" title="Ver el perfil de este investigador UTM">${esc(nombre)}</a>` : esc(nombre)
    }
    const lista = prim.map((n, i) => firma(n, i)).join('; ')
    let txt
    if (p.uf && total > prim.length) {
      const ocultos = total - prim.length - 1
      txt = lista + (ocultos > 0 ? ` … +${ocultos} … ` : '; ') + firma(p.uf, prim.length) + ` · ${total} autores`
    } else {
      txt = lista + (total > prim.length ? ` … (+${total - prim.length} más)` : '')
    }
    return `<div class="m aut-pub">${txt}</div>`
  }
  function citasMetaHTML(p, cpaRef) {
    const tasa = citasPorAnio(p)
    const anios = p.y && p.y <= ANIO_ACTUAL ? (ANIO_ACTUAL - p.y + 1) : 0
    const rit = (p.c > 0 && (anios >= 2 || p.c >= 3) && tasa > 0)
      ? ` <span class="cpa-tag" title="Promedio de citas por año desde su publicación (${anios} año${anios === 1 ? '' : 's'})">(${dec(tasa, 1)}/año)</span>`
      : ''
    const asc = esEnAscenso(p, cpaRef)
      ? ` <span class="en-ascenso" title="Acumula citas más rápido que el promedio (${dec(tasa, 1)} citas/año)">↗ En ascenso</span>`
      : ''
    return `${num(p.c)} citas${rit}${asc}`
  }
  function btnCitarHTML(idx) {
    if (idx == null) return ''
    return ` · <span class="exp-drop cite-drop"><button type="button" class="btn-citar" data-cite="${idx}" aria-haspopup="menu" aria-expanded="false" title="Seleccionar formato para citar o descargar">❞ Citar ▾</button></span>`
  }

  function pubRow(p, dest, cpaRef) {
    const abierto = p.oa && p.oa !== 'Closed' && p.oa !== 'Unknown'
    const t = p.doi
      ? `<a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noreferrer">${esc(p.t)}</a>`
      : esc(p.t)
    const btnCit = btnCitarHTML(PUB_IDX.get(p))
    return `<div class="pub"><div class="anio"><b>${p.y || 'N/D'}</b></div>
      <div class="cuerpo"><div class="t">${t}${dest ? ' <span class="mas-citada">★ Más citada</span>' : ''}</div>
      <div class="m">${adelM(p)}${esc(p.j || 'N/D')} · ${badgeQ(p.q)} · ${citasMetaHTML(p, cpaRef)}${abierto ? ' · <span class="oa-tag">Acceso abierto</span>' : ''}${p.r ? ' · <span class="retirada" title="La revista o fuente fue retirada de Scopus (discontinued source).">⚑ Revista retirada de Scopus</span>' : ''}${btnCit}</div>${autoresLinea(p)}</div></div>`
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
      panes.push(`<div class="ce-pane" data-ce="pais">${window.MAPA_MUNDO ? '<div data-lazy-graf="mapa-pais"><div class="graf-skeleton">Cargando mapa…</div></div>' : ''}<div class="ce-chips"${window.MAPA_MUNDO ? ' style="margin-top:12px"' : ''}>${px.map(paisChip).join('')}</div></div>`)
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
    // En móvil, las listas largas muestran 6 filas y un botón para ver el resto.
    if (window.matchMedia && window.matchMedia('(max-width: 680px)').matches) {
      panes.forEach(p => {
        const filas = [...p.querySelectorAll('.tev-fila')]
        if (filas.length <= 7) return
        filas.slice(6).forEach(f => f.classList.add('tf-oculta'))
        const b = document.createElement('button')
        b.type = 'button'; b.className = 'nov-mas'; b.textContent = `Ver las ${filas.length} filas`
        b.addEventListener('click', () => {
          const abre = !p.classList.toggle('tf-abierta')
          b.textContent = abre ? `Ver las ${filas.length} filas` : 'Ver menos'
        })
        filas[filas.length - 1].parentNode.appendChild(b)
      })
    }
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
    const ancha = ((document.documentElement && document.documentElement.clientWidth) || 1200) >= 700
    if (ancha && H != null) H = 170
    else if (H != null) H = Math.round(H * 1.12)
    if (H == null) H = ancha ? 142 : (n <= 2 ? 110 : n <= 4 ? 132 : 164)
    const W = ancha ? Math.max(520, n * (n >= 10 ? 76 : 52)) : Math.max(n >= 10 ? 400 : 440, n * (n >= 10 ? 30 : 44)), base = H - 24, top = 14
    const paso = W / n, bw = ancha ? Math.min(n >= 10 ? 22 : 16, paso - 16) : Math.min(30, paso - 12)
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
    const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Publicaciones por año">${s}</svg>`
    return conTabla(svg, 'Publicaciones por año',
      [{ t: 'Año' }, { t: 'Publicaciones', num: true }, { t: 'Estado' }],
      years.map(y => [y, num(porAnio[y]), y >= ANIO_ACTUAL ? 'En curso / parcial' : 'Cerrado']))
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
    const html = `<div class="donut-fila"><svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="Distribución por cuartil SJR">${segs}
      <text x="64" y="61" text-anchor="middle" font-size="21" font-weight="700" fill="#185a10" font-family="Montserrat,sans-serif">${total}</text>
      <text x="64" y="78" text-anchor="middle" font-size="10" fill="#8f9985">${total === 1 ? 'Doc.' : 'Docs.'}</text></svg>
      <div class="leyenda">${leg}</div></div>`
    return conTabla(html, 'Distribución por cuartil SJR',
      [{ t: 'Cuartil' }, { t: 'Publicaciones', num: true }, { t: '%', num: true }],
      pres.map(q => [q, num(cq[q]), pctDe(cq[q]) + '%']))
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
    const btnCit = btnCitarHTML(PUB_IDX.get(p))
    return `<div class="pub"><div class="anio"><b>${p.y || 'N/D'}</b></div><div class="cuerpo"><div class="t">${t}</div>
      <div class="m">${adelM(p)}${esc(p.j || 'N/D')} · ${badgeQ(p.q)} · ${citasMetaHTML(p, 0)}${abierto ? ' · <span class="oa-tag">Acceso abierto</span>' : ''}${p.r ? ' · <span class="retirada" title="La revista o fuente fue retirada de Scopus (discontinued source).">⚑ Revista retirada de Scopus</span>' : ''}${aut}${btnCit}</div></div></div>`
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
      ${migas(area)}
      <div class="perfil-hero" style="border-left-color:var(--g3)">
        <div style="flex:1"><h1>${esc(area)}</h1>
          <div class="sub">Área temática de Scopus · ${num(lista.length)} publicaciones UTM · ${num(autArea.length)} investigadores UTM</div></div></div>
      ${autArea.length ? `<div class="panel" style="margin-bottom:18px">
        <h2>Investigadores UTM en esta área (${num(autArea.length)})</h2>
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

  // ---------- metodología ----------
  // ---------- sección Publicaciones: listado global con búsqueda y filtros ----------
  const estadoPub = { q: '', anio: '', cuartil: '', oa: false, orden: 'recientes', pagina: 1 }
  const PUB_POR_PAGINA = 20
  const esAbierta = p => !!(p.oa && p.oa !== 'Closed' && p.oa !== 'Unknown')
  function filtrarPubs() {
    // Se acepta un DOI pegado como enlace (https://doi.org/10...).
    const txt = estadoPub.q.replace(/https?:\/\/(dx\.)?doi\.org\//ig, '')
    const tokens = norm(txt).split(/\s+/).filter(Boolean)
    const out = []
    D.pubs.forEach((p, i) => {
      if (estadoPub.anio && String(p.y) !== estadoPub.anio) return
      if (estadoPub.cuartil && (p.q || 'N/A') !== estadoPub.cuartil) return
      if (estadoPub.oa && !esAbierta(p)) return
      if (tokens.length && !tokens.every(t => PUB_BUSQ[i].includes(t))) return
      out.push(p)
    })
    out.sort(estadoPub.orden === 'citadas'
      ? (a, b) => (b.c || 0) - (a.c || 0) || (b.y || 0) - (a.y || 0)
      : (a, b) => (b.y || 0) - (a.y || 0) || String(b.d || '').localeCompare(String(a.d || '')) || (b.c || 0) - (a.c || 0))
    return out
  }
  function renderPublicaciones() {
    perfilPubs = null
    aplicarFiltroCtxPubs = null
    // Si el enlace trae filtros, mandan sobre lo último que se vio.
    const pr = paramsHash()
    if (['q', 'y', 'cu', 'oa', 'ord', 'pag'].some(k => pr.has(k))) {
      estadoPub.q = pr.get('q') || ''
      estadoPub.anio = /^\d{4}$/.test(pr.get('y') || '') ? pr.get('y') : ''
      estadoPub.cuartil = ['Q1', 'Q2', 'Q3', 'Q4', 'N/A'].includes(pr.get('cu')) ? pr.get('cu') : ''
      estadoPub.oa = pr.get('oa') === '1'
      estadoPub.orden = pr.get('ord') === 'citadas' ? 'citadas' : 'recientes'
      estadoPub.pagina = Math.max(1, parseInt(pr.get('pag'), 10) || 1)
    }
    const anios = [...new Set(D.pubs.map(p => p.y).filter(Boolean))].sort((a, b) => b - a)
    app.innerHTML = `<div class="wrap">
      ${migas('Publicaciones')}
      <div class="perfil-hero" style="border-left-color:var(--g3)">
        <div style="flex:1"><h1>Publicaciones</h1>
          <div class="sub">Todas las publicaciones UTM indexadas en Scopus. Busque por título, DOI, revista o autor.</div></div></div>
      <div class="controles">
        <div class="buscador">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="qPub" type="search" aria-label="Buscar publicaciones" placeholder="Título, DOI, revista o autor…" autocomplete="off" />
        </div>
        <button type="button" class="btn-filtros" id="btnFiltrosPub" aria-expanded="false" aria-controls="hojaFiltrosPub">${ico('filtro')}<span>Filtros</span><b class="btn-filtros-n" hidden></b></button>
        <div class="hoja-vel" id="hojaVelPub"></div>
        <div class="hoja-filtros" id="hojaFiltrosPub" role="dialog" aria-label="Filtros de publicaciones">
          <div class="hoja-cab"><span>Filtros de publicaciones</span><button type="button" class="hoja-x" data-cerrar-hoja aria-label="Cerrar filtros">×</button></div>
          <select class="selector" id="anioPub" aria-label="Filtrar por año">
            <option value="">Año: Todos</option>${anios.map(y => `<option value="${y}">${y}</option>`).join('')}
          </select>
          <select class="selector" id="cuartilPub" aria-label="Filtrar por cuartil de la revista">
            <option value="">Cuartil: Todos</option>
            ${['Q1', 'Q2', 'Q3', 'Q4', 'N/A'].map(q => `<option value="${q}">${q === 'N/A' ? 'Sin cuartil' : q}</option>`).join('')}
          </select>
          <select class="selector" id="ordenPub" aria-label="Ordenar publicaciones">
            <option value="recientes">Ordenar: Más recientes</option>
            <option value="citadas">Ordenar: Más citadas</option>
          </select>
          <button type="button" class="btn-filtro-vig" id="btnOaPub" aria-pressed="false" title="Mostrar solo publicaciones de acceso abierto"><span>Solo acceso abierto</span></button>
          <div class="hoja-pie"><button type="button" class="hoja-aplicar" data-cerrar-hoja></button></div>
        </div>
        <div class="conteo" id="conteoPub"></div>
      </div>
      <div class="paginacion" id="pagPubTop"></div>
      <div class="panel" id="listaPubBox"><div id="listaPub"></div></div>
      <div class="paginacion" id="pagPub"></div>
    </div>
    ${TOP_PAGE_HTML}`
    const qI = document.getElementById('qPub'), anioS = document.getElementById('anioPub'), cuS = document.getElementById('cuartilPub')
    const ordS = document.getElementById('ordenPub'), oaB = document.getElementById('btnOaPub')
    qI.value = estadoPub.q; anioS.value = estadoPub.anio; cuS.value = estadoPub.cuartil; ordS.value = estadoPub.orden
    const marcaOa = () => { oaB.classList.toggle('on', estadoPub.oa); oaB.setAttribute('aria-pressed', estadoPub.oa ? 'true' : 'false') }
    marcaOa()
    const pintarPubs = (bajar) => {
      const arr = filtrarPubs()
      const paginas = Math.max(1, Math.ceil(arr.length / PUB_POR_PAGINA))
      if (estadoPub.pagina > paginas) estadoPub.pagina = paginas
      const ini = (estadoPub.pagina - 1) * PUB_POR_PAGINA
      document.getElementById('conteoPub').textContent = num(arr.length) + (arr.length === 1 ? ' publicación' : ' publicaciones')
      document.getElementById('listaPub').innerHTML = arr.length
        ? arr.slice(ini, ini + PUB_POR_PAGINA).map(p => pubRow(p)).join('')
        : '<div class="vacio">Sin coincidencias. Pruebe con menos palabras o quite algún filtro.</div>'
      const htmlPag = (paginas > 1 ? `<div class="pag-actual">Página ${estadoPub.pagina} de ${paginas}</div>` : '') + paginacionHTML(estadoPub.pagina, paginas)
      for (const id of ['pagPubTop', 'pagPub']) {
        const ref = document.getElementById(id)
        ref.innerHTML = htmlPag
        ref.querySelectorAll('button[data-p]').forEach(b => b.addEventListener('click', () => {
          estadoPub.pagina = +b.dataset.p; pintarPubs(true)
        }))
      }
      const np = new URLSearchParams()
      if (estadoPub.q) np.set('q', estadoPub.q)
      if (estadoPub.anio) np.set('y', estadoPub.anio)
      if (estadoPub.cuartil) np.set('cu', estadoPub.cuartil)
      if (estadoPub.oa) np.set('oa', '1')
      if (estadoPub.orden !== 'recientes') np.set('ord', estadoPub.orden)
      if (estadoPub.pagina > 1) np.set('pag', String(estadoPub.pagina))
      fijarParams(np)
      if (bajar) document.getElementById('listaPubBox').scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const cambio = fn => () => { fn(); estadoPub.pagina = 1; pintarPubs(false) }
    qI.addEventListener('input', cambio(() => { estadoPub.q = qI.value }))
    anioS.addEventListener('change', cambio(() => { estadoPub.anio = anioS.value }))
    cuS.addEventListener('change', cambio(() => { estadoPub.cuartil = cuS.value }))
    ordS.addEventListener('change', cambio(() => { estadoPub.orden = ordS.value }))
    oaB.addEventListener('click', cambio(() => { estadoPub.oa = !estadoPub.oa; marcaOa() }))
    pintarPubs(false)
    hojaFiltros({ btn: 'btnFiltrosPub', hoja: 'hojaFiltrosPub', vel: 'hojaVelPub' }, {
      contar: () => filtrarPubs().length, unidad: ['publicación', 'publicaciones'],
      activos: () => (estadoPub.anio ? 1 : 0) + (estadoPub.cuartil ? 1 : 0) + (estadoPub.oa ? 1 : 0) + (estadoPub.orden !== 'recientes' ? 1 : 0),
    })
  }

  function svgHistorico(hist, campo, color, tit) {
    if (!hist || hist.length < 2) return ''
    const W = 540, H = 165, padL = 44, padR = 14, padT = 18, padB = 26
    const vals = hist.map(x => Number(x[campo]) || 0)
    const minV = Math.min(...vals), maxV = Math.max(...vals)
    const span = Math.max(1, maxV - minV)
    const lo = Math.max(0, minV - span * 0.15), hi = maxV + span * 0.15
    const xFor = i => padL + (i / (hist.length - 1)) * (W - padL - padR)
    const yFor = v => H - padB - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - padT - padB)
    const pts = hist.map((x, i) => `${xFor(i).toFixed(1)},${yFor(vals[i]).toFixed(1)}`).join(' ')
    const area = `${xFor(0).toFixed(1)},${H - padB} ${pts} ${xFor(hist.length - 1).toFixed(1)},${H - padB}`
    let dots = '', lbls = ''
    const step = Math.max(1, Math.ceil(hist.length / 6))
    hist.forEach((x, i) => {
      const px = xFor(i), py = yFor(vals[i])
      dots += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="${color}" stroke="#fff" stroke-width="1.2"><title>${esc(x.f)}: ${num(vals[i])}</title></circle>`
      if (i % step === 0 || i === hist.length - 1) {
        lbls += `<text x="${px.toFixed(1)}" y="${H - 8}" font-size="9.5" text-anchor="middle" fill="#8b9482">${esc(x.f.slice(2, 7))}</text>`
      }
      if (i === 0 || i === hist.length - 1) {
        lbls += `<text x="${px.toFixed(1)}" y="${(py - 7).toFixed(1)}" font-size="10" font-weight="700" text-anchor="${i === 0 ? 'start' : 'end'}" fill="${color}" stroke="#fff" stroke-width="2.4" paint-order="stroke">${num(vals[i])}</text>`
      }
    })
    const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H + 10}px" role="img" aria-label="${esc(tit)}">
      <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#e6e9e1"/>
      <polygon points="${area}" fill="${color}" fill-opacity="0.12"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2"/>
      ${dots}${lbls}</svg>`
    return conTabla(svg, tit,
      [{ t: 'Fecha' }, { t: tit, num: true }],
      hist.map(x => [x.f, num(x[campo] || 0)]))
  }

  function renderMetodologia() {
    perfilPubs = null
    aplicarFiltroCtxPubs = null
    limpiarGrafObs()
    const fecha = (() => {
      if (!D.fecha) return 'la fecha de la última actualización'
      const [dia, hora] = String(D.fecha).trim().split(/\s+/)
      const [y, m, d] = dia.split('-').map(Number)
      const f = new Date(y, m - 1, d).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })
      return hora ? `${f}, ${hora} (GMT-5)` : f
    })()
    const sinAfil = D.autores.filter(a => a.xu).length
    const nPub = D.pubs.length || 1, nAut = D.autores.length || 1
    const sinDoi = D.pubs.filter(p => !p.doi).length
    const sinCuartil = D.pubs.filter(p => p.q === 'NC').length
    const retiradas = D.pubs.filter(p => p.r).length
    const sinOrcid = D.autores.filter(a => !a.or).length
    const fusionados = D.autores.filter(a => (a.fx || []).length > 0).length
    const calCard = (pct, val, tit, det, warn) => `<div class="cal-card">
      <b>${dec(pct, 1)}%</b>
      <div class="cal-tit">${esc(tit)}</div>
      <div class="cal-det">${esc(val)} · ${esc(det)}</div>
      <div class="cal-bar${warn ? ' warn' : ''}"><i style="width:${Math.min(100, Math.max(2, Math.round(pct)))}%"></i></div>
    </div>`
    const hist = Array.isArray(D.hist) ? D.hist : []
    const histHtml = hist.length >= 2
      ? `<div class="panel" style="margin-top:16px"><h2>Histórico de crecimiento institucional</h2>
          <p class="ayuda-filtros" style="margin:0 0 12px">Registro acumulado en cada actualización del portal (${hist.length} cortes desde ${esc(hist[0].f)} hasta ${esc(hist[hist.length - 1].f)}).</p>
          <div class="top-tabs hist-tabs">
            <button type="button" class="top-tab hist-tab on" data-hm="p">${ico('pubs')}<span>Publicaciones</span></button>
            <button type="button" class="top-tab hist-tab" data-hm="c">${ico('citas')}<span>Citas</span></button>
            <button type="button" class="top-tab hist-tab" data-hm="h">${ico('h')}<span>Índice h</span></button>
          </div>
          <div id="histCont">${svgHistorico(hist, 'p', '#1e6b14', 'Publicaciones UTM acumuladas')}</div>
        </div>`
      : `<div class="panel" style="margin-top:16px"><h2>Histórico de crecimiento institucional</h2>
          <p class="ayuda-filtros" style="margin:0">El histórico comenzará a graficarse a partir de la segunda actualización registrada.</p>
        </div>`
    const mayus = x => x.charAt(0).toUpperCase() + x.slice(1)
    const item = (t, cuerpo) => `<div class="met-item"><h3>${t}</h3><p>${mayus(cuerpo)}</p></div>`
    app.innerHTML = `<div class="wrap">
      ${migas('Metodología')}
      <div class="perfil-hero" style="border-left-color:var(--g3)">
        <div style="flex:1"><h1>Metodología</h1>
          <div class="sub">Cómo se obtienen y se calculan las cifras de este portal</div></div></div>
      <div class="grid2">
        <div class="panel"><h2>Fuente y fecha de corte</h2>
          ${item('¿De dónde salen los datos?', 'Todo proviene de Scopus. El portal no usa otras bases de datos ni cifras ingresadas a mano.')}
          ${item('Fecha de corte', `Los datos de esta versión corresponden al ${esc(fecha)}. Lo que se publique o se cite después aparece en la siguiente actualización.`)}
          ${item('Año en curso', 'Las cifras del año en curso son parciales. Por eso no entran en los promedios ni en la tendencia de las gráficas, y sus barras se dibujan con trazo punteado.')}
          ${item('Novedades', 'La portada compara la última actualización con la anterior: muestra autores con publicaciones o citas nuevas y autores que aparecen por primera vez.')}
        </div>
        <div class="panel"><h2>¿Quién aparece y qué se cuenta?</h2>
          ${item('Autores UTM', 'Son los investigadores con publicaciones indexadas en Scopus con filiación a la Universidad Técnica de Manabí.')}
          ${item('Afiliación vigente', `Scopus asigna a cada autor una afiliación actual. Si ya no es la UTM, el portal conserva su producción con filiación UTM y lo marca como «Sin afiliación vigente». Hoy son ${num(sinAfil)} autores.`)}
          ${item('Publicaciones', 'Documentos indexados en Scopus. Se excluyen erratas, cartas, notas y editoriales.')}
          ${item('Citas', 'Las que Scopus registra a la fecha de corte. Scopus no entrega el historial año a año, así que el índice h de cada año se calcula con las citas actuales de las publicaciones hasta ese año.')}
        </div>
      </div>
      <div class="grid2">
        <div class="panel"><h2>Indicadores</h2>
          ${item('Índice h', AY.h.replace(/^Índice h: /, ''))}
          ${item('Índice g', AY.g.replace(/^Índice g: /, ''))}
          ${item('Índice i10', AY.i10.replace(/^Índice i10: /, ''))}
          ${item('Índice m', AY.m.replace(/^Índice m: /, ''))}
          ${item('Citas por publicación (C/P)', `Total de citas dividido entre el total de publicaciones. Para entrar en el puesto y en el Top 10 se exigen al menos ${MIN_PUBS_CP} publicaciones, así un solo trabajo muy citado no distorsiona la clasificación.`)}
          ${item('Acceso abierto', 'Porcentaje de publicaciones disponibles sin suscripción, según el estado Open Access de Scopus.')}
        </div>
        <div class="panel"><h2>Puesto y cuartiles</h2>
          ${item('Puesto en la UTM', 'Se ordena a todos los autores del portal, de mayor a menor, en cada indicador. Si hay empate, decide el total de citas y luego el de publicaciones. En acceso abierto el puesto solo se muestra entre los 100 primeros.')}
          ${item('Cuartil SJR', 'Es el mejor cuartil de la revista según SCImago (SJR) en el año de la publicación. Si ese año no está disponible, se toma el de los años más cercanos, y como respaldo se usa el cuartil de CiteScore de Scopus.')}
          ${item('N/A y NC', 'N/A corresponde a documentos a los que no se aplica un cuartil, como las ponencias en conferencias. NC significa que no se encontró cuartil para esa revista en ese año.')}
          ${item('Colores', 'Q1 verde oscuro, Q2 verde claro, Q3 naranja, Q4 rojo, N/A gris y NC gris claro, igual en todas las gráficas y ventanas del portal.')}
        </div>
      </div>
      <div class="panel" style="margin-top:16px"><h2>Calidad y cobertura de los datos</h2>
        <p class="ayuda-filtros" style="margin:0 0 10px">Porcentajes de registros incompletos o depurados sobre ${num(D.pubs.length)} publicaciones y ${num(D.autores.length)} investigadores.</p>
        <div class="cal-grid">
          ${calCard(100 * sinDoi / nPub, `${num(sinDoi)} de ${num(D.pubs.length)}`, 'Publicaciones sin DOI', 'Sin enlace directo al documento', sinDoi > 0)}
          ${calCard(100 * sinCuartil / nPub, `${num(sinCuartil)} de ${num(D.pubs.length)}`, 'Revistas sin cuartil (NC)', 'Sin registro SJR ni CiteScore', sinCuartil > 0)}
          ${calCard(100 * retiradas / nPub, `${num(retiradas)} de ${num(D.pubs.length)}`, 'En revistas retiradas de Scopus', 'Fuentes descontinuadas', retiradas > 0)}
          ${calCard(100 * sinOrcid / nAut, `${num(sinOrcid)} de ${num(D.autores.length)}`, 'Autores sin ORCID vinculado', 'Pendiente de enlace en Scopus', sinOrcid > 0)}
          ${calCard(100 * fusionados / nAut, `${num(fusionados)} de ${num(D.autores.length)}`, 'Perfiles unificados', 'Autores con IDs de Scopus fusionados', false)}
        </div>
      </div>
      ${histHtml}
    </div>
    ${TOP_PAGE_HTML}`
    if (hist.length >= 2) {
      const cfg = { p: ['#1e6b14', 'Publicaciones UTM acumuladas'], c: ['#2e8a1f', 'Citas UTM acumuladas'], h: ['#e0902d', 'Índice h institucional'] }
      const cont = document.getElementById('histCont')
      document.querySelectorAll('.hist-tab').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.hm
        document.querySelectorAll('.hist-tab').forEach(x => x.classList.toggle('on', x === b))
        if (cont && cfg[k]) cont.innerHTML = svgHistorico(hist, k, cfg[k][0], cfg[k][1])
      }))
    }
  }

  // ---------- router ----------
  const TITULO = 'Investigadores UTM · Producción científica Scopus'
  // Al volver al directorio desde un perfil, un área, Metodología o Publicaciones se recupera la posición
  // donde estaba la persona (los filtros y la página ya se conservan en "estado").
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual' } catch (e) { /* sin historial */ }
  let enLista = true, scrollLista = 0
  const esRutaLista = h => !(h.indexOf('#/autor/') === 0 || h.indexOf('#/area/') === 0 || h === '#/metodologia' || h === '#/publicaciones')
  function router() {
    const h = hashPartes()[0]
    document.body.classList.remove('hoja-abierta')   // por si se navegó con la hoja de filtros abierta
    const lista = esRutaLista(h)
    if (enLista && !lista) scrollLista = window.scrollY
    const volver = lista && !enLista && scrollLista > 0
    enLista = lista
    if (h.indexOf('#/autor/') === 0) {
      const id = decodeURIComponent(h.slice(8))
      renderPerfil(id)
      if (window.registrarEvento) window.registrarEvento('perfil', id)
      const a = porId.get(id)
      document.title = a ? `${a.n} · ${TITULO}` : TITULO
    } else if (h === '#/publicaciones') {
      renderPublicaciones()
      document.title = `Publicaciones · ${TITULO}`
    } else if (h === '#/metodologia') {
      renderMetodologia()
      if (window.registrarEvento) window.registrarEvento('metodologia', '')
      document.title = `Metodología · ${TITULO}`
    } else if (h.indexOf('#/area/') === 0) {
      const ar = decodeURIComponent(h.slice(7))
      renderArea(ar)
      document.title = `${ar} · ${TITULO}`
    } else {
      renderLista()
      document.title = TITULO
    }
    if (volver) {
      const y = scrollLista
      window.scrollTo(0, y)
      requestAnimationFrame(() => window.scrollTo(0, y))
      setTimeout(() => { if (window.scrollY < 5) window.scrollTo(0, y) }, 250)
    } else window.scrollTo(0, 0)
  }
  // popover contextual delegado: funciona para elementos dinámicos (paginados)
  app.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return
    const el = ev.target && ev.target.closest ? ev.target.closest('[data-cat]') : null
    if (!el || /^(a|button|input|select)$/i.test(el.tagName)) return
    ev.preventDefault()
    const r = el.getBoundingClientRect()
    el.dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX: Math.round(r.left + r.width / 2), clientY: Math.round(r.bottom),
    }))
  })
  app.addEventListener('click', ev => {
    const btnTbl = ev.target.closest('.btn-graf-tbl')
    if (btnTbl) {
      const wrap = btnTbl.closest('.graf-wrap')
      if (wrap) {
        const vis = wrap.querySelector('.graf-vis'), tbl = wrap.querySelector('.graf-tbl')
        const verTabla = tbl.hidden
        tbl.hidden = !verTabla
        vis.hidden = verTabla
        btnTbl.setAttribute('aria-expanded', verTabla ? 'true' : 'false')
        const sp = btnTbl.querySelector('span')
        if (sp) sp.textContent = verTabla ? 'Ver gráfico' : 'Ver como tabla'
      }
      return
    }
    if (ev.target.closest('.top-page')) {
      window.scrollTo({ top: 0, behavior: 'smooth' }); return
    }
    const btnCit = ev.target.closest('.btn-citar[data-cite]')
    if (btnCit) {
      ev.stopPropagation()
      const p = D.pubs[+btnCit.dataset.cite]
      if (p) toggleMenuCita(btnCit, p)
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

  // Enlaces marcados con data-nueva: siempre en una pestaña nueva, también dentro de una vista previa incrustada.
  document.addEventListener('click', ev => {
    const a = ev.target.closest && ev.target.closest('a[data-nueva]')
    if (!a) return
    ev.preventDefault()
    if (/novedades\.xml/.test(a.href)) if (window.registrarEvento) window.registrarEvento('rss', '')
    window.open(a.href, '_blank', 'noopener,noreferrer')
  })
  // Botón flotante "Ir a arriba": aparece al bajar y desaparece arriba.
  const btnArriba = document.createElement('button')
  btnArriba.type = 'button'
  btnArriba.className = 'ir-arriba'
  btnArriba.setAttribute('aria-label', 'Ir al inicio de la página')
  btnArriba.tabIndex = -1
  btnArriba.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg><span>Ir a arriba</span>'
  document.body.appendChild(btnArriba)
  const sinMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  btnArriba.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: sinMovimiento ? 'auto' : 'smooth' }); btnArriba.blur() })
  let tickArriba = false
  const vigilaArriba = () => {
    if (tickArriba) return
    tickArriba = true
    requestAnimationFrame(() => {
      tickArriba = false
      const ver = window.scrollY > 500
      btnArriba.classList.toggle('ver', ver)
      btnArriba.tabIndex = ver ? 0 : -1
    })
  }
  function cerrarMenusExport() {
    cerrarMenuCita()
    const m = document.getElementById('expMenu')
    const b = document.getElementById('btnExpMenu')
    if (m && !m.hidden) { m.hidden = true; if (b) b.setAttribute('aria-expanded', 'false') }
  }
  document.addEventListener('click', ev => { if (!ev.target.closest('.exp-drop')) cerrarMenusExport() })
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return
    const m = document.getElementById('expMenu')
    const b = document.getElementById('btnExpMenu')
    const estabaExp = m && !m.hidden
    cerrarMenusExport()
    if (estabaExp && b) b.focus()
  })
  window.addEventListener('scroll', vigilaArriba, { passive: true })
  window.addEventListener('hashchange', () => { cerrarPop(); cerrarGlobo(); cerrarMenusExport(); router() })
  router()
})()
