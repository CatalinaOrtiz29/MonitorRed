const UMBRALES = {
    latenciaVerde: 30,
    latenciaAmarilla: 100,
    perdidaAmarilla: 5,
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

function actualizarSaludGeneral(sitios) {
    const el = document.getElementById('salud-general');
    let nivel = 'green';
    for (const s of sitios) {
        const n = getNivel(s.promedio, s.perdida ?? 0, s.estado);
        if (n === 'red') { nivel = 'red'; break; }
        if (n === 'yellow') nivel = 'yellow';
    }
    el.className = 'salud-indicador ' + nivel;
}

function crearTarjetas(sitios) {
    const container = document.getElementById('cards');
    container.innerHTML = '';

    sitios.forEach(s => {
        const nivel = getNivel(s.promedio, s.perdida ?? 0, s.estado);
        const perdida = s.perdida ?? 0;
        const ttl = s.ttl ?? 'N/A';
        const card = document.createElement('div');
        card.className = 'card border-' + nivel;
        card.innerHTML = `
            <div class="card-header">
                <h2>${s.nombre}</h2>
                <span class="status-badge ${nivel}">${s.estado}</span>
            </div>
            <div class="card-stats">
                <div class="stat">
                    <div class="value ${nivel}">${s.promedio} ms</div>
                    <span class="label">Promedio</span>
                </div>
                <div class="stat">
                    <div class="value">${s.maximo} ms</div>
                    <span class="label">Máximo</span>
                </div>
                <div class="stat">
                    <div class="value ${perdida > 0 ? 'red' : 'green'}">${perdida}%</div>
                    <span class="label">Pérdida</span>
                </div>
            </div>
            <div class="card-footer">
                <span>🖥 ${s.ip}</span>
                <span>📡 TTL: ${ttl}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function crearGraficas(sitios, historico) {
    const container = document.getElementById('graficas');
    container.innerHTML = '';

    sitios.forEach(s => {
        const datos = historico.filter(h => h.sitio === s.nombre);
        if (datos.length === 0) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'chart-wrapper';

        const titulo = document.createElement('h3');
        titulo.textContent = 'Latencia - ' + s.nombre;
        wrapper.appendChild(titulo);

        const canvas = document.createElement('canvas');
        canvas.id = 'chart-' + s.nombre.replace(/[^a-zA-Z0-9]/g, '_');
        wrapper.appendChild(canvas);
        container.appendChild(wrapper);

        const ctx = canvas.getContext('2d');
        if (charts[s.nombre]) charts[s.nombre].destroy();

        charts[s.nombre] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: datos.map(d => d.fecha),
                datasets: [{
                    label: 'Promedio (ms)',
                    data: datos.map(d => d.promedio),
                    borderColor: '#58a6ff',
                    backgroundColor: 'rgba(88, 166, 255, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        ticks: { color: '#8b949e', maxTicksLimit: 10 },
                        grid: { color: 'rgba(48, 54, 61, 0.5)' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#8b949e' },
                        grid: { color: 'rgba(48, 54, 61, 0.5)' }
                    }
                }
            }
        });
    });
}

async function cargarDatos() {
    try {
        const [datosRes, historicoRes] = await Promise.all([
            fetch('datos.json?' + Date.now()),
            fetch('historico.json?' + Date.now())
        ]);

        const datos = await datosRes.json();
        const historico = await historicoRes.json();

        crearTarjetas(datos.sitios);
        actualizarSaludGeneral(datos.sitios);
        crearGraficas(datos.sitios, historico);

        document.getElementById('ultima-actualizacion').textContent =
            new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (err) {
        document.getElementById('cards').innerHTML =
            '<div class="card border-red"><p style="color:var(--red)">Error al cargar datos: ' + err.message + '</p></div>';
    }
}

cargarDatos();
setInterval(cargarDatos, 60000);
