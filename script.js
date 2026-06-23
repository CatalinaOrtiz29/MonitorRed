function $(id) {
    const el = document.getElementById(id);
    if (!el) console.warn('Elemento no encontrado:', id);
    return el;
}

const NOMBRES = {
    "webpad-neb-homil.mitrol.cloud": "Mitrol",
    "dghweb.homil.gov.co": "DGHWEB",
    "10.200.192.1": "Puerta de Enlace"
};

const UMBRALES = {
    latenciaVerde: 30,
    latenciaAmarilla: 100,
};

let charts = {};

function getNivel(promedio, perdida, estado) {
    if (estado === 'CAIDO') return 'red';
    if (perdida > 5) return 'red';
    if (promedio > 100) return 'red';
    if (perdida > 1) return 'yellow';
    if (promedio > 30) return 'yellow';
    return 'green';
}

function getColor(nivel) {
    const map = { green: '#2ea043', yellow: '#d29922', red: '#da3633' };
    return map[nivel] || '#8b949e';
}

function actualizarSaludGeneral(sitios) {
    const el = $('salud-general');
    if (!el) return;
    let nivel = 'green';
    for (const s of sitios) {
        const n = getNivel(s.promedio, s.perdida ?? 0, s.estado);
        if (n === 'red') { nivel = 'red'; break; }
        if (n === 'yellow') nivel = 'yellow';
    }
    el.className = 'salud-dot ' + nivel;
}

function calcularDisponibilidad(historico) {
    const porSitio = {};
    historico.forEach(h => {
        if (!porSitio[h.sitio]) porSitio[h.sitio] = { total: 0, ok: 0 };
        porSitio[h.sitio].total++;
        if (h.estado === 'OK') porSitio[h.sitio].ok++;
    });
    const resultado = {};
    for (const [sitio, datos] of Object.entries(porSitio)) {
        resultado[sitio] = datos.total > 0 ? Math.round((datos.ok / datos.total) * 100) : 100;
    }
    return resultado;
}

function renderizarResumen(sitios, disponibilidad) {
    const el = $('resumen');
    if (!el) return;
    const total = sitios.length;
    const ok = sitios.filter(s => s.estado === 'OK').length;
    const caidos = total - ok;
    const dispTotal = Object.values(disponibilidad).length > 0
        ? Math.round(Object.values(disponibilidad).reduce((a, b) => a + b, 0) / Object.values(disponibilidad).length)
        : 100;
    const caidosClase = caidos > 0 ? 'red' : 'green';
    const dispClase = dispTotal >= 99 ? 'green' : dispTotal >= 95 ? 'yellow' : 'red';
    const latenciaGeneral = sitios.length > 0
        ? Math.round(sitios.reduce((a, s) => a + s.promedio, 0) / sitios.length)
        : 0;
    const picoDelDia = sitios.length > 0
        ? Math.max(...sitios.map(s => s.maximo))
        : 0;

    el.innerHTML = `
        <span class="summary-stat">
            <span class="num">${total}</span>
            <span class="label">sitios</span>
        </span>
        <span class="summary-divider"></span>
        <span class="summary-stat">
            <span class="num green">${ok}</span>
            <span class="label">OK</span>
        </span>
        <span class="summary-divider"></span>
        <span class="summary-stat">
            <span class="num ${caidosClase}">${caidos}</span>
            <span class="label">caídos</span>
        </span>
        <span class="summary-divider"></span>
        <span class="summary-stat">
            <span class="num ${dispClase}">${dispTotal}%</span>
            <span class="label">disponibilidad</span>
        </span>
        <span class="summary-divider"></span>
        <span class="summary-stat">
            <span class="num">${latenciaGeneral}</span>
            <span class="label">ms latencia</span>
        </span>
        <span class="summary-divider"></span>
        <span class="summary-stat">
            <span class="num">${picoDelDia}</span>
            <span class="label">ms pico</span>
        </span>
    `;
}

function crearAnilloDisponibilidad(porcentaje, nivel) {
    const radio = 17;
    const circunferencia = 2 * Math.PI * radio;
    const offset = circunferencia - (porcentaje / 100) * circunferencia;
    const color = getColor(nivel);
    return `
    <div class="avail-ring">
        <svg viewBox="0 0 40 40">
            <circle class="ring-bg" cx="20" cy="20" r="${radio}"/>
            <circle class="ring-fg" cx="20" cy="20" r="${radio}"
                stroke="${color}"
                stroke-dasharray="${circunferencia}"
                stroke-dashoffset="${offset}"/>
        </svg>
        <span class="ring-text" style="color:${color}">${porcentaje}%</span>
    </div>`;
}

function crearTarjetas(sitios, historico, disponibilidad) {
    const container = $('cards');
    if (!container) return;
    container.innerHTML = '';

    sitios.forEach((s, idx) => {
        const nivel = getNivel(s.promedio, s.perdida ?? 0, s.estado);
        const perdida = s.perdida ?? 0;
        const ttl = s.ttl ?? 'N/A';
        const friendly = NOMBRES[s.nombre] || s.nombre;
        const disp = disponibilidad[s.nombre] ?? 100;
        const chartId = 'chart-' + idx;
        const dataHistorico = historico.filter(h => h.sitio === s.nombre);

        const card = document.createElement('div');
        card.className = 'card border-' + nivel;
        card.style.animationDelay = (idx * 0.1) + 's';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title-group">
                    <span class="friendly-name">${friendly}</span>
                    <span class="domain-name">${s.nombre}</span>
                </div>
                <span class="status-badge ${nivel}">${s.estado}</span>
            </div>
            <div class="card-stats">
                <div class="stat">
                    <div class="value ${nivel}">${s.promedio} <span style="font-size:12px;font-weight:400">ms</span></div>
                    <span class="label">Promedio</span>
                </div>
                <div class="stat">
                    <div class="value">${s.minimo ?? s.promedio} <span style="font-size:10px;font-weight:400">/</span> ${s.maximo} <span style="font-size:12px;font-weight:400">ms</span></div>
                    <span class="label">Mín / Máx</span>
                </div>
                <div class="stat">
                    <div class="value ${perdida > 0 ? 'red' : 'green'}">${perdida}<span style="font-size:12px;font-weight:400">%</span></div>
                    <span class="label">Pérdida</span>
                </div>
                <div class="stat">
                    ${crearAnilloDisponibilidad(disp, nivel)}
                    <span class="label">Disponibilidad</span>
                </div>
            </div>
            <div class="card-chart">
                <canvas id="${chartId}"></canvas>
            </div>
            <div class="card-footer">
                <span>🖥 ${s.ip || s.nombre}</span>
                <span>📡 TTL: ${ttl}</span>
                <span>📊 ${dataHistorico.length} mediciones</span>
            </div>
        `;
        container.appendChild(card);

        if (dataHistorico.length > 0) {
            setTimeout(() => {
                const canvas = $(chartId);
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (charts[chartId]) charts[chartId].destroy();

                const promedios = dataHistorico.map(d => d.promedio);
                const maximos = dataHistorico.map(d => d.maximo);
                const minimos = dataHistorico.map(d => d.minimo ?? d.promedio);
                const todosValores = [...promedios, ...maximos, ...minimos];
                const maxEscala = Math.ceil(Math.max(...todosValores, 1));

                charts[chartId] = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: dataHistorico.map(d => d.fecha),
                        datasets: [
                            {
                                data: maximos,
                                borderColor: getColor(nivel) + '50',
                                borderDash: [3, 3],
                                borderWidth: 1,
                                pointRadius: 0,
                                pointHoverRadius: 0,
                                fill: false,
                                tooltip: { hidden: true }
                            },
                            {
                                data: minimos,
                                borderColor: getColor(nivel) + '50',
                                borderDash: [3, 3],
                                borderWidth: 1,
                                pointRadius: 0,
                                pointHoverRadius: 0,
                                backgroundColor: getColor(nivel) + '12',
                                fill: '-1',
                                tooltip: { hidden: true }
                            },
                            {
                                data: promedios,
                                borderColor: getColor(nivel),
                                backgroundColor: getColor(nivel) + '18',
                                fill: false,
                                tension: 0.3,
                                pointRadius: 1.5,
                                pointHoverRadius: 5,
                                pointBackgroundColor: getColor(nivel),
                                borderWidth: 2
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                enabled: true,
                                mode: 'index',
                                intersect: false,
                                callbacks: {
                                    label: function(context) {
                                        const idx = context.dataIndex;
                                        const d = dataHistorico[idx];
                                        if (!d) return '';
                                        if (d.estado === 'CAIDO') return 'CAÍDO';
                                        const partes = [
                                            `Prom: ${d.promedio}ms`,
                                            `Mín: ${d.minimo || d.promedio}ms`,
                                            `Máx: ${d.maximo}ms`
                                        ];
                                        if (d.perdida && d.perdida > 0) {
                                            partes.push(`Pérdida: ${d.perdida}%`);
                                        }
                                        return partes.join('  ·  ');
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                ticks: { color: '#8b949e', maxTicksLimit: 8, font: { size: 9 } },
                                grid: { display: false }
                            },
                            y: {
                                min: 0,
                                max: Math.max(maxEscala * 1.3, 10),
                                ticks: { color: '#8b949e', font: { size: 9 }, callback: v => Math.round(v) + 'ms' },
                                grid: { color: 'rgba(48,54,61,0.3)' }
                            }
                        },
                        interaction: { intersect: false, mode: 'index' }
                    }
                });
            }, 50);
        }
    });
}

function parseFechaEvento(str) {
    const [fecha, hora] = str.split(' ');
    const [d, m] = fecha.split('/');
    const [hh, mm] = hora.split(':');
    return new Date(2026, parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
}

function calcularEventos(historico) {
    const eventos = [];
    const sitiosUnicos = [...new Set(historico.map(h => h.sitio))];

    for (const sitio of sitiosUnicos) {
        const datos = historico
            .filter(h => h.sitio === sitio)
            .sort((a, b) => parseFechaEvento(a.fecha) - parseFechaEvento(b.fecha));

        const friendly = NOMBRES[sitio] || sitio;
        let estadoAnterior = null;
        let enPico = false;
        let enPerdida = false;

        for (const d of datos) {
            if (estadoAnterior !== null && d.estado !== estadoAnterior) {
                eventos.push({
                    tiempo: d.fecha,
                    sitio: friendly,
                    tipo: d.estado === 'CAIDO' ? 'caida' : 'recuperacion',
                    mensaje: d.estado === 'CAIDO' ? 'Caída de servicio' : 'Servicio recuperado'
                });
            }
            estadoAnterior = d.estado;

            if (d.maximo > 100 && !enPico) {
                eventos.push({
                    tiempo: d.fecha, sitio: friendly,
                    tipo: 'pico',
                    mensaje: `Pico de latencia (${d.maximo}ms)`
                });
                enPico = true;
            } else if (d.maximo <= 100) {
                enPico = false;
            }

            const perdida = d.perdida ?? 0;
            if (perdida > 5 && !enPerdida) {
                eventos.push({
                    tiempo: d.fecha, sitio: friendly,
                    tipo: 'perdida',
                    mensaje: `Pérdida de paquetes (${perdida}%)`
                });
                enPerdida = true;
            } else if (perdida <= 5) {
                enPerdida = false;
            }
        }
    }

    eventos.sort((a, b) => parseFechaEvento(b.tiempo) - parseFechaEvento(a.tiempo));
    return eventos.slice(0, 20);
}

function renderizarEventos(eventos) {
    const el = $('eventos');
    if (!el) return;
    if (eventos.length === 0) {
        el.innerHTML = '<div class="events-empty">Sin eventos registrados en las últimas 24h</div>';
        return;
    }

    const ICONOS = {
        caida: '🔴',
        recuperacion: '🟢',
        pico: '🟡',
        perdida: '⚠️'
    };

    el.innerHTML = eventos.map(e => `
        <div class="event-row event-${e.tipo}">
            <span class="event-icon">${ICONOS[e.tipo] || '•'}</span>
            <span class="event-time">${e.tiempo}</span>
            <span class="event-site">${e.sitio}</span>
            <span class="event-msg">${e.mensaje}</span>
        </div>
    `).join('');
}

async function cargarDatos() {
    const loadingEl = $('loading');
    const cardsEl = $('cards');
    if (!cardsEl) {
        console.error('Falta el elemento #cards en el HTML');
        return;
    }
    if (loadingEl) loadingEl.classList.remove('hidden');

    try {
        const [datosRes, historicoRes] = await Promise.all([
            fetch('datos.json?' + Date.now()),
            fetch('historico.json?' + Date.now())
        ]);
        const datos = await datosRes.json();
        const historico = await historicoRes.json();
        const disponibilidad = calcularDisponibilidad(historico);

        actualizarSaludGeneral(datos.sitios);
        renderizarResumen(datos.sitios, disponibilidad);
        crearTarjetas(datos.sitios, historico, disponibilidad);
        const eventos = calcularEventos(historico);
        renderizarEventos(eventos);

        const ultAct = $('ultima-actualizacion');
        if (ultAct) {
            ultAct.textContent =
                new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    } catch (err) {
        console.error('Error al cargar datos:', err);
        cardsEl.innerHTML = `
            <div class="card border-red" style="padding:40px;text-align:center">
                <p style="color:var(--red);font-size:16px;font-weight:600">⚠ Error al cargar datos</p>
                <p style="color:var(--text-muted);margin-top:8px;font-size:13px">${err.message}</p>
                <p style="color:var(--text-muted);margin-top:12px;font-size:12px">Reintentando en 60s...</p>
            </div>`;
    } finally {
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

cargarDatos();
setInterval(cargarDatos, 60000);
