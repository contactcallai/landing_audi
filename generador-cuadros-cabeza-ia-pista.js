let axios;
if (typeof require !== 'undefined') {
    try {
        axios = require('axios');
    } catch (e) {
        console.error("Axios not found, ensure you ran npm install.");
    }
} else {
    axios = window.axios;
}

// --- SISTEMA DE CACHÉ PERSISTENTE ---
let fs, path, crypto;
let restriccionesCache = {};
const isNode = typeof require !== 'undefined' && typeof window === 'undefined';

if (isNode) {
    fs = require('fs');
    path = require('path');
    crypto = require('crypto');

    const CACHE_FILE = path.join(__dirname, 'ia_cache_restricciones.json');

    // 1. Cargar caché desde el disco al arrancar el servidor
    if (fs.existsSync(CACHE_FILE)) {
        try {
            const rawData = fs.readFileSync(CACHE_FILE, 'utf8');
            restriccionesCache = JSON.parse(rawData);
            console.log(`[Caché IA] Cargadas ${Object.keys(restriccionesCache).length} configuraciones desde el disco.`);
        } catch (e) {
            console.error("Error leyendo archivo de caché:", e);
        }
    }

    // 2. Exponemos la función de guardado
    global.guardarCacheIA = function () {
        try {
            fs.writeFileSync(CACHE_FILE, JSON.stringify(restriccionesCache, null, 2), 'utf8');
        } catch (e) {
            console.error("Error escribiendo en archivo de caché:", e);
        }
    };
}
// ------------------------------------

// NUEVA FUNCIÓN EVALUADORA: Evalúa un único partido en una fecha/hora concreta
function evaluarPartidoUnico(j1, j2, fechaHoraString, restriccionesCat) {
    let imp = 0;
    let pen = 0;

    const fechaPartido = new Date(fechaHoraString);
    const mapaDias = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
    const diaSemanaTexto = mapaDias[fechaPartido.getDay()];
    const horaPartidoTexto = fechaPartido.toTimeString().substring(0, 5); // Ej: "08:00"

    const restJ1 = restriccionesCat?.[j1] || { restricciones_duras: [], restricciones_blandas: [] };
    const restJ2 = restriccionesCat?.[j2] || { restricciones_duras: [], restricciones_blandas: [] };

    const todasDuras = [...(restJ1.restricciones_duras || []), ...(restJ2.restricciones_duras || [])];
    const todasBlandas = [...(restJ1.restricciones_blandas || []), ...(restJ2.restricciones_blandas || [])];

    // 1. RESTRICCIONES DURAS
    let posible = true;
    for (const req of todasDuras) {
        const afectaDia = (req.dia === "TODOS" || req.dia === diaSemanaTexto || req.dia === `${diaSemanaTexto}_MANANA` || req.dia === `${diaSemanaTexto}_TARDE`);

        if (req.tipo === "hora_minima" && afectaDia && horaPartidoTexto < req.hora) posible = false;
        if (req.tipo === "hora_maxima" && afectaDia && horaPartidoTexto > req.hora) posible = false;
        if (req.tipo === "hora_exacta" && afectaDia && horaPartidoTexto !== req.hora) posible = false;
        if (req.tipo === "dia_excluido" && afectaDia) posible = false;
        if (req.tipo === "rango_fechas") {
            const diaPartido = fechaPartido.getDate();
            if (req.desde !== null && diaPartido < req.desde) posible = false;
            if (req.hasta !== null && diaPartido > req.hasta) posible = false;
        }
    }

    if (!posible) {
        imp++;
        pen += 1000;
    } else {
        // 2. RESTRICCIONES BLANDAS
        for (const req of todasBlandas) {
            const afectaDia = (req.dia === "TODOS" || req.dia === diaSemanaTexto || req.dia === `${diaSemanaTexto}_MANANA` || req.dia === `${diaSemanaTexto}_TARDE`);
            const peso = req.peso || 5;

            // Evaluaciones dependientes del día/hora
            if (req.tipo === "hora_minima" && afectaDia && horaPartidoTexto < req.hora) pen += peso;
            if (req.tipo === "hora_maxima" && afectaDia && horaPartidoTexto > req.hora) pen += peso;
            if (req.tipo === "hora_exacta" && afectaDia && horaPartidoTexto !== req.hora) pen += peso;
            if (req.tipo === "preferencia_tarde" && afectaDia && horaPartidoTexto < "16:00") pen += peso;
            if (req.tipo === "preferencia_temprano" && afectaDia && horaPartidoTexto >= "16:00") pen += peso;

            // Evaluaciones sobre el día entero
            if (req.tipo === "dia_evitar" && req.dia === diaSemanaTexto) pen += peso;
            if (req.tipo === "dia_preferido" && req.dia !== "TODOS" && req.dia !== diaSemanaTexto) pen += peso;
        }
    }

    return { imp, pen };
}

async function generarPrimeraRonda(horariosPorPista, inscripciones, cabezasDeSerie = {}, apiKey, formatos = {}, intentos = 1000, excepcionesEmparejamiento = []) {
    const grupos = {};
    const categoriasIA = {};
    const observacionesIA = {};

    for (const ins of inscripciones) {
        if (!grupos[ins.grupo]) grupos[ins.grupo] = [];
        grupos[ins.grupo].push(ins);

        if (!categoriasIA[ins.grupo]) {
            categoriasIA[ins.grupo] = [];
            observacionesIA[ins.grupo] = {};
        }
        categoriasIA[ins.grupo].push(ins.nombre);
        if (ins.observaciones && ins.observaciones.trim() !== "") {
            observacionesIA[ins.grupo][ins.nombre] = ins.observaciones;
        }
    }

    const prompt = construirPromptAnalisisTodas(categoriasIA, observacionesIA, {});

    let restriccionesJSON;

    // Solo aplicamos caché persistente si estamos corriendo en Node (backend)
    if (isNode) {
        // Crear un hash criptográfico corto y único del prompt
        const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');

        if (restriccionesCache[promptHash]) {
            console.log("\n=== ⚡ USANDO CACHÉ PERSISTENTE: Restricciones recuperadas del disco ===");
            restriccionesJSON = restriccionesCache[promptHash];
        } else {
            restriccionesJSON = await callOpenAI(prompt, apiKey);

            if (Object.keys(restriccionesJSON).length > 0) {
                restriccionesCache[promptHash] = restriccionesJSON;
                global.guardarCacheIA(); // Escribir en el disco inmediatamente
            }

            console.log("\n=== 🤖 RESTRICCIONES DETECTADAS POR LA IA ===");
            console.log(JSON.stringify(restriccionesJSON, null, 2));
            console.log("==========================================\n");
        }
    } else {
        // Fallback de seguridad si se ejecuta en navegador (no debería ocurrir)
        restriccionesJSON = await callOpenAI(prompt, apiKey);
    }

    const slotsDisponibles = [];
    for (const datosPista of horariosPorPista) {
        for (const hora of datosPista.horarios) {
            slotsDisponibles.push({ fechaHora: hora, pista: datosPista.pista });
        }
    }

    slotsDisponibles.sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora));

    const slotsGastadosGlobales = new Set();
    const cuadroTorneo = {};

    for (const [nombreGrupo, parejas] of Object.entries(grupos)) {
        const formato = formatos[nombreGrupo] || 'bracket';
        const restriccionesCat = restriccionesJSON[nombreGrupo] || {};

        // NUEVO: Aislar reglas para esta categoría y construir el evaluador booleano
        const excepcionesCat = excepcionesEmparejamiento.filter(e => e.cat === nombreGrupo);
        const esCruceProhibido = (p1, p2) => {
            return excepcionesCat.some(e =>
                (e.p1 === p1 && e.p2 === p2) || (e.p1 === p2 && e.p2 === p1)
            );
        };

        let mejorCuadroGrupo = null;
        let mejorScoreGlobal = { imp: Infinity, pen: Infinity };
        let estancamiento = 0;

        if (formato === 'bracket') {
            // --- LÓGICA DE BRACKET ELIMINATORIO CON CSP BACKTRACKING ---
            const bracketObj = {
                [nombreGrupo]: {
                    parejas: parejas,
                    cabezasDeSerie: cabezasDeSerie[nombreGrupo] || []
                }
            };

            // generarBracketCSP ya muta slotsGastadosGlobales in-place
            const resultadoCSP = generarBracketCSP(
                slotsDisponibles,
                restriccionesJSON,
                bracketObj,
                excepcionesEmparejamiento,
                slotsGastadosGlobales
            );

            mejorCuadroGrupo = resultadoCSP[nombreGrupo];

        } else if (formato === 'groups') {
            // --- LÓGICA DE FASE DE GRUPOS (Round Robin) ---
            let todosLosPartidos = [];
            for (let i = 0; i < parejas.length; i++) {
                for (let j = i + 1; j < parejas.length; j++) {
                    // NUEVO: Si existe una excepción, se elimina de la matriz de la liga
                    if (!esCruceProhibido(parejas[i].nombre, parejas[j].nombre)) {
                        todosLosPartidos.push({ pareja1: parejas[i], pareja2: parejas[j], esBye: false });
                    }
                }
            }

            let actual_orden_partidos = [...todosLosPartidos];

            for (let intento = 0; intento < intentos; intento++) {
                let intento_orden = [...actual_orden_partidos];
                if (intento > 0) {
                    const idx1 = Math.floor(Math.random() * intento_orden.length);
                    const idx2 = Math.floor(Math.random() * intento_orden.length);
                    [intento_orden[idx1], intento_orden[idx2]] = [intento_orden[idx2], intento_orden[idx1]];
                }

                const partidosIntento = [];
                let slotsUsadosVirtualmente = new Set();
                let scoreIntento = { imp: 0, pen: 0 };

                // Mapeo estricto para evitar que un equipo juegue más de un partido AL DÍA
                let bloqueosDiasEquipos = {};
                parejas.forEach(p => bloqueosDiasEquipos[p.nombre] = new Set());

                for (const matchBase of intento_orden) {
                    const partido = { pareja1: matchBase.pareja1.nombre, pareja2: matchBase.pareja2.nombre, esBye: false };

                    let mejorSlot = null;
                    let mejorScoreSlot = { imp: Infinity, pen: Infinity };
                    let indiceMejorSlot = -1;

                    for (let s = 0; s < slotsDisponibles.length; s++) {
                        if (slotsGastadosGlobales.has(s) || slotsUsadosVirtualmente.has(s)) continue;

                        const slot = slotsDisponibles[s];

                        // Extraemos solo el día (ej: "2026-01-20") de la fecha ISO
                        const diaSlot = slot.fechaHora.split('T')[0];

                        // Control de colisión diaria (Max 1 partido por día)
                        if (bloqueosDiasEquipos[partido.pareja1].has(diaSlot) ||
                            bloqueosDiasEquipos[partido.pareja2].has(diaSlot)) {
                            continue;
                        }

                        const scoreSlot = evaluarPartidoUnico(partido.pareja1, partido.pareja2, slot.fechaHora, restriccionesCat);

                        if (scoreSlot.imp < mejorScoreSlot.imp || (scoreSlot.imp === mejorScoreSlot.imp && scoreSlot.pen < mejorScoreSlot.pen)) {
                            mejorScoreSlot = scoreSlot;
                            mejorSlot = slot;
                            indiceMejorSlot = s;
                        }

                        if (mejorScoreSlot.imp === 0 && mejorScoreSlot.pen === 0) break;
                    }

                    if (mejorSlot) {
                        partido.fechaHora = mejorSlot.fechaHora;
                        partido.pista = mejorSlot.pista;
                        partido.slotIndex = indiceMejorSlot;

                        slotsUsadosVirtualmente.add(indiceMejorSlot);

                        const diaAsignado = mejorSlot.fechaHora.split('T')[0];
                        bloqueosDiasEquipos[partido.pareja1].add(diaAsignado);
                        bloqueosDiasEquipos[partido.pareja2].add(diaAsignado);

                        scoreIntento.imp += mejorScoreSlot.imp;
                        scoreIntento.pen += mejorScoreSlot.pen;
                    } else {
                        partido.error = "No hay horarios disponibles.";
                        scoreIntento.imp += 1000;
                    }
                    partidosIntento.push(partido);
                }

                let esMejor = (scoreIntento.imp < mejorScoreGlobal.imp) || (scoreIntento.imp === mejorScoreGlobal.imp && scoreIntento.pen < mejorScoreGlobal.pen);
                if (esMejor || intento === 0) {
                    mejorScoreGlobal = scoreIntento;
                    mejorCuadroGrupo = partidosIntento;
                    actual_orden_partidos = intento_orden;
                    estancamiento = 0;
                    if (scoreIntento.imp === 0 && scoreIntento.pen === 0) break;
                } else {
                    estancamiento++;
                }

                if (estancamiento > 50) {
                    actual_orden_partidos.sort(() => Math.random() - 0.5);
                    estancamiento = 0;
                }
            }
        }

        // Purgado de slots y guardado del mejor resultado de la categoría
        if (mejorCuadroGrupo) {
            for (const partido of mejorCuadroGrupo) {
                if (!partido.esBye && partido.slotIndex !== undefined) {
                    slotsGastadosGlobales.add(partido.slotIndex);
                    delete partido.slotIndex;
                }
            }
        }
        cuadroTorneo[nombreGrupo] = mejorCuadroGrupo;
    }

    return cuadroTorneo;
}

function construirPromptAnalisisTodas(categorias, observacionesCat) {
    /**
     * Construye un único mega-prompt agrupando categorías y parejas, 
     * con el mismo nivel de detalle que el prompt individual.
     * * @param {Object} categorias - Un objeto donde las llaves son strings (nombres de categoría) y los valores son arrays de strings (nombres de parejas).
     * @param {Object} observacionesCat - Un objeto anidado con las observaciones por categoría y pareja.
     * @returns {string} El string completo del prompt.
     */

    const bloquesCategoria = [];

    // Iteramos sobre las categorías usando Object.entries
    for (const [categoria, parejas] of Object.entries(categorias)) {
        const bloquesParejas = [];

        // Aseguramos que existan los datos para la categoría, si no usamos objetos vacíos
        const observaciones = observacionesCat[categoria] || {};

        for (const pareja of parejas) {
            // Si la pareja no tiene observaciones en esta categoría, la saltamos
            if (!(pareja in observaciones)) {
                continue;
            }

            const obs = observaciones[pareja];

            // Usamos template literals (comillas invertidas) para los strings multilínea
            const bloque = `
                PAREJA: ${pareja}
                CATEGORÍA: ${categoria}
                OBSERVACIÓN: "${obs}"
                `;
            bloquesParejas.push(bloque);
        }

        // Si se generaron bloques de parejas para esta categoría, los añadimos
        if (bloquesParejas.length > 0) {
            bloquesCategoria.push(
                `\n========== CATEGORÍA: ${categoria} ==========\n` +
                bloquesParejas.join('\n')
            );
        }
    }

    // Construimos el prompt final
    const prompt = `
        Analiza todas estas observaciones de parejas de pádel, agrupadas por categoría, y extrae restricciones estructuradas.

        ${bloquesCategoria.join('\n')}

        ----------------------------------------
        FORMATO DE RESPUESTA (IMPORTANTE)
        ----------------------------------------

        ¡MUY IMPORTANTE!: Mantén los nombres de las categorías EXACTAMENTE igual a como te los paso. NO los abrevies. Si te paso "PRIMERA MASCULINA", tu llave en el JSON debe ser "PRIMERA MASCULINA", NO "1a Masculina".
        Responde SOLO con un objeto JSON de nivel superior, donde cada clave es una categoría,
        y dentro un objeto por pareja:

        {
        "Primera Femenina": {
            "A": {
            "restricciones_duras": [
                {"tipo": "hora_maxima", "dia": "TODOS|DIA_ESPECIFICO", "hora": "HH:MM", "razon": "explicación"},
                {"tipo": "hora_minima", "dia": "TODOS|DIA_ESPECIFICO", "hora": "HH:MM", "razon": "explicación"},
                {"tipo": "hora_exacta", "dia": "DIA_ESPECIFICO", "hora": "HH:MM", "razon": "explicación"},
                {"tipo": "dia_excluido", "dia": "DIA_ESPECIFICO", "razon": "explicación"},
                {"tipo": "rango_fechas", "desde": "DIA", "hasta": "DIA", "razon": "explicación"}
            ],
            "restricciones_blandas": [
                {"tipo": "hora_maxima", "dia": "TODOS|DIA_ESPECIFICO", "hora": "HH:MM", "peso": 1-10, "razon": "explicación"},
                {"tipo": "hora_minima", "dia": "TODOS|DIA_ESPECIFICO", "hora": "HH:MM", "peso": 1-10, "razon": "explicación"},
                {"tipo": "hora_exacta", "dia": "DIA_ESPECIFICO", "hora": "HH:MM", "peso": 1-10, "razon": "explicación"},
                {"tipo": "preferencia_temprano", "dia": "TODOS|DIA_ESPECIFICO", "peso": 1-10, "razon": "explicación"},
                {"tipo": "preferencia_tarde", "dia": "TODOS|DIA_ESPECIFICO", "peso": 1-10, "razon": "explicación"},
                {"tipo": "dia_preferido", "dia": "DIA_ESPECIFICO", "peso": 1-10, "razon": "explicación"},
                {"tipo": "dia_evitar", "dia": "DIA_ESPECIFICO", "peso": 1-10, "razon": "explicación"}
            ],
            "notas_adicionales": "cualquier detalle relevante que no encaje arriba"
            },
            ...
        },
        "Primera Masculina": {
            ...
        }
        }

        ----------------------------------------
        CRITERIOS DE CLASIFICACIÓN
        ----------------------------------------

        RESTRICCIONES DURAS (obligatorias, no negociables):
        - Palabras clave: "SI o SI", "tiene que ser", "IMPOSIBLE", "obligatorio", "no puedo", "tengo que"
        - Razones laborales: "trabajo", "entro a trabajar", "salgo a las X", "guardia", "turno de noche"
        - Compromisos ineludibles: "interseries", "cumpleaños", "estoy fuera"
        - Contexto: si violarla hace imposible jugar
        - Ejemplo: "Sábado 26 SI o SI a las 10h porque trabajo a las 13h" → DURA

        RESTRICCIONES BLANDAS (preferencias, negociables):
        - Palabras clave: "si puede ser", "preferible", "mejor", "a ser posible", "si es posible"
        - Flexibilidad explícita: "sino no pasa nada", "si no podéis no pasa nada"
        - Preferencias sin consecuencias importantes
        - Ejemplo: "Si puede ser el 26 antes de las 19h, sino no pasa nada" → BLANDA (peso alto)

        REGLAS DE TIPADO ESTRICTO:
        - Para el tipo "rango_fechas", las claves "desde" y "hasta" DEBEN ser obligatoriamente números enteros (del 1 al 31) representando el día del mes.
        - Nunca uses strings ni texto como "EN_ADELANTE" o "DIA_20". 
        - Si un rango no tiene límite superior (ej. "a partir del día 20"), el campo "hasta" debe ser estrictamente el valor primitivo null.

        AMBIGÜEDADES:
        - REGLA DE ORO: Las indicaciones de hora directas y concisas (ej. "Jugar a las 19", "A partir de las 18") SIN léxico de flexibilidad explícito ("si es posible", "mejor"), DEBEN considerarse SIEMPRE RESTRICCIONES DURAS. No asumas que es una preferencia a menos que el jugador lo indique claramente.
        - "Como muy tarde 20h" → DURA si no hay flexibilidad
        - "Como muy tarde 20h + sino no pasa nada" → BLANDA (peso alto)
        - "No más tarde de 20h por favor" → BLANDA (cortesía)
        - "No más tarde de 20h porque trabajo" → DURA

        EJEMPLOS:

        Ejemplo 1:
        {
        "restricciones_duras": [{"tipo": "hora_exacta", "dia": "SABADO_26_MANANA", "hora": "10:00", "razon": "Trabajo a las 13h"}],
        "restricciones_blandas": []
        }

        Ejemplo 2:
        {
        "restricciones_duras": [],
        "restricciones_blandas": [{"tipo": "hora_maxima", "dia": "SABADO_26_TARDE", "hora": "19:00", "peso": 8, "razon": "Preferencia horaria flexible"}]
        }

        Ejemplo 3:
        {
        "restricciones_duras": [{"tipo": "hora_maxima", "dia": "TODOS", "hora": "20:00", "razon": "Trabajo nocturno"}],
        "restricciones_blandas": []
        }

        Ejemplo 4:
        {
        "restricciones_duras": [],
        "restricciones_blandas": [{"tipo": "preferencia_temprano", "dia": "TODOS", "peso": 7, "razon": "Preferencia por jugar temprano"}]
        }

        Responde SOLO con el JSON, sin nada más.
        `;

    return prompt;
}

async function callOpenAI(prompt, apiKey) {
    if (!apiKey) {
        console.error("❌ Error: No se ha proporcionado una clave API de OpenAI.");
        return {};
    }

    const url = "https://api.openai.com/v1/chat/completions";

    try {
        console.log("... Enviando datos a OpenAI (esto puede tardar más de un minuto) ...");

        const response = await axios.post(url, {
            model: "gpt-5", // Updated to a valid known model
            messages: [
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        }, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            timeout: 600000
        });

        let content = response.data.choices[0].message.content;
        content = content.replace(/```json/g, "").replace(/```/g, "").trim();

        return JSON.parse(content);

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error("❌ Error: La IA ha tardado más de 10 minutos (Timeout).");
        } else if (error.response) {
            console.error(`❌ Error API (${error.response.status}):`, error.response.data);
        } else {
            console.error("❌ Error de conexión:", error.message);
        }
        return {};
    }
}

// =============================================================================
// MOTOR CSP CON BACKTRACKING TOP-DOWN
// Arquitectura de 4 capas:
//   1. Top-Down DFS con backtracking real
//   2. Fusión de dominios (Domain Intersection)
//   3. Holgura cronológica estricta (Arc Consistency)
//   4. Relajación dinámica de restricciones (Degradation)
// =============================================================================

const MIN_DESCANSO_MS = 4 * 60 * 60 * 1000; // 4 horas en milisegundos

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------

/**
 * Evalúa si un slot ISO-string viola una restricción dura concreta.
 * Retorna true si la restricción se viola (el slot es inválido).
 */
function _violaRestriccionDura(req, fechaHoraString) {
    const fecha = new Date(fechaHoraString);
    const mapaDias = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
    const diaSemana = mapaDias[fecha.getDay()];
    const horaTexto = fecha.toTimeString().substring(0, 5);
    const diaNum = fecha.getDate();

    const afectaDia = (
        req.dia === "TODOS" ||
        req.dia === diaSemana ||
        req.dia === `${diaSemana}_MANANA` ||
        req.dia === `${diaSemana}_TARDE`
    );

    if (req.tipo === "hora_minima" && afectaDia && horaTexto < req.hora) return true;
    if (req.tipo === "hora_maxima" && afectaDia && horaTexto > req.hora) return true;
    if (req.tipo === "hora_exacta" && afectaDia && horaTexto !== req.hora) return true;
    if (req.tipo === "dia_excluido" && afectaDia) return true;
    if (req.tipo === "rango_fechas") {
        if (req.desde !== null && diaNum < req.desde) return true;
        if (req.hasta !== null && diaNum > req.hasta) return true;
    }
    return false;
}

/**
 * Calcula la penalización blanda acumulada de un slot para un conjunto de
 * restricciones blandas.
 */
function _penalizacionBlanda(restriccionesBlandas, fechaHoraString) {
    const fecha = new Date(fechaHoraString);
    const mapaDias = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
    const diaSemana = mapaDias[fecha.getDay()];
    const horaTexto = fecha.toTimeString().substring(0, 5);
    let pen = 0;

    for (const req of restriccionesBlandas) {
        const afectaDia = (
            req.dia === "TODOS" ||
            req.dia === diaSemana ||
            req.dia === `${diaSemana}_MANANA` ||
            req.dia === `${diaSemana}_TARDE`
        );
        const peso = req.peso || 5;
        if (req.tipo === "hora_minima" && afectaDia && horaTexto < req.hora) pen += peso;
        if (req.tipo === "hora_maxima" && afectaDia && horaTexto > req.hora) pen += peso;
        if (req.tipo === "hora_exacta" && afectaDia && horaTexto !== req.hora) pen += peso;
        if (req.tipo === "preferencia_tarde" && afectaDia && horaTexto < "16:00") pen += peso;
        if (req.tipo === "preferencia_temprano" && afectaDia && horaTexto >= "16:00") pen += peso;
        if (req.tipo === "dia_evitar" && req.dia === diaSemana) pen += peso;
        if (req.tipo === "dia_preferido" && req.dia !== "TODOS" && req.dia !== diaSemana) pen += peso;
    }
    return pen;
}

// ---------------------------------------------------------------------------
// PASO 2 – Fusión de dominios (Domain Intersection)
// ---------------------------------------------------------------------------

/**
 * Recolecta y fusiona todas las restricciones duras y blandas de las
 * parejas de un nodo del bracket (hoja o nodo interno).
 *
 * @param {Object} nodo - Nodo del bracket con shape:
 *   { pareja1: string|null, pareja2: string|null, hijos: [nodo, nodo]|null }
 * @param {Object} restriccionesCat - Mapa pareja → { restricciones_duras, restricciones_blandas }
 * @returns {{ duras: Array, blandas: Array }}
 */
function fusionarRestricciones(nodo, restriccionesCat) {
    const duras = [];
    const blandas = [];

    // Recolección DFS de todas las parejas del subárbol
    const pila = [nodo];
    const parejasVistas = new Set();

    while (pila.length > 0) {
        const actual = pila.pop();
        if (!actual) continue;

        if (actual.pareja1 && !parejasVistas.has(actual.pareja1)) {
            parejasVistas.add(actual.pareja1);
            const r = restriccionesCat[actual.pareja1];
            if (r) {
                duras.push(...(r.restricciones_duras || []));
                blandas.push(...(r.restricciones_blandas || []));
            }
        }
        if (actual.pareja2 && !parejasVistas.has(actual.pareja2)) {
            parejasVistas.add(actual.pareja2);
            const r = restriccionesCat[actual.pareja2];
            if (r) {
                duras.push(...(r.restricciones_duras || []));
                blandas.push(...(r.restricciones_blandas || []));
            }
        }
        if (actual.hijos) {
            for (const hijo of actual.hijos) pila.push(hijo);
        }
    }

    return { duras, blandas };
}

// ---------------------------------------------------------------------------
// PASO 3 – Validación de Arc Consistency (holgura cronológica)
// ---------------------------------------------------------------------------

/**
 * Devuelve true si el slot hijo es temporalmente viable respecto al slot padre.
 * Regla: tiempoHijo <= tiempoPadre - MIN_DESCANSO_MS
 *
 * @param {string} fechaHoraHijo  - ISO string del slot candidato para el hijo
 * @param {string|null} fechaHoraPadre - ISO string del slot ya asignado al padre (null = sin restricción)
 */
function esTemporalmenteViable(fechaHoraHijo, fechaHoraPadre) {
    if (!fechaHoraPadre) return true;
    return new Date(fechaHoraHijo).getTime() <= new Date(fechaHoraPadre).getTime() - MIN_DESCANSO_MS;
}

// ---------------------------------------------------------------------------
// PASO 1 – Motor de backtracking top-down
// ---------------------------------------------------------------------------

/**
 * Evalúa si un slot es aceptable para un nodo dados sus dominios fusionados
 * y la restricción temporal del padre.
 *
 * @param {string}  fechaHoraSlot
 * @param {Object}  dominios          - { duras, blandas } del nodo
 * @param {string|null} fechaHoraPadre
 * @param {boolean} ignorarBlandas    - true en la segunda pasada de degradación
 * @returns {{ valido: boolean, pen: number }}
 */
function _evaluarSlotNodo(fechaHoraSlot, dominios, fechaHoraPadre, ignorarBlandas) {
    // Arc consistency
    if (!esTemporalmenteViable(fechaHoraSlot, fechaHoraPadre)) {
        return { valido: false, pen: Infinity };
    }

    // Restricciones duras
    for (const req of dominios.duras) {
        if (_violaRestriccionDura(req, fechaHoraSlot)) {
            return { valido: false, pen: Infinity };
        }
    }

    // Restricciones blandas
    const pen = ignorarBlandas ? 0 : _penalizacionBlanda(dominios.blandas, fechaHoraSlot);
    return { valido: true, pen };
}

/**
 * Función recursiva de backtracking top-down.
 *
 * Asigna slots al árbol de nodos del bracket mediante DFS en profundidad:
 * primero ancla los nodos más profundos (hojas = Ronda 1), luego sube.
 *
 * @param {Object}   nodo            - Nodo actual del bracket
 * @param {Array}    slotsDisponibles - Array de { fechaHora, pista, slotIndex }
 * @param {Set}      slotsOcupados   - Índices de slots ya asignados (mutado in-place)
 * @param {Object}   restriccionesCat
 * @param {string|null} fechaHoraPadre - Restricción temporal del padre
 * @param {boolean}  ignorarBlandas
 * @returns {boolean} true si la rama entera fue asignada con éxito
 */
function _backtrackNodo(nodo, slotsDisponibles, slotsOcupados, restriccionesCat, fechaHoraPadre, ignorarBlandas) {
    // Nodo fantasma (BYE): no necesita slot, siempre válido
    if (nodo.esBye) return true;

    // Hojas (partidos reales sin hijos pendientes): asignar slot directamente
    const dominios = fusionarRestricciones(nodo, restriccionesCat);

    // Intentar cada slot en orden cronológico
    for (let i = 0; i < slotsDisponibles.length; i++) {
        if (slotsOcupados.has(i)) continue;

        const slot = slotsDisponibles[i];
        const { valido, pen } = _evaluarSlotNodo(slot.fechaHora, dominios, fechaHoraPadre, ignorarBlandas);

        if (!valido) {
            // Poda: si ya pasamos el tiempo máximo permitido, no tiene sentido seguir
            // (los slots están ordenados cronológicamente)
            if (fechaHoraPadre && new Date(slot.fechaHora).getTime() < new Date(fechaHoraPadre).getTime() - MIN_DESCANSO_MS * 10) {
                continue; // Seguir buscando slots posteriores
            }
            continue;
        }

        // Slot provisionalmente asignado
        slotsOcupados.add(i);
        nodo.fechaHora = slot.fechaHora;
        nodo.pista = slot.pista;
        nodo.slotIndex = i;
        nodo.penalizacion = (nodo.penalizacion || 0) + pen;

        // Recursión sobre hijos (el tiempo del padre para los hijos es el slot actual)
        let hijosOk = true;
        if (nodo.hijos && nodo.hijos.length > 0) {
            for (const hijo of nodo.hijos) {
                if (!_backtrackNodo(hijo, slotsDisponibles, slotsOcupados, restriccionesCat, slot.fechaHora, ignorarBlandas)) {
                    hijosOk = false;
                    break;
                }
            }
        }

        if (hijosOk) return true;

        // Backtrack: deshacer asignación del nodo actual y de todos sus hijos
        slotsOcupados.delete(i);
        delete nodo.fechaHora;
        delete nodo.pista;
        delete nodo.slotIndex;
        delete nodo.penalizacion;
        _limpiarSubarbol(nodo.hijos, slotsOcupados);
    }

    return false; // No hay slot viable en este dominio
}

/**
 * Limpia recursivamente las asignaciones de un subárbol tras un backtrack.
 */
function _limpiarSubarbol(hijos, slotsOcupados) {
    if (!hijos) return;
    for (const hijo of hijos) {
        if (hijo.slotIndex !== undefined) {
            slotsOcupados.delete(hijo.slotIndex);
        }
        delete hijo.fechaHora;
        delete hijo.pista;
        delete hijo.slotIndex;
        delete hijo.penalizacion;
        _limpiarSubarbol(hijo.hijos, slotsOcupados);
    }
}

// ---------------------------------------------------------------------------
// Constructores de árbol de bracket
// ---------------------------------------------------------------------------

/**
 * Construye un árbol de nodos de bracket a partir de un array plano de
 * parejas (ya ordenado con BYEs) para hasta 3 rondas.
 */
function construirArbolBracket(bracketBase, esCruceProhibido) {
    const numParejas = bracketBase.length;

    // Ronda 1: nodos hoja
    const r1 = [];
    for (let i = 0; i < numParejas; i += 2) {
        const p1 = bracketBase[i];
        const p2 = bracketBase[i + 1] || { nombre: "Fantasma (BYE)", esBye: true };
        const esBye = !!(p1.esBye || p2.esBye);
        const esFantasma = !!(p1.esBye && p2.esBye);
        const prohibido = !esBye && esCruceProhibido(p1.nombre, p2.nombre);

        let ganadorConocido = null;
        if (esFantasma) {
            ganadorConocido = "Fantasma (BYE)";
        } else if (p1.esBye) {
            ganadorConocido = p2.nombre;
        } else if (p2.esBye) {
            ganadorConocido = p1.nombre;
        }

        r1.push({
            id: `R1_${i / 2}`,
            ronda: 0,
            pareja1: p1.nombre,
            pareja2: p2.nombre,
            esBye,
            esFantasma,
            ganadorConocido,
            cruceProhibido: prohibido,
            hijos: null
        });
    }

    if (r1.length <= 1) return r1; // Solo hay un partido (2 parejas)

    // Ronda 2 (Cuartos de Final)
    const r2 = [];
    for (let i = 0; i < r1.length; i += 2) {
        const hijoA = r1[i];
        const hijoB = r1[i + 1];
        if (!hijoB) { r2.push(hijoA); continue; }

        let ganadorConocido = null;
        const esFantasma = hijoA.esFantasma && hijoB.esFantasma;
        if (esFantasma) {
            ganadorConocido = "Fantasma (BYE)";
        } else if (hijoA.esFantasma) {
            ganadorConocido = hijoB.ganadorConocido;
        } else if (hijoB.esFantasma) {
            ganadorConocido = hijoA.ganadorConocido;
        }

        r2.push({
            id: `QF_${i / 2}`,
            ronda: 1,
            pareja1: hijoA.ganadorConocido,
            pareja2: hijoB.ganadorConocido,
            esBye: hijoA.esFantasma || hijoB.esFantasma,
            esFantasma,
            ganadorConocido,
            hijos: [hijoA, hijoB]
        });
    }

    if (r2.length <= 1) return r2;

    // Ronda 3 (Semifinales)
    const r3 = [];
    for (let i = 0; i < r2.length; i += 2) {
        const hijoA = r2[i];
        const hijoB = r2[i + 1];
        if (!hijoB) { r3.push(hijoA); continue; }

        let ganadorConocido = null;
        const esFantasma = hijoA.esFantasma && hijoB.esFantasma;
        if (esFantasma) {
            ganadorConocido = "Fantasma (BYE)";
        } else if (hijoA.esFantasma) {
            ganadorConocido = hijoB.ganadorConocido;
        } else if (hijoB.esFantasma) {
            ganadorConocido = hijoA.ganadorConocido;
        }

        r3.push({
            id: `SF_${i / 2}`,
            ronda: 2,
            pareja1: hijoA.ganadorConocido,
            pareja2: hijoB.ganadorConocido,
            esBye: hijoA.esFantasma || hijoB.esFantasma,
            esFantasma,
            ganadorConocido,
            hijos: [hijoA, hijoB]
        });
    }

    return r3.length > 0 ? r3 : r2;
}

/**
 * Aplana el árbol de nodos a un array plano de partidos para el cuadro
 * (solo las hojas y nodos internos con datos suficientes).
 */
function aplanarArbol(raices) {
    const resultado = [];
    const pila = [...raices];
    while (pila.length > 0) {
        const nodo = pila.pop();
        if (nodo.hijos) {
            for (const h of nodo.hijos) pila.push(h);
        }
        // Nodo hoja (Ronda 1) o nodo interno ya procesado
        const partido = {
            pareja1: nodo.pareja1 || '(ganador anterior)',
            pareja2: nodo.pareja2 || '(ganador anterior)',
            ronda: nodo.ronda,
            esBye: !!nodo.esBye,
            cruceProhibido: !!nodo.cruceProhibido
        };
        if (nodo.fechaHora) partido.fechaHora = nodo.fechaHora;
        if (nodo.pista) partido.pista = nodo.pista;
        if (nodo.penalizacion !== undefined) partido.penalizacion = nodo.penalizacion;
        if (!nodo.fechaHora && !nodo.esBye) partido.error = 'No se encontró slot viable';
        resultado.push(partido);
    }
    return resultado;
}

// ---------------------------------------------------------------------------
// PASO 4 – Relajación dinámica (Degradation) + punto de entrada público
// ---------------------------------------------------------------------------

/**
 * Motor CSP con Backtracking Top-Down para calendarización de brackets
 * eliminatorios de hasta 3 rondas.
 *
 * @param {Array}  slotsDisponibles  - [{ fechaHora: ISOString, pista: string, slotIndex: number }]
 *                                    Ya ordenados cronológicamente y con slotIndex explícito.
 * @param {Object} restriccionesJSON - { [categoria]: { [pareja]: { restricciones_duras, restricciones_blandas } } }
 * @param {Object} bracket           - { [categoria]: { parejas: Array<{nombre,esBye?}>, cabezasDeSerie?: string[] } }
 * @param {Array}  excepcionesEmparejamiento - [{ cat, p1, p2 }]
 * @param {Set}    [slotsGastadosGlobales]   - Set de índices ya consumidos por otras categorías
 * @returns {Object} { [categoria]: Array<Partido> }
 */
function generarBracketCSP(
    slotsDisponibles,
    restriccionesJSON,
    bracket,
    excepcionesEmparejamiento = [],
    slotsGastadosGlobales = new Set()
) {
    // Garantizar que los slots tienen slotIndex
    const slots = slotsDisponibles.map((s, i) => ({
        ...s,
        slotIndex: s.slotIndex !== undefined ? s.slotIndex : i
    }));

    const cuadro = {};

    for (const [nombreGrupo, datos] of Object.entries(bracket)) {
        const parejas = datos.parejas || [];
        const semillas = datos.cabezasDeSerie || [];
        const restriccionesCat = restriccionesJSON[nombreGrupo] || {};

        const excepcionesCat = excepcionesEmparejamiento.filter(e => e.cat === nombreGrupo);
        const esCruceProhibido = (p1, p2) =>
            excepcionesCat.some(e =>
                (e.p1 === p1 && e.p2 === p2) || (e.p1 === p2 && e.p2 === p1)
            );

        // Construir bracket base (mismo algoritmo de seed que el motor greedy)
        let numParejas = parejas.length;
        let potencia = 1;
        while (potencia < numParejas) potencia *= 2;

        const bracketBase = new Array(potencia).fill(null);
        let parejasRestantes = [];
        let seed1 = null, seed2 = null;

        for (const j of parejas) {
            if (semillas.length > 0 && j.nombre === semillas[0]) seed1 = j;
            else if (semillas.length > 1 && j.nombre === semillas[1]) seed2 = j;
            else parejasRestantes.push(j);
        }

        if (seed1) bracketBase[0] = seed1;
        if (seed2) bracketBase[potencia - 1] = seed2;

        const fantasmasNecesarios = potencia - numParejas;
        const ordenPrioridad = [];
        if (potencia >= 4) {
            ordenPrioridad.push(1);
            ordenPrioridad.push(potencia - 2);
        } else if (potencia === 2) {
            ordenPrioridad.push(1);
        }
        for (let i = 1; i < potencia; i += 2) {
            if (!ordenPrioridad.includes(i)) ordenPrioridad.push(i);
        }
        const posicionesAsignadas = ordenPrioridad.slice(0, fantasmasNecesarios);
        for (const pos of posicionesAsignadas) {
            bracketBase[pos] = { nombre: "Fantasma (BYE)", esBye: true };
        }

        let puntero = 0;
        for (let i = 0; i < potencia; i++) {
            if (bracketBase[i] === null) {
                bracketBase[i] = parejasRestantes[puntero] || { nombre: "Fantasma (BYE)", esBye: true };
                puntero++;
            }
        }

        // Construir árbol del bracket
        const raices = construirArbolBracket(bracketBase, esCruceProhibido);

        // Slots disponibles filtrados (excluye los ya gastados globalmente)
        const slotsLibres = slots.filter(s => !slotsGastadosGlobales.has(s.slotIndex));

        // PASO 4: Primera pasada – duras + blandas
        const slotsOcupados = new Set();
        let exito = false;

        for (const raiz of raices) {
            exito = _backtrackNodo(
                raiz, slotsLibres, slotsOcupados,
                restriccionesCat, null, false
            );
            if (!exito) break;
        }

        // PASO 4: Segunda pasada – solo duras (relajación dinámica)
        if (!exito) {
            _limpiarSubarbol(raices, slotsOcupados);
            slotsOcupados.clear();

            for (const raiz of raices) {
                exito = _backtrackNodo(
                    raiz, slotsLibres, slotsOcupados,
                    restriccionesCat, null, true
                );
                if (!exito) break;
            }
        }

        // Marcar slots consumidos como gastados globalmente
        for (const idx of slotsOcupados) {
            slotsGastadosGlobales.add(idx);
        }

        cuadro[nombreGrupo] = aplanarArbol(raices);
    }

    return cuadro;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        evaluarPartidoUnico,
        generarPrimeraRonda,
        construirPromptAnalisisTodas,
        callOpenAI,
        // CSP Backtracking Engine
        generarBracketCSP,
        fusionarRestricciones,
        esTemporalmenteViable,
        construirArbolBracket,
        aplanarArbol
    };
}