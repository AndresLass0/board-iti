const PROBLEMS = ["A", "B", "C", "D", "E", "F", "G"];
const ROW_TOTAL_HEIGHT = 58;

let boardData = [];
let processedEventIds = new Set();
let eventQueue = [];
let isFetching = false;
let audioEnabled = false;
let isInitialLoad = true;

let contestStartTimeMs = null; 
let clockInterval = null;

const successSound = new Audio('./recursos/sonido.m4a');

const soundBtn = document.getElementById('sound-toggle-btn');
soundBtn.addEventListener('click', () => {
    if (!audioEnabled) {
        successSound.play().then(() => {
            successSound.pause();
            successSound.currentTime = 0;
            audioEnabled = true;
            soundBtn.innerText = '🔊 Sonido Activado';
            soundBtn.className = 'sound-on';
        }).catch(e => console.warn("Audio bloqueado", e));
    } else {
        audioEnabled = false;
        soundBtn.innerText = '🔇 Sonido Apagado';
        soundBtn.className = 'sound-off';
    }
});

fetchNewEvents();
setInterval(fetchNewEvents, 3000); 

function startLocalClock() {
    if (clockInterval) clearInterval(clockInterval);
    
    clockInterval = setInterval(() => {
        if (!contestStartTimeMs) return;

        const now = Date.now();
        const diffSeconds = Math.floor((now - contestStartTimeMs) / 1000);

        if (diffSeconds < 0) {
            document.getElementById('countdown-overlay').style.display = 'flex';
            let s = Math.abs(diffSeconds);
            let h = Math.floor(s / 3600).toString().padStart(2, '0');
            let m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
            let sec = (s % 60).toString().padStart(2, '0');
            
            document.getElementById('countdown-timer').innerText = `${h}:${m}:${sec}`;
            document.getElementById('contest-status').innerText = 'ESPERANDO INICIO...';
        } else {
            document.getElementById('countdown-overlay').style.display = 'none';
            document.getElementById('contest-status').innerText = `LIVE - ${Math.floor(diffSeconds / 60)}m ${diffSeconds % 60}s`;
        }
    }, 1000);
}

async function fetchNewEvents() {
    if (isFetching) return;
    isFetching = true;
    try {
        const boardResp = await fetch('./recursos/board.json?t=' + new Date().getTime());
        const boardStatus = await boardResp.json();

        if (!contestStartTimeMs || isInitialLoad) {
            if (boardStatus.status === "COUNTDOWN") {
                contestStartTimeMs = Date.now() + (boardStatus.seconds_left * 1000);
            } else {
                contestStartTimeMs = Date.now() - (boardStatus.elapsed * 1000);
            }
            startLocalClock();
        }

        if (boardStatus.status === "COUNTDOWN") {
            isFetching = false;
            return;
        }

        const response = await fetch('./recursos/eventos.json?t=' + new Date().getTime());
        const allEvents = await response.json();
        const localElapsedSeconds = Math.floor((Date.now() - contestStartTimeMs) / 1000);

        // --- CORRECCIÓN AQUÍ ---
        if (isInitialLoad) {
            boardData = boardStatus.data || []; 
            
            // Solo ignoramos los eventos que de verdad ya pasaron en el reloj
            allEvents.forEach(e => {
                if (e.time <= localElapsedSeconds) {
                    processedEventIds.add(e.id);
                }
            }); 
            
            document.getElementById('submissions-log').innerHTML = '';
            const pastEvents = allEvents.filter(e => e.time <= localElapsedSeconds);
            pastEvents.slice(-25).forEach(e => renderSingleLog(e));
            
            updateUI(null, false); 
            isInitialLoad = false;
            
            processQueue(); 
            isFetching = false;
            return;
        }

        const newEvents = allEvents.filter(e => 
            !processedEventIds.has(e.id) && e.time <= localElapsedSeconds
        );

        if (newEvents.length > 0) {
            newEvents.forEach(e => {
                processedEventIds.add(e.id);
                eventQueue.push(e); 
            });
        }
    } catch (e) { console.warn("Sincronizando..."); }
    isFetching = false;
}

function processQueue() {
    if (eventQueue.length === 0) {
        setTimeout(processQueue, 500); 
        return;
    }

    const event = eventQueue.shift();
    const isAC = (event.result === "OK" || event.result === "ACCEPTED");

    if (isAC && audioEnabled) {
        successSound.currentTime = 0;
        successSound.play().catch(e => console.warn(e));
    }

    applyEventToBoard(event);
    renderSingleLog(event);
    updateUI(event.team, isAC);

    setTimeout(processQueue, 1500); 
}

function applyEventToBoard(event) {
    let team = boardData.find(t => t.team === event.team);
    if (!team) {
        team = { team: event.team, solved: 0, penalty: 0, problems: {} };
        boardData.push(team);
    }
    const prob = team.problems[event.problem] || { wa: 0, solved: false, time: null };
    
    if (!prob.solved) {
        if (event.result === "OK" || event.result === "ACCEPTED") {
            prob.solved = true;
            prob.time = event.time;
            team.solved++;
            team.penalty += event.time;
        } else if (!["TESTING", "PENDING"].includes(event.result)) {
            prob.wa++;
        }
    }
    team.problems[event.problem] = prob;
}

function updateUI(updatedTeam = null, wasAC = false) {
    const container = document.getElementById('team-rows-container');

    boardData.sort((a, b) => {
        if (b.solved !== a.solved) return b.solved - a.solved;
        return a.penalty - b.penalty;
    });

    boardData.forEach((team, index) => {
        const rowId = `row-${team.team.replace(/\./g, '')}`;
        let row = document.getElementById(rowId);

        if (!row) {
            row = document.createElement('div');
            row.id = rowId;
            row.className = 'team-row';
            row.style.transform = `translateY(${(index + 2) * ROW_TOTAL_HEIGHT}px)`;
            row.style.opacity = "0";
            container.appendChild(row);
        }

        const newContent = `
            <div class="col">${index + 1}</div>
            <div class="col" style="text-align:left; padding-left:15px"><strong>${team.team}</strong></div>
            <div class="col">${team.solved}</div>
            <div class="col">${Math.floor(team.penalty / 60)}</div>
            ${PROBLEMS.map(p => {
                const info = team.problems[p] || {wa:0, solved:false};
                return info.solved 
                    ? `<div class="col cell-ok">✔ <small>${Math.floor(info.time/60)}'</small></div>` 
                    : `<div class="col cell-wa">${info.wa > 0 ? '-' + info.wa : '.'}</div>`;
            }).join('')}
        `;

        if (row.innerHTML !== newContent) {
            row.innerHTML = newContent;
        }

        requestAnimationFrame(() => {
            row.style.opacity = "1";
            row.style.transform = `translateY(${index * ROW_TOTAL_HEIGHT}px)`;
            
            if (team.team === updatedTeam && wasAC) {
                row.classList.remove('just-updated');
                void row.offsetWidth; 
                row.classList.add('just-updated');

                if (row.dataset.timeoutId) clearTimeout(parseInt(row.dataset.timeoutId));
                row.dataset.timeoutId = setTimeout(() => {
                    row.classList.remove('just-updated');
                }, 1000);
            }
        });
    });
}

function renderSingleLog(event) {
    const log = document.getElementById('submissions-log');
    const item = document.createElement('div');
    const isOK = event.result === 'OK' || event.result === 'ACCEPTED';
    item.className = `sub-item ${isOK ? 'OK' : 'WA'}`;
    item.innerHTML = `<strong>${event.team}</strong> [${event.problem}]<br><small>${event.result}</small>`;
    log.prepend(item);
    if (log.children.length > 25) log.lastElementChild.remove();
}