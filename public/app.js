// --- i18n Dictionaries ---
const i18n = {
    ca: {
        pageTitle: "Generació d'Encuadraments Audi Padel Series",
        txtInscritos: "Inscrits al torneig (XLSX)",
        txtRankingMasc: "Ranking masculí (XLSX)",
        txtRankingFem: "Ranking femení (XLSX)",
        noFile: "Cap arxiu seleccionat",
        configTitle: "Configuració del Torneig",
        txtTournamentDates: "Dates del torneig",
        txtCourts: "Número de pistes",
        batchEditTitle: "Batch Edit de Disponibilitat",
        btnApplyBatch: "Aplicar a totes les pistes",
        btnGenerateSeeds: "Generar caps de sèrie",
        btnGenerateDraws: "Generar equadraments",
        successMsg: "Caps de sèrie generats correctament.",
        errorMsg: "Falten dades. Si us plau, puja tots els arxius i configura el torneig.",
        mascTitle: "Categories Masculines",
        femTitle: "Categories Femenines",
        court: "Pista",
        addException: "+ Excepció",
        noPoints: "No puntuació suficient per determinar",
        seed1: "1r cap de sèrie",
        seed2: "2n cap de sèrie",
        seed3: "3r cap de sèrie",
        seed4: "4t cap de sèrie"
    },
    es: {
        pageTitle: "Generación de Cuadros Audi Padel Series",
        txtInscritos: "Inscritos al torneo (XLSX)",
        txtRankingMasc: "Ranking masculino (XLSX)",
        txtRankingFem: "Ranking femenino (XLSX)",
        noFile: "Ningún archivo seleccionado",
        configTitle: "Configuración del Torneo",
        txtTournamentDates: "Fechas del torneo",
        txtCourts: "Número de pistas",
        batchEditTitle: "Batch Edit de Disponibilidad",
        btnApplyBatch: "Aplicar a todas las pistas",
        btnGenerateSeeds: "Generar cabezas de serie",
        btnGenerateDraws: "Generar cuadros",
        successMsg: "Cabezas de serie generados correctamente.",
        errorMsg: "Faltan datos. Por favor, sube todos los archivos y configura el torneo.",
        mascTitle: "Categorías Masculinas",
        femTitle: "Categorías Femeninas",
        court: "Pista",
        addException: "+ Excepción",
        noPoints: "No puntuación suficiente para determinar",
        seed1: "1r cabeza de serie",
        seed2: "2º cabeza de serie",
        seed3: "3r cabeza de serie",
        seed4: "4º cabeza de serie"
    }
};

let currentLang = 'ca';

function updateUI() {
    const dict = i18n[currentLang];
    document.title = dict.pageTitle;
    document.getElementById('page-title').innerText = dict.pageTitle;
    document.getElementById('txt-inscritos').innerText = dict.txtInscritos;
    document.getElementById('txt-ranking-masc').innerText = dict.txtRankingMasc;
    document.getElementById('txt-ranking-fem').innerText = dict.txtRankingFem;

    // Update file names if none selected
    ['inscritos', 'ranking-masc', 'ranking-fem'].forEach(id => {
        const el = document.getElementById(`name-${id}`);
        if (el.innerText === i18n.ca.noFile || el.innerText === i18n.es.noFile) {
            el.innerText = dict.noFile;
        }
    });

    document.getElementById('txt-config-title').innerText = dict.configTitle;
    const dateLabel = document.getElementById('txt-tournament-dates');
    if (dateLabel) dateLabel.innerText = dict.txtTournamentDates;
    document.getElementById('txt-courts').innerText = dict.txtCourts;
    document.getElementById('txt-batch-edit-title').innerText = dict.batchEditTitle;
    document.getElementById('btn-apply-batch').innerText = dict.btnApplyBatch;
    document.getElementById('btn-generate-seeds').innerText = dict.btnGenerateSeeds;
    document.getElementById('btn-generate-draws').innerText = dict.btnGenerateDraws;
    document.getElementById('success-msg').innerText = dict.successMsg;
    document.getElementById('error-msg').innerText = dict.errorMsg;
    document.getElementById('txt-masc-title').innerText = dict.mascTitle;
    document.getElementById('txt-fem-title').innerText = dict.femTitle;

    renderCourts(); // re-render to translate specific texts
}

document.getElementById('lang-switch').addEventListener('change', (e) => {
    currentLang = e.target.value;
    updateUI();
    if (window.datePicker) {
        window.datePicker.set('locale', currentLang);
    }
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    window.datePicker = flatpickr("#tournament-dates", {
        mode: "range",
        dateFormat: "d/m/Y",
        locale: currentLang
    });

    // populate batch times explicitly so they match our logic
    const dummySelect = buildTimeSelect('17:00', '', '');
    const optionsHtml = dummySelect.replace(/<select.*?>|<\/select>/g, '');
    document.getElementById('batch-start-time').innerHTML = optionsHtml;
    document.getElementById('batch-end-time').innerHTML = optionsHtml;
    document.getElementById('batch-start-time').value = '17:00';
    document.getElementById('batch-end-time').value = '21:00';
});

// --- File Handling ---
const filesData = {
    inscritos: null,
    rankingMasc: null,
    rankingFem: null
};

function readExcelFile(file, key) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
        filesData[key] = json;
    };
    reader.readAsArrayBuffer(file);
}

function removeSelectedFile(id, e) {
    if (e) e.stopPropagation();
    const key = id === 'inscritos' ? 'inscritos' : (id === 'ranking-masc' ? 'rankingMasc' : 'rankingFem');
    filesData[key] = null;
    document.getElementById(`file-${id}`).value = '';
    const dict = i18n[currentLang];
    document.getElementById(`name-${id}`).innerText = dict.noFile;
    const dropzone = document.getElementById(`dz-${id}`);
    dropzone.classList.remove('has-file');
    dropzone.querySelector('.upload-btn').classList.remove('hidden');
    document.getElementById(`remove-${id}`).classList.add('hidden');
}

function setupFileDropzone(id, key) {
    const dropzone = document.getElementById(`dz-${id}`);
    const input = document.getElementById(`file-${id}`);
    const nameSpan = document.getElementById(`name-${id}`);

    const handleFile = (file) => {
        if (file && file.name.endsWith('.xlsx')) {
            nameSpan.innerText = file.name;
            readExcelFile(file, key);
            dropzone.classList.add('has-file');
            dropzone.querySelector('.upload-btn').classList.add('hidden');
            document.getElementById(`remove-${id}`).classList.remove('hidden');
        } else {
            alert('Només arxius .xlsx / Solo archivos .xlsx');
        }
    };

    input.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
            input.files = e.dataTransfer.files; // Sync with input
        }
    });
}

setupFileDropzone('inscritos', 'inscritos');
setupFileDropzone('ranking-masc', 'rankingMasc');
setupFileDropzone('ranking-fem', 'rankingFem');

// --- Courts Configuration ---
let courts = [];

function buildTimeSelect(value, cls, dataAttrs) {
    let options = '';
    for (let h = 8; h <= 23; h++) {
        for (let m of ['00', '30']) {
            let timeStr = `${h.toString().padStart(2, '0')}:${m}`;
            let selected = timeStr === value ? 'selected' : '';
            options += `<option value="${timeStr}" ${selected}>${timeStr}</option>`;
        }
    }
    return `<select class="${cls}" ${dataAttrs}>${options}</select>`;
}

function renderCourts() {
    const container = document.getElementById('courts-container');
    container.innerHTML = '';
    const dict = i18n[currentLang];

    courts.forEach((court, i) => {
        const box = document.createElement('div');
        box.className = 'court-box';

        let slotsHtml = `<div class="time-slot">
            ${buildTimeSelect(court.start, 'c-start time-select', `data-idx="${i}"`)}
            <span class="time-sep">a</span>
            ${buildTimeSelect(court.end, 'c-end time-select', `data-idx="${i}"`)}
        </div>`;

        court.exceptions.forEach((exc, eIdx) => {
            slotsHtml += `<div class="time-slot exception">
                <input type="date" value="${exc.date}" class="e-date" data-idx="${i}" data-eidx="${eIdx}">
                ${buildTimeSelect(exc.start, 'e-start time-select', `data-idx="${i}" data-eidx="${eIdx}"`)}
                <span class="time-sep">a</span>
                ${buildTimeSelect(exc.end, 'e-end time-select', `data-idx="${i}" data-eidx="${eIdx}"`)}
                <button class="btn-remove-exc" onclick="removeException(${i}, ${eIdx})">X</button>
            </div>`;
        });

        box.innerHTML = `
            <div class="court-header">
                <span>${dict.court} ${i + 1}</span>
                <button onclick="addException(${i})">${dict.addException}</button>
            </div>
            <div class="time-slots">
                ${slotsHtml}
            </div>
        `;
        container.appendChild(box);
    });

    // Attach listeners to sync values back to the array
    document.querySelectorAll('.c-start').forEach(el => el.addEventListener('change', e => courts[e.target.dataset.idx].start = e.target.value));
    document.querySelectorAll('.c-end').forEach(el => el.addEventListener('change', e => courts[e.target.dataset.idx].end = e.target.value));

    document.querySelectorAll('.e-date').forEach(el => el.addEventListener('change', e => courts[e.target.dataset.idx].exceptions[e.target.dataset.eidx].date = e.target.value));
    document.querySelectorAll('.e-start').forEach(el => el.addEventListener('change', e => courts[e.target.dataset.idx].exceptions[e.target.dataset.eidx].start = e.target.value));
    document.querySelectorAll('.e-end').forEach(el => el.addEventListener('change', e => courts[e.target.dataset.idx].exceptions[e.target.dataset.eidx].end = e.target.value));
}

document.getElementById('num-courts').addEventListener('change', (e) => {
    const num = parseInt(e.target.value) || 1;
    // Adjust array size
    if (num > courts.length) {
        for (let i = courts.length; i < num; i++) {
            courts.push({ start: '17:00', end: '21:00', exceptions: [] });
        }
    } else {
        courts = courts.slice(0, num);
    }
    renderCourts();
});

// Init first court
courts.push({ start: '17:00', end: '21:00', exceptions: [] });
renderCourts();

function addException(idx) {
    courts[idx].exceptions.push({ date: '', start: '18:00', end: '19:00' });
    renderCourts();
}

function removeException(idx, eIdx) {
    courts[idx].exceptions.splice(eIdx, 1);
    renderCourts();
}

document.getElementById('btn-apply-batch').addEventListener('click', () => {
    const s = document.getElementById('batch-start-time').value;
    const e = document.getElementById('batch-end-time').value;
    courts.forEach(c => { c.start = s; c.end = e; });
    renderCourts();
});

// --- Logic algorithm ---
function splitNames(str) {
    if (!str) return [];
    if (str.includes('-')) return str.split('-').map(s => s.trim());
    if (str.includes(',')) return str.split(',').map(s => s.trim());
    // Only spaces heuristics
    let words = str.split(' ').filter(s => s.trim() !== '');
    if (words.length >= 4) {
        let mid = Math.floor(words.length / 2);
        return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
    } else if (words.length === 2) {
        return [words[0], words[1]];
    }
    return [str.trim()]; // Fallback
}

function normalizeStr(str) {
    if (!str) return "";
    return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Find points for a player looking sequentially 
function getPoints(playerName, rankingData) {
    const pNorm = normalizeStr(playerName);
    for (let row of rankingData) {
        if (row.Nm && normalizeStr(row.Nm) === pNorm) {
            return parseFloat(row.Pt) || 0;
        }
        // Try substring approach as fallback
        if (row.Nm && normalizeStr(row.Nm).includes(pNorm) || pNorm.includes(normalizeStr(row.Nm))) {
            return parseFloat(row.Pt) || 0;
        }
    }
    return 0;
}

document.getElementById('btn-generate-seeds').addEventListener('click', () => {
    const msgErr = document.getElementById('error-msg');
    const msgSucc = document.getElementById('success-msg');

    const dTourn = document.getElementById('tournament-dates').value;

    if (!filesData.inscritos || !filesData.rankingMasc || !filesData.rankingFem || !dTourn || !dTourn.includes('a') && !dTourn.includes('-') && !dTourn.includes('/')) {
        msgErr.classList.remove('hidden');
        msgSucc.classList.add('hidden');
        return;
    }
    msgErr.classList.add('hidden');

    const categories = {};

    // 1. Group by category
    filesData.inscritos.forEach(row => {
        const cat = row.grupo || row.Grupo || row.GRUPO || 'Sense Categoria';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(row);
    });

    const mascHTML = [];
    const femHTML = [];
    const dict = i18n[currentLang];

    // Sort category keys to respect numeric order in names
    const catKeys = Object.keys(categories).sort((a, b) => {
        // Find textual numbers in Catalan/Spanish like "Primera", "Segona", "1a", "2a"
        const getRank = (str) => {
            const s = normalizeStr(str);
            if (s.includes('1') || s.includes('prim')) return 1;
            if (s.includes('2') || s.includes('seg')) return 2;
            if (s.includes('3') || s.includes('ter') || s.includes('tec')) return 3;
            if (s.includes('4') || s.includes('qua') || s.includes('cua')) return 4;
            if (s.includes('5') || s.includes('qui')) return 5;
            if (s.includes('6') || s.includes('sis') || s.includes('sex')) return 6;
            return 99; // Fallback
        };
        const rA = getRank(a);
        const rB = getRank(b);
        if (rA !== rB) return rA - rB;
        return a.localeCompare(b);
    });

    // 2. Process each category in sorted order
    for (let cat of catKeys) {
        const isMasc = normalizeStr(cat).includes('masc') || normalizeStr(cat).includes('m');
        const isFem = normalizeStr(cat).includes('fem') || normalizeStr(cat).includes('f');
        // By default send to masc if unknown for visual sake, or try to deduce
        const targetRanking = isFem ? filesData.rankingFem : filesData.rankingMasc;

        const pairs = [];

        categories[cat].forEach(row => {
            const pairRaw = row.Nombre || row.nombre || row.NOMBRE || "";
            const players = splitNames(pairRaw);

            let pts1 = 0, pts2 = 0;
            if (players.length > 0) pts1 = getPoints(players[0], targetRanking);
            if (players.length > 1) pts2 = getPoints(players[1], targetRanking);

            // If we deduced wrong gender, maybe try the other ranking as fallback?
            if (pts1 === 0 && pts2 === 0) {
                const fallback = isFem ? filesData.rankingMasc : filesData.rankingFem;
                pts1 = getPoints(players[0], fallback);
                if (players.length > 1) pts2 = getPoints(players[1], fallback);
            }

            pairs.push({
                name: pairRaw,
                score: pts1 + pts2
            });
        });

        // Sort descending
        pairs.sort((a, b) => b.score - a.score);

        // Render HTML
        let html = `<div class="category-group">
            <h4 class="cat-title">${cat}</h4>`;

        // At least 2 pairs with > 0 points
        const validPairs = pairs.filter(p => p.score > 0);

        if (validPairs.length >= 2) {
            const limit = Math.min(validPairs.length, 4);
            if (!window.cabezasDeSerieGeneradas) window.cabezasDeSerieGeneradas = {};
            window.cabezasDeSerieGeneradas[cat] = validPairs.slice(0, limit).map(p => p.name);

            for (let i = 0; i < limit; i++) {
                const seedLabel = i === 0 ? dict.seed1 : (i === 1 ? dict.seed2 : (i === 2 ? dict.seed3 : dict.seed4));
                html += `
                    <div class="seed-box">
                        <span class="seed-label">${i + 1}</span>
                        <span class="seed-name">${validPairs[i].name} (${validPairs[i].score} pts) - ${seedLabel}</span>
                    </div>
                `;
            }
        } else {
            html += `<div class="no-seeds">${dict.noPoints}</div>`;
        }

        html += `</div>`;

        if (isFem) femHTML.push(html);
        else mascHTML.push(html); // Fallback to masc list
    }

    document.getElementById('masc-results').innerHTML = mascHTML.join('');
    document.getElementById('fem-results').innerHTML = femHTML.join('');

    msgSucc.classList.remove('hidden');
    document.getElementById('btn-generate-draws').disabled = false;
});

// LOGICA DE GENERAR CUADROS Y PISTAS
function buildHorariosPorPista(courtsConfigs) {
    const dates = window.datePicker.selectedDates;
    if (!dates || dates.length === 0) return [];

    let startDate = dates[0];
    let endDate = dates.length > 1 ? dates[1] : dates[0];

    const horariosPorPista = [];

    const days = [];
    let current = new Date(startDate);
    while (current <= endDate) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    courtsConfigs.forEach((court, idx) => {
        const name = `Pista ${idx + 1}`;
        const horarios = [];

        days.forEach(day => {
            const dateStr = day.getFullYear() + "-" + String(day.getMonth() + 1).padStart(2, '0') + "-" + String(day.getDate()).padStart(2, '0');
            const exception = court.exceptions.find(exc => exc.date === dateStr);
            const startStr = exception ? exception.start : court.start;
            const endStr = exception ? exception.end : court.end;

            if (startStr && endStr) {
                const startHour = parseInt(startStr.split(':')[0]);
                const startMin = parseInt(startStr.split(':')[1]);
                const endHour = parseInt(endStr.split(':')[0]);
                const endMin = parseInt(endStr.split(':')[1]);

                let slotCurrent = new Date(day);
                slotCurrent.setHours(startHour, startMin, 0, 0);

                let slotEnd = new Date(day);
                slotEnd.setHours(endHour, endMin, 0, 0);

                while (slotCurrent < slotEnd) {
                    horarios.push(slotCurrent.toISOString());
                    slotCurrent.setHours(slotCurrent.getHours() + 1);
                }
            }
        });

        horariosPorPista.push({ pista: name, horarios: horarios });
    });
    return horariosPorPista;
}

document.getElementById('btn-generate-draws').addEventListener('click', async () => {
    const msgErr = document.getElementById('error-msg');
    const msgSucc = document.getElementById('success-msg');

    if (!window.cabezasDeSerieGeneradas) {
        msgErr.innerText = "Por favor, genera primero los cabezas de serie.";
        msgErr.classList.remove('hidden');
        return;
    }

    const inscripcionesBruto = (filesData.inscritos || []).map(row => ({
        grupo: row.grupo || row.Grupo || row.GRUPO || 'Sense Categoria',
        nombre: (row.nombre || row.Nombre || row.NOMBRE || '').toString().trim(),
        observaciones: row.observaciones || row.Observaciones || row.OBSERVACIONES || ''
    }));

    // Filtrar filas vacías o con espacios en blanco erróneos
    const inscripciones = inscripcionesBruto.filter(jugador => jugador.nombre !== '' && jugador.nombre !== 'Sense Nom');
    const horariosPorPista = buildHorariosPorPista(courts);
    const cabezasDeSerie = window.cabezasDeSerieGeneradas;

    msgSucc.innerText = "Generando cuadros... Por favor espera.";
    msgSucc.classList.remove('hidden');
    msgErr.classList.add('hidden');

    // Mostramos el loader
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('hidden');

    try {
        const cuadros = await generarPrimeraRonda(horariosPorPista, inscripciones, cabezasDeSerie);
        console.log("Cuadros generados exitosamente:", cuadros);
        msgSucc.innerText = "Cuadros generados correctamente. Revisa la sección inferior.";
        renderizarCuadros(cuadros);
    } catch (e) {
        console.error("Error al generar cuadros:", e);
        msgErr.innerText = "Error generando cuadros. Revisa la consola.";
        msgErr.classList.remove('hidden');
        msgSucc.classList.add('hidden');
    } finally {
        // En ambos casos, tras recibir el resultado o fallar, lo ocultamos
        loadingOverlay.classList.add('hidden');
    }
});

function renderizarCuadros(cuadrosData) {
    const container = document.getElementById('draws-container');
    const section = document.getElementById('draws-section');
    container.innerHTML = '';

    if (!cuadrosData || Object.keys(cuadrosData).length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    // Ordenar categorias como en la sección de results
    const catKeys = Object.keys(cuadrosData).sort((a, b) => {
        const getRank = (str) => {
            const s = normalizeStr(str);
            if (s.includes('1') || s.includes('prim')) return 1;
            if (s.includes('2') || s.includes('seg')) return 2;
            if (s.includes('3') || s.includes('ter')) return 3;
            if (s.includes('4') || s.includes('qua') || s.includes('cua')) return 4;
            return 99;
        };
        const rA = getRank(a);
        const rB = getRank(b);
        if (rA !== rB) return rA - rB;
        return a.localeCompare(b);
    });

    catKeys.forEach(cat => {
        const partidosRonda1 = cuadrosData[cat];
        if (!partidosRonda1 || partidosRonda1.length === 0) return;

        // Calcular cuántas rondas hay en total basándonos en los partidos de R1
        const numPartidosR1 = partidosRonda1.length;
        let rondasTotal = Math.log2(numPartidosR1 * 2);

        let html = `<div class="bracket-category">
            <h3>${cat}</h3>
            <div class="bracket-wrapper">`;

        // Generar las columnas del bracket
        for (let r = 0; r < rondasTotal; r++) {
            const partidosEnEstaRonda = numPartidosR1 / Math.pow(2, r);
            html += `<div class="bracket-column">`;

            for (let i = 0; i < partidosEnEstaRonda; i++) {
                const esImpar = i % 2 !== 0 ? 'odd' : '';

                // Si es la primera ronda, pintamos los datos reales, si no, espacios en blanco
                if (r === 0) {
                    const p = partidosRonda1[i];
                    let fechaStr = "Horario a definir";
                    if (p.fechaHora) {
                        const dateObj = new Date(p.fechaHora);
                        const diaNum = String(dateObj.getDate()).padStart(2, '0');
                        const mesNum = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const year = dateObj.getFullYear();
                        const horas = String(dateObj.getHours()).padStart(2, '0');
                        const mins = String(dateObj.getMinutes()).padStart(2, '0');
                        fechaStr = `${diaNum}/${mesNum}/${year} ${horas}:${mins}`;
                    }

                    const isBye1 = !p.pareja1 || p.pareja1.includes("Fantasma");
                    const isBye2 = !p.pareja2 || p.pareja2.includes("Fantasma");

                    const p1Class = isBye1 ? "team bye" : "team filled";
                    const p2Class = isBye2 ? "team bye" : "team filled";

                    const p1Name = isBye1 ? "BYE" : p.pareja1;
                    const p2Name = isBye2 ? "BYE" : p.pareja2;

                    html += `
                        <div class="match-box-container ${esImpar}">
                            <div class="match-box">
                                <div class="match-info">
                                    <span>${p.pista ? p.pista : 'Pista TBD'}</span>
                                    <span>${p.esBye ? 'Passa de ronda' : fechaStr} ℹ️</span>
                                </div>
                                <div class="match-teams">
                                    <div class="${p1Class}"><span>${p1Name}</span> <span class="score">0</span></div>
                                    <div class="${p2Class}"><span>${p2Name}</span> <span class="score">0</span></div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    // Cajas vacías para Cuartos, Semis, Final...
                    html += `
                        <div class="match-box-container ${esImpar}">
                            <div class="match-box">
                                <div class="match-info">
                                    <span>TBD</span>
                                    <span>TBD ℹ️</span>
                                </div>
                                <div class="match-teams">
                                    <div class="team"><span>...</span> <span class="score"></span></div>
                                    <div class="team"><span>...</span> <span class="score"></span></div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }
            html += `</div>`; // Cierra bracket-column
        }

        html += `</div></div>`; // Cierra wrapper y category
        container.innerHTML += html;
    });
}

updateUI();
