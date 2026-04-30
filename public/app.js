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
        batchEditTitle: "Horari general del torneig",
        btnApplyBatch: "Aplicar a totes les pistes",
        btnApplyCourt: "Aplicar a aquesta pista",
        showAllHours: "+ Mostrar totes les hores",
        hideExtraHours: "− Ocultar hores extra",
        summaryTitle: "Resum d'Inscripcions",
        totalPairs: "parelles en total",
        formatBracket: "Bracket Eliminatori",
        formatGroups: "Fase de Grups (Round Robin)",
        pairs: "parelles",
        btnGenerateSeeds: "Generar caps de sèrie",
        btnGenerateDraws: "Generar equadraments",
        successMsg: "Caps de sèrie generats correctament.",
        errorMsg: "Falten dades. Si us plau, puja tots els arxius i configura el torneig.",
        genSuccess: "Cuadres generats correctament. Revisa la secció inferior.",
        genSeedsError: "Per favor, genera primer els caps de sèrie.",
        genError: "Error generant els quadres. Revisa la consola.",
        genLoading: "Generant els quadres... Per favor espera.",
        mascTitle: "Categories Masculines",
        femTitle: "Categories Femenines",
        drawsTitle: "Quadres Generats",
        btnDownloadPDF: "Descarregar en PDF",
        loadingPDF: "Generant...",
        viewCategories: "Vista per Categories",
        viewSchedule: "Horari per Pistes",
        court: "Pista",
        addException: "+ Excepció",
        noPoints: "No puntuació suficient per determinar",
        seed1: "1r cap de sèrie",
        seed2: "2n cap de sèrie",
        seed3: "3r cap de sèrie",
        seed4: "4t cap de sèrie",
        rulesTitle: "Excepcions d'Emparellament (1a Ronda)",
        ruleCat: "Categoria",
        ruleP1: "Parella 1",
        ruleP2: "Parella 2",
        btnAddRule: "+ Afegir Excepció",
        ruleError: "Selecciona parelles diferents.",
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
        batchEditTitle: "Horario general del torneo",
        btnApplyBatch: "Aplicar a todas las pistas",
        btnApplyCourt: "Aplicar a esta pista",
        showAllHours: "+ Mostrar todas las horas",
        hideExtraHours: "− Ocultar horas extra",
        summaryTitle: "Resumen de Inscripciones",
        totalPairs: "parejas en total",
        formatBracket: "Bracket Eliminatorio",
        formatGroups: "Fase de Grups (Round Robin)",
        pairs: "parejas",
        btnGenerateSeeds: "Generar cabezas de serie",
        btnGenerateDraws: "Generar cuadros",
        successMsg: "Cabezas de serie generados correctamente.",
        errorMsg: "Faltan datos. Por favor, sube todos los archivos y configura el torneo.",
        genSuccess: "Cuadros generados correctamente. Revisa la sección inferior.",
        genSeedsError: "Por favor, genera primero los cabezas de serie.",
        genError: "Error generando cuadros. Revisa la consola.",
        genLoading: "Generando cuadros... Por favor espera.",
        mascTitle: "Categorías Masculinas",
        femTitle: "Categorías Femeninas",
        drawsTitle: "Cuadros Generados",
        btnDownloadPDF: "Descargar en PDF",
        loadingPDF: "Generando...",
        viewCategories: "Vista por Categorías",
        viewSchedule: "Horario por Pistas",
        court: "Pista",
        addException: "+ Excepción",
        noPoints: "No puntuación suficiente para determinar",
        seed1: "1r cabeza de serie",
        seed2: "2º cabeza de serie",
        seed3: "3r cabeza de serie",
        seed4: "4º cabeza de serie",
        rulesTitle: "Excepciones de Emparejamiento (1ª Ronda)",
        ruleCat: "Categoría",
        ruleP1: "Pareja 1",
        ruleP2: "Pareja 2",
        btnAddRule: "+ Añadir Excepción",
        ruleError: "Selecciona parejas diferentes.",
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
    document.getElementById('txt-draws-title').innerText = dict.drawsTitle;
    document.getElementById('btn-download-pdf').innerText = dict.btnDownloadPDF;
    document.getElementById('btn-view-categories').innerText = dict.viewCategories;
    document.getElementById('btn-view-schedule').innerText = dict.viewSchedule;
    const rulesTitleEl = document.getElementById('txt-rules-title');
    if (rulesTitleEl) rulesTitleEl.innerText = dict.rulesTitle;

    if (filesData.inscritos) {
        processInscriptions(filesData.inscritos);
    }

    renderCourts(); // re-render to translate specific texts
}

document.getElementById('lang-switch').addEventListener('change', (e) => {
    currentLang = e.target.value;
    updateUI();
    if (window.datePicker) {
        const currentDates = window.datePicker.selectedDates;
        initDatePicker(currentDates);
    }
});

// --- Variables Globales de Tiempo ---
let tournamentDays = []; // Almacenará los días en formato estricto 'YYYY-MM-DD'
let tournamentFormats = {}; // Guardará { "PRIMERA MASCULINA": "bracket", "SEGONA": "groups" }
let pairsByCategory = {}; // Almacenará los arrays de nombres por categoría
let matchExceptions = []; // Almacenará las reglas creadas

// Función constructora actualizada
function initDatePicker(preserveDates = null) {
    if (window.datePicker) {
        window.datePicker.destroy();
    }

    // Inyección estricta: si es español usa la CDN, si es catalán usa nuestro objeto infalible
    const fpLocale = currentLang === 'ca' ? flatpickr.l10ns.cat : flatpickr.l10ns.es;

    window.datePicker = flatpickr("#tournament-dates", {
        mode: "range",
        dateFormat: "d/m/Y",
        locale: fpLocale, // Recibe el objeto en crudo 100% garantizado
        defaultDate: preserveDates,
        onChange: function (selectedDates) {
            if (selectedDates.length > 0) {
                let start = selectedDates[0];
                let end = selectedDates.length > 1 ? selectedDates[1] : selectedDates[0];
                actualizarDiasTorneo(start, end);
            } else {
                tournamentDays = [];
                courts.forEach(c => c.daily = {});
            }
            renderCourts();
        }
    });
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initDatePicker(); // Llamada inicial sin fechas

    const dummySelect = buildTimeSelect('16:00', '', '');
    const optionsHtml = dummySelect.replace(/<select.*?>|<\/select>/g, '');
    document.getElementById('batch-start-time').innerHTML = optionsHtml;
    document.getElementById('batch-end-time').innerHTML = optionsHtml;
    document.getElementById('batch-start-time').value = '16:00';
    document.getElementById('batch-end-time').value = '22:00';
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

        if (key === 'inscritos') {
            processInscriptions(json);
        }
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

    if (key === 'inscritos') {
        document.getElementById('inscriptions-summary-section').classList.add('hidden');
        tournamentFormats = {};
    }
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

// --- Variables de Horario Base Global ---
let globalStart = '16:00';
let globalEnd = '22:00';

// --- Configuración de Pistas ---
let courts = [{ daily: {}, defaultStart: '16:00', defaultEnd: '22:00' }];

// Genera objeto de slots respetando los minutos de inicio (Ej: 16:30 -> 16:30, 17:30...)
function getBaseSlots(start, end) {
    const slots = {};
    let [startH, startM] = start.split(':').map(Number);
    let [endH, endM] = end.split(':').map(Number);
    let currentH = startH;

    // Iteramos sumando horas enteras pero manteniendo el minuto base
    while (currentH < endH || (currentH === endH && startM < endM)) {
        let timeStr = `${String(currentH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
        slots[timeStr] = true;
        currentH++;
    }
    return slots;
}

function actualizarDiasTorneo(startDate, endDate) {
    const bStart = document.getElementById('batch-start-time');
    const bEnd = document.getElementById('batch-end-time');
    if (bStart && bEnd) {
        globalStart = bStart.value || '16:00';
        globalEnd = bEnd.value || '22:00';
    }

    tournamentDays = [];
    let current = new Date(startDate);

    while (current <= endDate) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        tournamentDays.push(`${year}-${month}-${day}`);
        current.setDate(current.getDate() + 1);
    }

    courts.forEach(court => {
        if (!court.daily) court.daily = {};
        // Si la pista no tiene su propio rango definido, hereda el global
        if (!court.defaultStart) court.defaultStart = globalStart;
        if (!court.defaultEnd) court.defaultEnd = globalEnd;

        tournamentDays.forEach(day => {
            if (!court.daily[day]) {
                court.daily[day] = {
                    active: true,
                    expanded: false,
                    slots: getBaseSlots(court.defaultStart, court.defaultEnd)
                };
            }
        });
    });
}

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

function formatearFechaLocal(fechaISO) {
    const [year, month, day] = fechaISO.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(currentLang === 'ca' ? 'ca-ES' : 'es-ES', {
        weekday: 'short', day: '2-digit', month: '2-digit'
    });
}

function toggleSlot(courtIdx, day, hour) {
    courts[courtIdx].daily[day].slots[hour] = !courts[courtIdx].daily[day].slots[hour];
    renderCourts();
}

function toggleDayActive(courtIdx, day) {
    courts[courtIdx].daily[day].active = !courts[courtIdx].daily[day].active;
    renderCourts();
}

function toggleExpanded(courtIdx, day) {
    const dayData = courts[courtIdx].daily[day];
    const court = courts[courtIdx];
    dayData.expanded = !dayData.expanded;

    // Al expandir, generamos horas extra respetando el minuto base de la pista
    if (dayData.expanded) {
        const baseM = court.defaultStart.split(':')[1];
        for (let h = 8; h <= 22; h++) {
            const key = `${String(h).padStart(2, '0')}:${baseM}`;
            if (!(key in dayData.slots)) dayData.slots[key] = false;
        }
    }
    renderCourts();
}

function renderCourts() {
    const container = document.getElementById('courts-container');
    container.innerHTML = '';
    const dict = i18n[currentLang];

    if (tournamentDays.length === 0) {
        container.innerHTML = `<p class="courts-empty-msg">Selecciona las fechas del torneo para configurar los horarios.</p>`;
        return;
    }

    courts.forEach((court, i) => {
        const box = document.createElement('div');
        box.className = 'court-box';

        const courtStartH = parseInt(court.defaultStart.split(':')[0]);
        const courtEndH = parseInt(court.defaultEnd.split(':')[0]);
        const baseM = court.defaultStart.split(':')[1];
        const courtEndM = parseInt(court.defaultEnd.split(':')[1]);

        let daysHtml = '';
        tournamentDays.forEach(day => {
            const dayData = court.daily[day];
            if (!dayData) return;

            const isActive = dayData.active;
            const isExpanded = dayData.expanded;

            const visibleHours = [];
            if (isExpanded) {
                for (let h = 8; h <= 22; h++) visibleHours.push(`${String(h).padStart(2, '0')}:${baseM}`);
            } else {
                let currentH = courtStartH;
                while (currentH < courtEndH || (currentH === courtEndH && parseInt(baseM) < courtEndM)) {
                    visibleHours.push(`${String(currentH).padStart(2, '0')}:${baseM}`);
                    currentH++;
                }
            }

            const chipsHtml = visibleHours.map(hour => {
                const isOn = dayData.slots[hour] ?? false;
                return `<button
                    class="slot-chip ${isOn ? 'active' : 'inactive'}"
                    onclick="toggleSlot(${i}, '${day}', '${hour}')"
                    ${!isActive ? 'disabled' : ''}
                    title="${hour}"
                >${hour}</button>`;
            }).join('');

            const expandLabel = isExpanded ? dict.hideExtraHours : dict.showAllHours;

            daysHtml += `
            <div class="day-row${!isActive ? ' disabled' : ''}">
                <label class="day-toggle-label">
                    <input type="checkbox" class="day-toggle"
                        ${isActive ? 'checked' : ''}
                        onchange="toggleDayActive(${i}, '${day}')">
                    <span class="day-name">${formatearFechaLocal(day)}</span>
                </label>
                <div class="chips-strip">
                    ${chipsHtml}
                    <button class="expand-btn" onclick="toggleExpanded(${i}, '${day}')">${expandLabel}</button>
                </div>
            </div>`;
        });

        const localBatchHtml = `
            <div class="court-batch-edit">
                ${buildTimeSelect(court.defaultStart, 'time-select court-start', `data-idx="${i}"`)}
                <span class="time-sep">a</span>
                ${buildTimeSelect(court.defaultEnd, 'time-select court-end', `data-idx="${i}"`)}
                <button class="btn-secondary btn-court-batch" data-idx="${i}">${dict.btnApplyCourt}</button>
            </div>
        `;

        box.innerHTML = `
            <div class="court-header">
                <span>${dict.court} ${i + 1}</span>
            </div>
            ${localBatchHtml}
            <div class="time-slots">
                ${daysHtml}
            </div>
        `;
        container.appendChild(box);
    });

    // Listeners del editor individual por pista
    document.querySelectorAll('.court-start').forEach(el => el.addEventListener('change', e => {
        courts[e.target.dataset.idx].defaultStart = e.target.value;
    }));
    document.querySelectorAll('.court-end').forEach(el => el.addEventListener('change', e => {
        courts[e.target.dataset.idx].defaultEnd = e.target.value;
    }));
    document.querySelectorAll('.btn-court-batch').forEach(el => el.addEventListener('click', e => {
        const idx = e.target.dataset.idx;
        const c = courts[idx];
        tournamentDays.forEach(day => {
            if (c.daily[day]) {
                c.daily[day].slots = getBaseSlots(c.defaultStart, c.defaultEnd);
                c.daily[day].expanded = false;
            }
        });
        renderCourts();
    }));
}

document.getElementById('num-courts').addEventListener('change', (e) => {
    const num = parseInt(e.target.value) || 1;
    if (num > courts.length) {
        for (let i = courts.length; i < num; i++) {
            const newCourt = { daily: {}, defaultStart: globalStart, defaultEnd: globalEnd };
            tournamentDays.forEach(day => {
                newCourt.daily[day] = {
                    active: true,
                    expanded: false,
                    slots: getBaseSlots(globalStart, globalEnd)
                };
            });
            courts.push(newCourt);
        }
    } else {
        courts = courts.slice(0, num);
    }
    renderCourts();
});

document.getElementById('btn-apply-batch').addEventListener('click', () => {
    globalStart = document.getElementById('batch-start-time').value;
    globalEnd = document.getElementById('batch-end-time').value;
    // Resetear TODOS los slots de todas las pistas y días
    courts.forEach(court => {
        court.defaultStart = globalStart;
        court.defaultEnd = globalEnd;
        tournamentDays.forEach(day => {
            if (court.daily[day]) {
                court.daily[day].slots = getBaseSlots(globalStart, globalEnd);
                court.daily[day].expanded = false;
            }
        });
    });
    renderCourts();
});

renderCourts(); // Render inicial (vacío hasta seleccionar fechas)

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
        // 1.1 Filtrar filas vacías o nulas del Excel
        const name = (row.nombre || row.Nombre || row.NOMBRE || '').toString().trim();
        if (name === '' || name === 'Sense Nom') return;

        // 1.2 Extraer y limpiar (trim) el nombre de la categoría
        let cat = row.grupo || row.Grupo || row.GRUPO || 'Sense Categoria';
        cat = cat.toString().trim();

        // 1.3 Si tras limpiar los espacios se queda vacío, forzamos el fallback
        if (cat === '') cat = 'Sense Categoria';

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

    document.querySelector('.results-section').classList.remove('hidden');
});

function processInscriptions(data) {
    if (!data || data.length === 0) return;

    const categories = {};
    let totalValidPairs = 0;
    
    pairsByCategory = {}; // Reset

    data.forEach(row => {
        const cat = row.grupo || row.Grupo || row.GRUPO || 'Sense Categoria';
        const name = (row.nombre || row.Nombre || row.NOMBRE || '').toString().trim();

        if (name !== '' && name !== 'Sense Nom') {
            if (!categories[cat]) categories[cat] = 0;
            if (!pairsByCategory[cat]) pairsByCategory[cat] = [];
            
            categories[cat]++;
            pairsByCategory[cat].push(name);
            totalValidPairs++;
        }
    });

    renderInscriptionsSummary(categories, totalValidPairs);
    
    // Iniciar UI de reglas
    populateRulesCategories();
    document.getElementById('matchup-rules-section').classList.remove('hidden');
}

function renderInscriptionsSummary(categories, totalPairs) {
    const section = document.getElementById('inscriptions-summary-section');
    const grid = document.getElementById('categories-grid');
    const dict = i18n[currentLang];

    // Actualizar título y contador
    document.getElementById('txt-summary-title').innerText = dict.summaryTitle;
    document.getElementById('total-inscriptions-badge').innerText = `${totalPairs} ${dict.totalPairs}`;

    grid.innerHTML = '';
    tournamentFormats = {}; // Resetear estado

    // Ordenar alfabéticamente las categorías para que no salgan al azar
    const catKeys = Object.keys(categories).sort();

    catKeys.forEach(cat => {
        tournamentFormats[cat] = 'bracket'; // 'bracket' por defecto

        const card = document.createElement('div');
        card.className = 'category-summary-card';

        card.innerHTML = `
            <div class="category-summary-header">
                <span class="category-summary-title">${cat}</span>
                <span class="category-count">${categories[cat]} ${dict.pairs}</span>
            </div>
            <select class="format-select" data-category="${cat}">
                <option value="bracket">${dict.formatBracket}</option>
                <option value="groups">${dict.formatGroups}</option>
            </select>
        `;
        grid.appendChild(card);
    });

    // Añadir listeners a los selects para actualizar el estado en tiempo real
    document.querySelectorAll('.format-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const cat = e.target.dataset.category;
            tournamentFormats[cat] = e.target.value;
        });
    });

    // Mostrar el panel con la animación CSS
    section.classList.remove('hidden');
}

// LÓGICA DE GENERAR CUADROS Y PISTAS
function buildHorariosPorPista(courtsConfigs) {
    if (tournamentDays.length === 0) return [];

    const horariosPorPista = [];

    courtsConfigs.forEach((court, idx) => {
        const name = `Pista ${idx + 1}`;
        const horarios = [];

        tournamentDays.forEach(dayStr => {
            const dayData = court.daily[dayStr];
            if (!dayData || !dayData.active) return;

            // Recoger slots activos y ordenarlos cronológicamente
            const activeHours = Object.entries(dayData.slots)
                .filter(([, active]) => active)
                .map(([hour]) => hour)
                .sort();

            activeHours.forEach(hourStr => {
                // hourStr ya viene en formato "HH:00" y dayStr en "YYYY-MM-DD"
                // Concatenamos formando un ISO 8601 estricto sin indicador de timezone
                horarios.push(`${dayStr}T${hourStr}:00`);
            });
        });

        horariosPorPista.push({ pista: name, horarios });
    });

    return horariosPorPista;
}

document.getElementById('btn-generate-draws').addEventListener('click', async () => {
    const dict = i18n[currentLang];

    const msgErr = document.getElementById('error-msg');
    const msgSucc = document.getElementById('success-msg');

    if (!window.cabezasDeSerieGeneradas) {
        msgErr.innerText = dict.genSeedsError;
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

    msgSucc.innerText = dict.genLoading;
    msgSucc.classList.remove('hidden');
    msgErr.classList.add('hidden');

    // Mostramos el loader
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('hidden');

    const btnGenerarCuadros = document.getElementById('btn-generate-draws');
    btnGenerarCuadros.disabled = true;

    try {
        const response = await axios.post('/api/generar-cuadros', {
            horariosPorPista,
            inscripciones,
            cabezasDeSerie,
            formatos: tournamentFormats,
            excepcionesEmparejamiento: matchExceptions
        });

        const cuadros = response.data;
        console.log("Cuadros generados exitosamente:", cuadros);
        msgSucc.innerText = dict.genSuccess;
        renderizarCuadros(cuadros);
        renderizarHorarios(cuadros);
    } catch (e) {
        console.error("Error al generar cuadros:", e);
        msgErr.innerText = dict.genError;
        msgErr.classList.remove('hidden');
        msgSucc.classList.add('hidden');
    } finally {
        // En ambos casos, tras recibir el resultado o fallar, lo ocultamos
        loadingOverlay.classList.add('hidden');
        btnGenerarCuadros.disabled = false;
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
        const partidos = cuadrosData[cat];
        if (!partidos || partidos.length === 0) return;

        const formato = tournamentFormats[cat] || 'bracket';

        let html = `<div class="bracket-category">
            <h3>${cat}</h3>`;

        if (formato === 'groups') {
            // --- RENDER DE TABLA (FASE DE GRUPOS) ---
            html += `<div class="groups-wrapper">
                <table class="groups-table">
                    <thead>
                        <tr>
                            <th>Data / Hora</th>
                            <th>Pista</th>
                            <th>Parelles</th>
                        </tr>
                    </thead>
                    <tbody>`;

            // Ordenamos cronológicamente para que la lectura sea lógica
            const partidosOrdenados = [...partidos].sort((a, b) => {
                if (!a.fechaHora) return 1;
                if (!b.fechaHora) return -1;
                return new Date(a.fechaHora) - new Date(b.fechaHora);
            });

            partidosOrdenados.forEach(p => {
                let fechaStr = "Horari a definir";
                if (p.fechaHora) {
                    const dateObj = new Date(p.fechaHora);
                    const diaNum = String(dateObj.getDate()).padStart(2, '0');
                    const mesNum = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const horas = String(dateObj.getHours()).padStart(2, '0');
                    const mins = String(dateObj.getMinutes()).padStart(2, '0');
                    fechaStr = `${diaNum}/${mesNum} - ${horas}:${mins}`;
                }

                html += `
                    <tr>
                        <td class="cell-time">${fechaStr}</td>
                        <td><span class="badge-court">${p.pista || 'TBD'}</span></td>
                        <td>
                            <div class="vs-teams">
                                <span class="team-name">${p.pareja1}</span>
                                <span class="vs">vs</span>
                                <span class="team-name">${p.pareja2}</span>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table></div>`;

        } else {
            // --- RENDER DE ÁRBOL (BRACKET) ---
            html += `<div class="bracket-wrapper">`;
            
            // Agrupar partidos por ronda
            const partidosPorRonda = {};
            // El motor genera el array en orden DFS (Root, Right, Left).
            // Lo invertimos para que al agrupar quede (Left, Right) -> Top to Bottom visualmente.
            [...partidos].reverse().forEach(p => {
                const r = p.ronda || 0;
                if (!partidosPorRonda[r]) partidosPorRonda[r] = [];
                partidosPorRonda[r].push(p);
            });
            
            const rondasKeys = Object.keys(partidosPorRonda).map(Number).sort((a, b) => a - b);
            
            rondasKeys.forEach(r => {
                html += `<div class="bracket-column">`;
                
                // Ordenar partidos para preservar el orden topológico (opcional, dependiendo de cómo se devuelvan)
                const partidosRonda = partidosPorRonda[r];
                
                partidosRonda.forEach((p, i) => {
                    const esImpar = i % 2 !== 0 ? 'odd' : '';

                    let fechaStr = "Horari a definir";
                    if (p.fechaHora) {
                        const dateObj = new Date(p.fechaHora);
                        const diaNum = String(dateObj.getDate()).padStart(2, '0');
                        const mesNum = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const horas = String(dateObj.getHours()).padStart(2, '0');
                        const mins = String(dateObj.getMinutes()).padStart(2, '0');
                        fechaStr = `${diaNum}/${mesNum} - ${horas}:${mins}`;
                    }

                    const isBye1 = !p.pareja1 || p.pareja1.includes("Fantasma");
                    const isBye2 = !p.pareja2 || p.pareja2.includes("Fantasma");

                    const p1Class = isBye1 ? "team bye" : "team filled";
                    const p2Class = isBye2 ? "team bye" : "team filled";

                    const p1Name = isBye1 ? "BYE" : p.pareja1;
                    const p2Name = isBye2 ? "BYE" : p.pareja2;

                    const pistaTexto = p.esBye ? '' : (p.pista ? p.pista : 'Pista TBD');
                    const infoTexto = p.esBye ? 'Passa de ronda' : fechaStr;

                    html += `
                        <div class="match-box-container ${esImpar}">
                            <div class="match-box">
                                <div class="match-info">
                                    <span>${pistaTexto}</span>
                                    <span>${infoTexto}</span>
                                </div>
                                <div class="match-teams">
                                    <div class="${p1Class}"><span>${p1Name}</span> <span class="score">0</span></div>
                                    <div class="${p2Class}"><span>${p2Name}</span> <span class="score">0</span></div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                html += `</div>`;
            });
            html += `</div>`;
        }

        html += `</div>`;
        container.innerHTML += html;
    });
}

// --- LÓGICA DE EXPORTACIÓN A PDF ---
document.getElementById('btn-download-pdf').addEventListener('click', function () {
    const container = document.getElementById('draws-container');
    const dict = i18n[currentLang];

    // 1. Feedback visual
    const originalText = this.innerText;
    this.innerText = dict.loadingPDF;
    this.disabled = true;

    // 2. Preparar el DOM: Añadimos una clase que quita el scroll y expande todo a su ancho real
    container.classList.add('pdf-exporting');

    const opt = {
        margin: 0, // Cero márgenes para evitar las líneas/bordes en el PDF
        filename: 'Cuadros_Audi_Padel_Series.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#0d1117',
            scrollY: 0,
            scrollX: 0,
            windowWidth: container.scrollWidth // Asegura que se captura todo el ancho sin cortes
        },
        jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opt).from(container).save().then(() => {
        // 3. Restaurar el DOM a su estado normal con scroll
        container.classList.remove('pdf-exporting');

        this.innerText = originalText;
        this.disabled = false;
    }).catch(err => {
        console.error("Error exportando a PDF:", err);
        container.classList.remove('pdf-exporting');
        this.innerText = "Error";
        setTimeout(() => {
            this.innerText = originalText;
            this.disabled = false;
        }, 3000);
    });
});

function renderizarHorarios(cuadrosData) {
    const container = document.getElementById('schedule-container');
    container.innerHTML = '';

    const schedule = {};

    // 1. Aplastar y extraer datos
    for (const cat in cuadrosData) {
        for (const partido of cuadrosData[cat]) {
            if (partido.esBye || !partido.fechaHora || !partido.pista) continue;

            const d = new Date(partido.fechaHora);
            const diaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const horaStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

            if (!schedule[diaStr]) schedule[diaStr] = {};
            if (!schedule[diaStr][partido.pista]) schedule[diaStr][partido.pista] = [];

            schedule[diaStr][partido.pista].push({
                hora: horaStr,
                timestamp: d.getTime(),
                cat: cat,
                p1: partido.pareja1,
                p2: partido.pareja2
            });
        }
    }

    // 2. Renderizar iterando en orden
    const diasOrdenados = Object.keys(schedule).sort();

    if (diasOrdenados.length === 0) {
        container.innerHTML = '<p class="courts-empty-msg">No hi ha partits programats.</p>';
        return;
    }

    let html = '';
    diasOrdenados.forEach(dia => {
        html += `<div class="schedule-day-block">
                    <h3 class="schedule-date">📅 ${formatearFechaLocal(dia)}</h3>
                    <div class="schedule-courts-grid">`;

        const pistasOrdenadas = Object.keys(schedule[dia]).sort();

        pistasOrdenadas.forEach(pista => {
            html += `<div class="schedule-court-col">
                        <h4 class="court-name-title">${pista}</h4>
                        <div class="schedule-matches-list">`;

            // Orden cronológico estricto por timestamp
            const partidosPista = schedule[dia][pista].sort((a, b) => a.timestamp - b.timestamp);

            partidosPista.forEach(p => {
                html += `
                    <div class="s-match-card">
                        <div class="s-match-time">${p.hora}</div>
                        <div class="s-match-details">
                            <span class="s-match-cat">${p.cat}</span>
                            <div class="s-match-players">
                                <span>${p.p1}</span>
                                <span class="s-vs">vs</span>
                                <span>${p.p2}</span>
                            </div>
                        </div>
                    </div>`;
            });

            html += `</div></div>`; // Cierra list y col
        });

        html += `</div></div>`; // Cierra grid y block
    });

    container.innerHTML = html;
}

// --- LÓGICA DE PESTAÑAS (VISTAS) ---
document.getElementById('btn-view-categories').addEventListener('click', function () {
    this.classList.add('active');
    document.getElementById('btn-view-schedule').classList.remove('active');
    document.getElementById('draws-container').classList.remove('hidden');
    document.getElementById('schedule-container').classList.add('hidden');
    document.getElementById('btn-download-pdf').classList.remove('hidden');
});

document.getElementById('btn-view-schedule').addEventListener('click', function () {
    this.classList.add('active');
    document.getElementById('btn-view-categories').classList.remove('active');
    document.getElementById('schedule-container').classList.remove('hidden');
    document.getElementById('draws-container').classList.add('hidden');
    document.getElementById('btn-download-pdf').classList.add('hidden');
});

function populateRulesCategories() {
    const catSelect = document.getElementById('rule-category');
    catSelect.innerHTML = '<option value="">-- Categoría --</option>';
    
    Object.keys(pairsByCategory).sort().forEach(cat => {
        catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
    });

    catSelect.addEventListener('change', populateRulesPairs);
}

function populateRulesPairs() {
    const cat = document.getElementById('rule-category').value;
    const p1Select = document.getElementById('rule-pair1');
    const p2Select = document.getElementById('rule-pair2');
    
    p1Select.innerHTML = '<option value="">-- Pareja 1 --</option>';
    p2Select.innerHTML = '<option value="">-- Pareja 2 --</option>';

    if (cat && pairsByCategory[cat]) {
        p1Select.disabled = false;
        p2Select.disabled = false;
        const pairs = pairsByCategory[cat].sort();
        pairs.forEach(p => {
            p1Select.innerHTML += `<option value="${p}">${p}</option>`;
            p2Select.innerHTML += `<option value="${p}">${p}</option>`;
        });
    } else {
        p1Select.disabled = true;
        p2Select.disabled = true;
    }
}

document.getElementById('btn-add-rule').addEventListener('click', () => {
    const cat = document.getElementById('rule-category').value;
    const p1 = document.getElementById('rule-pair1').value;
    const p2 = document.getElementById('rule-pair2').value;

    if (!cat || !p1 || !p2) return;
    if (p1 === p2) {
        alert(i18n[currentLang].ruleError || "Error: Mismas parejas");
        return;
    }

    // Evitar duplicados (A vs B = B vs A)
    const exists = matchExceptions.find(r => r.cat === cat && ((r.p1 === p1 && r.p2 === p2) || (r.p1 === p2 && r.p2 === p1)));
    if (exists) return;

    matchExceptions.push({ id: Date.now(), cat, p1, p2 });
    renderRulesList();
});

window.removeRule = function(id) {
    matchExceptions = matchExceptions.filter(r => r.id !== id);
    renderRulesList();
};

function renderRulesList() {
    const list = document.getElementById('rules-list');
    list.innerHTML = '';
    matchExceptions.forEach(rule => {
        list.innerHTML += `
            <div class="rule-chip">
                <span class="rule-chip-cat">${rule.cat}</span>
                <span class="rule-chip-teams">${rule.p1} <span class="vs-text">vs</span> ${rule.p2}</span>
                <button class="rule-chip-delete" onclick="removeRule(${rule.id})">&times;</button>
            </div>
        `;
    });
}

updateUI();
