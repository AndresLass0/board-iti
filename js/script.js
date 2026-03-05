// Configuración inicial
const problems = ['A', 'B', 'C', 'D', 'E', 'F'];
let teams = {}; // Diccionario para acceso rápido por nombre

// 1. Función para agregar equipos
function addTeam(name) {
    if (!teams[name]) {
        teams[name] = {
            name: name,
            solved: 0,
            penalty: 0,
            problems: {}, // Guardará { 'A': { status: 'NONE', attempts: 0, time: 0 } }
            rank: 0
        };
        problems.forEach(p => {
            teams[name].problems[p] = { status: 'NONE', attempts: 0, time: 0 };
        });
    }
    renderTable();
}

// 2. Procesar Submissions (Conexión lógica con el Backend)
function processSubmission(sub) {
    const { team, problem, verdict, time } = sub;
    const t = teams[team];
    if (!t) return;

    const p = t.problems[problem];

    // Si ya está resuelto, ignorar nuevos envíos (regla ICPC)
    if (p.status === 'OK') return;

    if (verdict === 'OK') {
        p.status = 'OK';
        p.time = time;
        t.solved++;
        t.penalty += time + (p.attempts * 20); // 20 min de penalidad por WA
        triggerFlash(team);
    } else if (verdict === 'WA') {
        p.status = 'WA';
        p.attempts++;
    } else if (verdict === 'TESTING') {
        p.status = 'TESTING';
    }

    updateRanking();
}

// 3. Lógica de Ordenamiento ICPC
// Variable global para guardar las posiciones anteriores
let previousPositions = {};

function updateRanking() {
    const tableBody = document.getElementById('team-rows');
    const rows = Array.from(tableBody.querySelectorAll('tr'));

    // 1. CAPTURAR: Guardar la posición actual (Top) de cada fila antes del cambio
    rows.forEach(row => {
        const teamName = row.dataset.team;
        previousPositions[teamName] = row.getBoundingClientRect().top;
    });

    // 2. ORDENAR: Lógica ICPC
    let sortedTeams = Object.values(teams).sort((a, b) => {
        if (b.solved !== a.solved) return b.solved - a.solved;
        return a.penalty - b.penalty;
    });

    // 3. RE-RENDERIZAR: Dibujar la tabla en el nuevo orden
    renderTable(sortedTeams);

    // 4. ANIMAR: Calcular la diferencia y "jugar" la animación
    const newRows = Array.from(tableBody.querySelectorAll('tr'));
    newRows.forEach(row => {
        const teamName = row.dataset.team;
        const oldTop = previousPositions[teamName];
        const newTop = row.getBoundingClientRect().top;

        if (oldTop && oldTop !== newTop) {
            const deltaY = oldTop - newTop;

            // Invertir: Mover la fila instantáneamente a su posición vieja
            row.style.transition = 'none';
            row.style.transform = `translateY(${deltaY}px)`;
            
            // Si subió de posición, darle un estilo visual destacado
            if (deltaY > 0) row.classList.add('row-moving');

            // Play: Activar la transición para que regrese a su posición real (0)
            requestAnimationFrame(() => {
                row.style.transition = 'transform 0.8s cubic-bezier(0.2, 1, 0.3, 1)';
                row.style.transform = 'translateY(0)';
                
                // Limpiar clases al terminar
                setTimeout(() => {
                    row.classList.remove('row-moving');
                }, 800);
            });
        }
    });
}

// Modificación necesaria en renderTable para incluir el dataset
function renderTable(sortedData) {
    const tbody = document.getElementById('team-rows');
    tbody.innerHTML = '';

    sortedData.forEach((team, index) => {
        const row = document.createElement('tr');
        // Usamos dataset para identificar al equipo durante la animación
        row.dataset.team = team.name; 
        row.id = `row-${team.name.replace(/\s+/g, '-')}`;
        
        // ... (resto del código de generación de celdas igual al anterior) ...
        
        tbody.appendChild(row);
    });
}

// 4. Renderizado Dinámico
function renderTable(sortedData = Object.values(teams)) {
    const tbody = document.getElementById('team-rows');
    tbody.innerHTML = '';

    sortedData.forEach((team, index) => {
        team.rank = index + 1;
        const row = document.createElement('tr');
        row.id = `row-${team.name.replace(/\s+/g, '-')}`;
        
        let problemsHtml = '';
        problems.forEach(p => {
            const state = team.problems[p];
            let className = '';
            let content = '';

            if (state.status === 'OK') {
                className = 'cell-ok';
                content = `${state.time}<br><small>${state.attempts > 0 ? '+'+state.attempts : ''}</small>`;
            } else if (state.status === 'WA') {
                className = 'cell-wa';
                content = `-${state.attempts}`;
            } else if (state.status === 'TESTING') {
                className = 'cell-testing';
                content = '...';
            }

            problemsHtml += `<td class="${className}">${content}</td>`;
        });

        row.innerHTML = `
            <td>${team.rank}</td>
            <td style="text-align:left"><strong>${team.name}</strong></td>
            <td>${team.solved}</td>
            <td>${team.penalty}</td>
            ${problemsHtml}
        `;
        tbody.appendChild(row);
    });
}

function triggerFlash(teamName) {
    const id = `row-${teamName.replace(/\s+/g, '-')}`;
    const el = document.getElementById(id);
    if (el) el.classList.add('flash-success');
}

// --- EJEMPLO DE USO / SIMULACIÓN ---
addTeam("Universidad Nacional");
addTeam("MIT");
addTeam("Stanford");

// Simular un envío
setTimeout(() => {
    processSubmission({ team: "Stanford", problem: "A", verdict: "OK", time: 15 });
}, 2000);

setTimeout(() => {
    processSubmission({ team: "MIT", problem: "A", verdict: "WA", time: 10 });
    processSubmission({ team: "MIT", problem: "A", verdict: "OK", time: 25 });
}, 4000);

setTimeout(() =>{
    processSubmission({ team: "Universidad Nacional", problem: "B", verdict: "TESTING", time: 30 });
    processSubmission({ team: "Universidad Nacional", problem: "C", verdict: "OK", time: 35 });
    processSubmission({ team: "Universidad Nacional", problem: "D", verdict: "OK", time: 50 });
}, 6000)

setTimeout(() =>{
    processSubmission({ team: "Universidad Nacional", problem: "D", verdict: "OK", time: 50 });
}, 8000)