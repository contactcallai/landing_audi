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
const isNode = typeof require !== 'undefined' && typeof window === 'undefined';

if (isNode) {
    fs = require('fs');
    path = require('path');
    crypto = require('crypto');

    // Inicializamos el objeto global explícitamente
    if (typeof global.restriccionesCache === 'undefined') {
        global.restriccionesCache = {};
    }

    const CACHE_FILE = path.join(__dirname, 'ia_cache_restricciones.json');

    // 1. Cargar caché desde el disco al arrancar el servidor
    if (fs.existsSync(CACHE_FILE)) {
        try {
            const rawData = fs.readFileSync(CACHE_FILE, 'utf8');
            global.restriccionesCache = JSON.parse(rawData);
            console.log(`[Caché IA] Cargadas ${Object.keys(global.restriccionesCache).length} configuraciones desde el disco.`);
        } catch (e) {
            console.error("Error leyendo archivo de caché:", e);
        }
    }

    // 2. Exponemos la función de guardado
    global.guardarCacheIA = function () {
        try {
            fs.writeFileSync(CACHE_FILE, JSON.stringify(global.restriccionesCache, null, 2), 'utf8');
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
        const afectaDia = (
            req.dia === "TODOS" ||
            req.dia === diaSemanaTexto ||
            req.dia === `${diaSemanaTexto}_MANANA` ||
            req.dia === `${diaSemanaTexto}_TARDE` ||
            req.dia === fechaPartido.getDate() // <--- Soporte para días numéricos del mes
        );

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
            const afectaDia = (
                req.dia === "TODOS" ||
                req.dia === diaSemanaTexto ||
                req.dia === `${diaSemanaTexto}_MANANA` ||
                req.dia === `${diaSemanaTexto}_TARDE` ||
                req.dia === fechaPartido.getDate() // <--- Soporte para días numéricos del mes
            );
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

async function generarPrimeraRonda(horariosPorPista, inscripciones, cabezasDeSerie = {}, apiKey, formatos = {}, intentos = 10000, excepcionesEmparejamiento = []) {
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

        // USAMOS EXPLÍCITAMENTE global.restriccionesCache
        if (global.restriccionesCache[promptHash]) {
            console.log("\n=== ⚡ USANDO CACHÉ PERSISTENTE: Restricciones recuperadas del disco ===");
            restriccionesJSON = global.restriccionesCache[promptHash];
        } else {
            restriccionesJSON = await callOpenAI(prompt, apiKey);

            if (Object.keys(restriccionesJSON).length > 0) {
                global.restriccionesCache[promptHash] = restriccionesJSON;
                global.guardarCacheIA(); // Escribir en el disco inmediatamente
            }

            console.log("\n=== 🤖 RESTRICCIONES DETECTADAS POR LA IA ===");
            console.log(JSON.stringify(restriccionesJSON, null, 2));
            console.log("==========================================\n");
        }
    } else {
        // Fallback
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
                slotsGastadosGlobales,
                intentos
            );

            mejorCuadroGrupo = resultadoCSP[nombreGrupo];

        } else if (formato === 'groups') {
            // --- LÓGICA DE FASE DE GRUPOS (Round Robin) CON ESPACIADO INTELIGENTE ---
            let todosLosPartidos = [];
            for (let i = 0; i < parejas.length; i++) {
                for (let j = i + 1; j < parejas.length; j++) {
                    if (!esCruceProhibido(parejas[i].nombre, parejas[j].nombre)) {
                        todosLosPartidos.push({ pareja1: parejas[i], pareja2: parejas[j], esBye: false });
                    }
                }
            }

            let actual_orden_partidos = [...todosLosPartidos];

            // --- NUEVO: Extraer contexto temporal y acotar días para la fase de grupos ---
            const diasTorneoGrupos = [...new Set(slotsDisponibles.map(s => s.fechaHora.split('T')[0]))].sort();
            let diaLimiteGrupos = diasTorneoGrupos[diasTorneoGrupos.length - 1]; // Por defecto, todo el torneo

            // Truncamiento de dominio: Amputamos los últimos 3 días (Final y Semis)
            if (diasTorneoGrupos.length >= 4) {
                diaLimiteGrupos = diasTorneoGrupos[diasTorneoGrupos.length - 4];
            } else if (diasTorneoGrupos.length === 3) {
                diaLimiteGrupos = diasTorneoGrupos[diasTorneoGrupos.length - 2];
            }

            // Calculamos el inicio y fin basados SOLO en la ventana de grupos permitida
            const slotsValidosGrupos = slotsDisponibles.filter(s => s.fechaHora.split('T')[0] <= diaLimiteGrupos);
            const startMs = slotsValidosGrupos.length > 0 ? new Date(slotsValidosGrupos[0].fechaHora).getTime() : 0;
            const endMs = slotsValidosGrupos.length > 0 ? new Date(slotsValidosGrupos[slotsValidosGrupos.length - 1].fechaHora).getTime() : 0;

            let totalPartidosEquipos = {};
            parejas.forEach(p => totalPartidosEquipos[p.nombre] = 0);
            todosLosPartidos.forEach(p => {
                totalPartidosEquipos[p.pareja1.nombre]++;
                totalPartidosEquipos[p.pareja2.nombre]++;
            });
            // ------------------------------------------------------------------------------

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

                let bloqueosDiasEquipos = {};
                parejas.forEach(p => bloqueosDiasEquipos[p.nombre] = new Set());

                let partidosAsignados = {};
                parejas.forEach(p => partidosAsignados[p.nombre] = 0);

                for (const matchBase of intento_orden) {
                    const partido = { pareja1: matchBase.pareja1.nombre, pareja2: matchBase.pareja2.nombre, esBye: false };

                    let mejorSlot = null;
                    let mejorScoreSlot = { imp: Infinity, pen: Infinity };
                    let indiceMejorSlot = -1;

                    let ratioA = partidosAsignados[partido.pareja1] / Math.max(1, totalPartidosEquipos[partido.pareja1] - 1);
                    let ratioB = partidosAsignados[partido.pareja2] / Math.max(1, totalPartidosEquipos[partido.pareja2] - 1);

                    let ratioPromedio = (ratioA + ratioB) / 2;
                    let idealMs = startMs + (endMs - startMs) * ratioPromedio;

                    for (let s = 0; s < slotsDisponibles.length; s++) {
                        if (slotsGastadosGlobales.has(s) || slotsUsadosVirtualmente.has(s)) continue;

                        const slot = slotsDisponibles[s];
                        const diaSlot = slot.fechaHora.split('T')[0];

                        // --- CORTAFUEGOS: Restricción absoluta del dominio temporal ---
                        if (diaSlot > diaLimiteGrupos) continue;
                        // --------------------------------------------------------------

                        if (bloqueosDiasEquipos[partido.pareja1].has(diaSlot) ||
                            bloqueosDiasEquipos[partido.pareja2].has(diaSlot)) {
                            continue;
                        }

                        const scoreSlot = evaluarPartidoUnico(partido.pareja1, partido.pareja2, slot.fechaHora, restriccionesCat);

                        let penaltyEspaciado = 0;
                        if (startMs !== endMs) {
                            const slotMs = new Date(slot.fechaHora).getTime();
                            const diffDias = Math.abs(slotMs - idealMs) / (1000 * 60 * 60 * 24);
                            penaltyEspaciado = diffDias * 3;
                        }

                        const totalPen = scoreSlot.pen + penaltyEspaciado;

                        if (scoreSlot.imp < mejorScoreSlot.imp || (scoreSlot.imp === mejorScoreSlot.imp && totalPen < mejorScoreSlot.pen)) {
                            mejorScoreSlot = { imp: scoreSlot.imp, pen: totalPen, penOriginal: scoreSlot.pen };
                            mejorSlot = slot;
                            indiceMejorSlot = s;
                        }
                    }

                    if (mejorSlot && mejorScoreSlot.imp === 0) {
                        partido.fechaHora = mejorSlot.fechaHora;
                        partido.pista = mejorSlot.pista;
                        partido.slotIndex = indiceMejorSlot;

                        const diaAsignado = mejorSlot.fechaHora.split('T')[0];
                        bloqueosDiasEquipos[partido.pareja1].add(diaAsignado);
                        bloqueosDiasEquipos[partido.pareja2].add(diaAsignado);

                        slotsUsadosVirtualmente.add(indiceMejorSlot);

                        partidosAsignados[partido.pareja1]++;
                        partidosAsignados[partido.pareja2]++;
                        scoreIntento.pen += mejorScoreSlot.pen;
                    } else {
                        partido.error = `Conflicto insalvable entre ${partido.pareja1} y ${partido.pareja2} o falta de pistas.`;
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
                {"tipo": "hora_maxima", "dia": "TODOS | LUNES | MARTES | MIERCOLES | JUEVES | VIERNES | SABADO | DOMINGO | <numero_dia>", "hora": "HH:MM", "razon": "explicación"},
                {"tipo": "hora_minima", "dia": "TODOS | LUNES | MARTES | MIERCOLES | JUEVES | VIERNES | SABADO | DOMINGO | <numero_dia>", "hora": "HH:MM", "razon": "explicación"},
                {"tipo": "hora_exacta", "dia": "DIA_ESPECIFICO", "hora": "HH:MM", "razon": "explicación"},
                {"tipo": "dia_excluido", "dia": "DIA_ESPECIFICO", "razon": "explicación"},
                {"tipo": "rango_fechas", "desde": "DIA", "hasta": "DIA", "razon": "explicación"}
            ],
            "restricciones_blandas": [
                {"tipo": "hora_maxima", "dia": "TODOS | LUNES | MARTES | MIERCOLES | JUEVES | VIERNES | SABADO | DOMINGO | <numero_dia>", "hora": "HH:MM", "peso": 1-10, "razon": "explicación"},
                {"tipo": "hora_minima", "dia": "TODOS | LUNES | MARTES | MIERCOLES | JUEVES | VIERNES | SABADO | DOMINGO | <numero_dia>", "hora": "HH:MM", "peso": 1-10, "razon": "explicación"},
                {"tipo": "hora_exacta", "dia": "DIA_ESPECIFICO", "hora": "HH:MM", "peso": 1-10, "razon": "explicación"},
                {"tipo": "preferencia_temprano", "dia": "TODOS | LUNES | MARTES | MIERCOLES | JUEVES | VIERNES | SABADO | DOMINGO | <numero_dia>", "peso": 1-10, "razon": "explicación"},
                {"tipo": "preferencia_tarde", "dia": "TODOS | LUNES | MARTES | MIERCOLES | JUEVES | VIERNES | SABADO | DOMINGO | <numero_dia>", "peso": 1-10, "razon": "explicación"},
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
        - El campo "dia" DEBE ser estrictamente uno de estos strings: "TODOS", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO".
        - EXCEPCIÓN NUMÉRICA: Si el jugador especifica un día del mes concreto (ej. "Días 2 y 3" o "el día 15"), el campo "dia" DEBE ser un NÚMERO ENTERO (ej. 2, 3, 15). NUNCA generes strings inventados como "DIA_2" o "FIN_DE_SEMANA".

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
        req.dia === `${diaSemana}_TARDE` ||
        req.dia === diaNum
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

function _penalizacionBlanda(restriccionesBlandas, fechaHoraString) {
    const fecha = new Date(fechaHoraString);
    const mapaDias = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
    const diaSemana = mapaDias[fecha.getDay()];
    const horaTexto = fecha.toTimeString().substring(0, 5);
    const diaNum = fecha.getDate();
    let pen = 0;

    for (const req of restriccionesBlandas) {
        const afectaDia = (
            req.dia === "TODOS" ||
            req.dia === diaSemana ||
            req.dia === `${diaSemana}_MANANA` ||
            req.dia === `${diaSemana}_TARDE` ||
            req.dia === diaNum
        );
        const peso = req.peso || 5;
        if (req.tipo === "hora_minima" && afectaDia && horaTexto < req.hora) pen += peso;
        if (req.tipo === "hora_maxima" && afectaDia && horaTexto > req.hora) pen += peso;
        if (req.tipo === "hora_exacta" && afectaDia && horaTexto !== req.hora) pen += peso;
        if (req.tipo === "preferencia_tarde" && afectaDia && horaTexto < "16:00") pen += peso;
        if (req.tipo === "preferencia_temprano" && afectaDia && horaTexto >= "16:00") pen += peso;
        if (req.tipo === "dia_evitar" && (req.dia === diaSemana || req.dia === diaNum)) pen += peso;
        if (req.tipo === "dia_preferido" && req.dia !== "TODOS" && req.dia !== diaSemana && req.dia !== diaNum) pen += peso;
    }
    return pen;
}

// ---------------------------------------------------------------------------
// PASO 2 – Fusión de dominios (Domain Intersection)
// ---------------------------------------------------------------------------

function fusionarRestricciones(nodo, restriccionesCat) {
    const duras = [];
    const blandas = [];

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

function esTemporalmenteViable(fechaHoraHijo, fechaHoraPadre) {
    if (!fechaHoraPadre) return true;

    // Cronología básica: el hijo debe jugarse antes que el padre
    if (new Date(fechaHoraHijo).getTime() > new Date(fechaHoraPadre).getTime() - MIN_DESCANSO_MS) return false;

    // Máximo 1 partido por día por pareja: hijo y padre no pueden ser el mismo día natural
    const strDiaHijo = fechaHoraHijo.split('T')[0];
    const strDiaPadre = fechaHoraPadre.split('T')[0];
    if (strDiaHijo === strDiaPadre) return false;

    return true;
}

// ---------------------------------------------------------------------------
// PASO 1 – Motor de backtracking top-down con Espaciado Inteligente
// ---------------------------------------------------------------------------

function _evaluarSlotNodo(nodo, fechaHoraSlot, dominios, fechaHoraPadre, ignorarBlandas, diasValidosSemis) {
    // --- CORTAFUEGOS DE SEMIFINALES ---
    if (nodo.isSemifinal) {
        const diaSlot = fechaHoraSlot.split('T')[0];
        if (!diasValidosSemis.has(diaSlot)) {
            return { valido: false, pen: Infinity };
        }
    }

    if (!esTemporalmenteViable(fechaHoraSlot, fechaHoraPadre)) {
        return { valido: false, pen: Infinity };
    }

    for (const req of dominios.duras) {
        if (_violaRestriccionDura(req, fechaHoraSlot)) {
            return { valido: false, pen: Infinity };
        }
    }

    let pen = ignorarBlandas ? 0 : _penalizacionBlanda(dominios.blandas, fechaHoraSlot);

    // --- NUEVO: GRAVEDAD CRONOLÓGICA (Degradación Lineal) ---
    // Penar suavemente los horarios cuanto más se alejen de la hora límite exigida
    const fechaSlot = new Date(fechaHoraSlot);
    const mapaDias = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
    const diaSemana = mapaDias[fechaSlot.getDay()];
    const diaNum = fechaSlot.getDate();
    const slotMinutosTotal = (fechaSlot.getHours() * 60) + fechaSlot.getMinutes();

    // Evaluamos tanto las restricciones duras como las blandas de ambos jugadores
    for (const req of [...dominios.duras, ...dominios.blandas]) {
        if (req.tipo === "hora_minima" || req.tipo === "hora_maxima") {
            const afectaDia = (
                req.dia === "TODOS" || req.dia === diaSemana ||
                req.dia === `${diaSemana}_MANANA` || req.dia === `${diaSemana}_TARDE` ||
                req.dia === diaNum
            );

            if (afectaDia) {
                const [reqH, reqM] = req.hora.split(':').map(Number);
                const reqMinutosTotal = (reqH * 60) + reqM;

                // Calculamos la distancia real en minutos
                const diffMinutos = Math.abs(slotMinutosTotal - reqMinutosTotal);

                // Aplicamos 1 punto de penalización por cada 30 minutos de desvío
                pen += (diffMinutos / 30) * 1;
            }
        }
    }
    // --------------------------------------------------------

    return { valido: true, pen };
}

function _backtrackNodo(nodo, slotsDisponibles, slotsOcupados, restriccionesCat, fechaHoraPadre, ignorarBlandas, diasValidosSemis, contextoTorneo) {
    if (nodo.esBye) return true;

    const dominios = fusionarRestricciones(nodo, restriccionesCat);
    const candidatos = [];

    // Evaluar slots y calcular su desviación respecto a la "fecha ideal" (Espaciado Inteligente)
    for (let i = 0; i < slotsDisponibles.length; i++) {
        const slot = slotsDisponibles[i];
        if (slotsOcupados.has(slot.slotIndex)) continue;

        const { valido, pen } = _evaluarSlotNodo(nodo, slot.fechaHora, dominios, fechaHoraPadre, ignorarBlandas, diasValidosSemis);
        if (!valido) continue;

        let penaltyEspaciado = 0;
        if (contextoTorneo && contextoTorneo.rondasTotal > 1) {
            // --- CORRECCIÓN DE DEBUT ---
            // Si el partido es el primero real para ellos, usamos ronda 0 para el cálculo
            const rondaEfectiva = nodo.isDebut ? 0 : nodo.ronda;

            const ratio = rondaEfectiva / (contextoTorneo.rondasTotal - 1);
            const idealMs = contextoTorneo.startMs + (contextoTorneo.endMs - contextoTorneo.startMs) * ratio;
            // ---------------------------

            const slotMs = new Date(slot.fechaHora).getTime();
            const diffDias = Math.abs(slotMs - idealMs) / (1000 * 60 * 60 * 24);
            penaltyEspaciado = diffDias * 3;
        }

        candidatos.push({
            slot: slot,
            penTotal: pen + penaltyEspaciado,
            penOriginal: pen
        });
    }

    // Ordenar de mejor a peor: El DFS probará primero los huecos más óptimos
    candidatos.sort((a, b) => {
        if (a.penTotal !== b.penTotal) return a.penTotal - b.penTotal;
        if (nodo.ronda > 0) return b.slot.slotIndex - a.slot.slotIndex;
        return a.slot.slotIndex - b.slot.slotIndex;
    });

    for (const candidato of candidatos) {
        const slot = candidato.slot;

        slotsOcupados.add(slot.slotIndex);
        nodo.fechaHora = slot.fechaHora;
        nodo.pista = slot.pista;
        nodo.slotIndex = slot.slotIndex;
        nodo.penalizacion = (nodo.penalizacion || 0) + candidato.penOriginal;

        let hijosOk = true;
        if (nodo.hijos && nodo.hijos.length > 0) {
            for (const hijo of nodo.hijos) {
                if (!_backtrackNodo(hijo, slotsDisponibles, slotsOcupados, restriccionesCat, slot.fechaHora, ignorarBlandas, diasValidosSemis, contextoTorneo)) {
                    hijosOk = false;
                    break;
                }
            }
        }

        if (hijosOk) return true;

        slotsOcupados.delete(slot.slotIndex);
        delete nodo.fechaHora;
        delete nodo.pista;
        delete nodo.slotIndex;
        delete nodo.penalizacion;
        _limpiarSubarbol(nodo.hijos, slotsOcupados);
    }

    return false;
}

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
// Constructores de árbol de bracket (Dinámico: Omite la final automáticamente)
// ---------------------------------------------------------------------------

function construirArbolBracket(bracketBase, esCruceProhibido) {
    const numParejas = bracketBase.length;

    let rondaActual = [];
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

        // --- NUEVO: Rastrear potenciales rivales para proteger el "primer partido" ---
        const potenciales = [];
        if (!p1.esBye) potenciales.push(p1.nombre);
        if (!p2.esBye) potenciales.push(p2.nombre);

        // Si una pareja avanza por BYE, sigue siendo "virgen" (no ha jugado su 1r partido)
        let virgenes = [];
        if (!esFantasma) {
            if (p1.esBye) virgenes.push(p2.nombre);
            else if (p2.esBye) virgenes.push(p1.nombre);
        }
        // -----------------------------------------------------------------------------

        rondaActual.push({
            ronda: 0,
            pareja1: p1.nombre,
            pareja2: p2.nombre,
            esBye,
            esFantasma,
            ganadorConocido,
            cruceProhibido: prohibido,
            potenciales: potenciales,
            virgenes: virgenes,
            hijos: null
        });
    }

    const rondas = [rondaActual];
    let numRonda = 1;

    while (rondaActual.length > 1) {
        const siguienteRonda = [];
        for (let i = 0; i < rondaActual.length; i += 2) {
            const hijoA = rondaActual[i];
            const hijoB = rondaActual[i + 1];

            if (!hijoB) {
                siguienteRonda.push(hijoA);
                continue;
            }

            let ganadorConocido = null;
            const esFantasma = hijoA.esFantasma && hijoB.esFantasma;
            const esBye = hijoA.esFantasma || hijoB.esFantasma;

            if (esFantasma) {
                ganadorConocido = "Fantasma (BYE)";
            } else if (hijoA.esFantasma) {
                ganadorConocido = hijoB.ganadorConocido;
            } else if (hijoB.esFantasma) {
                ganadorConocido = hijoA.ganadorConocido;
            }

            // --- NUEVO: Cortafuegos Profundo de "Primer Partido Real" ---
            let prohibido = false;
            // Si alguien de A aún no ha jugado, no puede cruzarse con ningún potencial de B
            for (const vA of hijoA.virgenes) {
                for (const pB of hijoB.potenciales) {
                    if (esCruceProhibido(vA, pB)) prohibido = true;
                }
            }
            // Si alguien de B aún no ha jugado, no puede cruzarse con ningún potencial de A
            for (const vB of hijoB.virgenes) {
                for (const pA of hijoA.potenciales) {
                    if (esCruceProhibido(vB, pA)) prohibido = true;
                }
            }

            // Propagar las parejas que podrían llegar a la siguiente ronda
            const potenciales = [...hijoA.potenciales, ...hijoB.potenciales];
            let virgenes = [];
            // Solo siguen siendo "vírgenes" si avanzan frente a un fantasma en esta ronda
            if (hijoA.esFantasma) virgenes = [...hijoB.virgenes];
            else if (hijoB.esFantasma) virgenes = [...hijoA.virgenes];
            // -------------------------------------------------------------

            const esDebutA = hijoA.ronda === 0 || hijoA.esBye;
            const esDebutB = hijoB.ronda === 0 || hijoB.esBye;

            siguienteRonda.push({
                ronda: numRonda,
                pareja1: hijoA.ganadorConocido,
                pareja2: hijoB.ganadorConocido,
                esBye,
                esFantasma,
                ganadorConocido,
                isDebut: esDebutA && esDebutB, // Ambos debutan aquí
                hijos: [hijoA, hijoB]
            });
        }
        rondas.push(siguienteRonda);
        rondaActual = siguienteRonda;
        numRonda++;
    }

    // ELIMINAR LA FINAL: Devolvemos directamente las Semifinales
    if (rondas.length >= 2) {
        const semis = rondas[rondas.length - 2];
        semis.forEach(s => s.isSemifinal = true);
        return semis;
    } else {
        return [];
    }
}

function aplanarArbol(raices) {
    const resultado = [];
    const pila = [...raices];
    while (pila.length > 0) {
        const nodo = pila.pop();
        if (nodo.hijos) {
            for (const h of nodo.hijos) pila.push(h);
        }
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
// PUNTO DE ENTRADA PÚBLICO
// ---------------------------------------------------------------------------

function generarBracketCSP(
    slotsDisponibles,
    restriccionesJSON,
    bracket,
    excepcionesEmparejamiento = [],
    slotsGastadosGlobales = new Set(),
    intentosMax = 1000
) {
    const slots = slotsDisponibles.map((s, i) => ({
        ...s,
        slotIndex: s.slotIndex !== undefined ? s.slotIndex : i
    }));

    // --- Extraer días válidos para las Semifinales dinámicamente ---
    const diasTorneo = [...new Set(slots.map(s => s.fechaHora.split('T')[0]))].sort();
    const diasValidosSemis = new Set();

    // Ampliamos la ventana a los 3 últimos días útiles para evitar bloqueos por restricciones duras
    if (diasTorneo.length >= 4) {
        diasValidosSemis.add(diasTorneo[diasTorneo.length - 2]); // Penúltimo (Ej. Sábado)
        diasValidosSemis.add(diasTorneo[diasTorneo.length - 3]); // Antepenúltimo (Ej. Viernes)
        diasValidosSemis.add(diasTorneo[diasTorneo.length - 4]); // Válvula de escape (Ej. Jueves / Día 7)
    } else if (diasTorneo.length === 3) {
        diasValidosSemis.add(diasTorneo[diasTorneo.length - 2]);
        diasValidosSemis.add(diasTorneo[diasTorneo.length - 3]);
    } else {
        diasTorneo.forEach(d => diasValidosSemis.add(d));
    }
    // ---------------------------------------------------------------

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

        let numParejas = parejas.length;
        let potencia = 1;
        while (potencia < numParejas) potencia *= 2;

        const bracketBaseInmutable = new Array(potencia).fill(null);
        let parejasRestantes = [];
        let seed1 = null, seed2 = null;

        for (const j of parejas) {
            if (semillas.length > 0 && j.nombre === semillas[0]) seed1 = j;
            else if (semillas.length > 1 && j.nombre === semillas[1]) seed2 = j;
            else parejasRestantes.push(j);
        }

        if (seed1) bracketBaseInmutable[0] = seed1;
        if (seed2) bracketBaseInmutable[potencia - 1] = seed2;

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
            bracketBaseInmutable[pos] = { nombre: "Fantasma (BYE)", esBye: true };
        }

        let mejorCuadroCat = null;
        let actual_orden = [...parejasRestantes];

        for (let intento = 0; intento < intentosMax; intento++) {
            let intento_orden = [...actual_orden];
            if (intento > 0) {
                const idx1 = Math.floor(Math.random() * intento_orden.length);
                const idx2 = Math.floor(Math.random() * intento_orden.length);
                [intento_orden[idx1], intento_orden[idx2]] = [intento_orden[idx2], intento_orden[idx1]];
            }

            let bracketIntento = [...bracketBaseInmutable];
            let puntero = 0;
            for (let i = 0; i < potencia; i++) {
                if (bracketIntento[i] === null) {
                    bracketIntento[i] = intento_orden[puntero] || { nombre: "Fantasma (BYE)", esBye: true };
                    puntero++;
                }
            }

            const raices = construirArbolBracket(bracketIntento, esCruceProhibido);

            const cuadroPlanoInicial = aplanarArbol(raices);
            const tieneCruceProhibido = cuadroPlanoInicial.some(p => p.cruceProhibido);
            if (tieneCruceProhibido) {
                actual_orden = intento_orden;
                continue;
            }

            const slotsLibres = slots.filter(s => !slotsGastadosGlobales.has(s.slotIndex));
            const slotsOcupados = new Set();
            let exito = false;

            // --- Contexto para la distribución espaciada ---
            const startMs = slots.length > 0 ? new Date(slots[0].fechaHora).getTime() : 0;
            const endMs = slots.length > 0 ? new Date(slots[slots.length - 1].fechaHora).getTime() : 0;
            const maxRonda = raices.length > 0 ? raices[0].ronda : 0;
            const contextoTorneo = { startMs, endMs, rondasTotal: maxRonda + 1 };
            // -----------------------------------------------

            for (const raiz of raices) {
                exito = _backtrackNodo(raiz, slotsLibres, slotsOcupados, restriccionesCat, null, false, diasValidosSemis, contextoTorneo);
                if (!exito) break;
            }

            if (!exito) {
                _limpiarSubarbol(raices, slotsOcupados);
                slotsOcupados.clear();
                for (const raiz of raices) {
                    exito = _backtrackNodo(raiz, slotsLibres, slotsOcupados, restriccionesCat, null, true, diasValidosSemis, contextoTorneo);
                    if (!exito) break;
                }
            }

            if (exito) {
                for (const idx of slotsOcupados) slotsGastadosGlobales.add(idx);

                // LA SOLUCIÓN DEL EFECTO FOTO: Ahora capturamos el cuadro DESPUÉS de que se hayan asignado las fechas
                mejorCuadroCat = aplanarArbol(raices);
                break;
            }

            actual_orden = intento_orden;
        }

        if (!mejorCuadroCat) {
            let bracketIntento = [...bracketBaseInmutable];
            let p = 0;
            for (let i = 0; i < potencia; i++) {
                if (bracketIntento[i] === null) {
                    bracketIntento[i] = actual_orden[p++] || { nombre: "Fantasma (BYE)", esBye: true };
                }
            }
            const raicesFallback = construirArbolBracket(bracketIntento, esCruceProhibido);
            mejorCuadroCat = aplanarArbol(raicesFallback);
        }

        cuadro[nombreGrupo] = mejorCuadroCat;
    }

    return cuadro;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        evaluarPartidoUnico,
        generarPrimeraRonda,
        construirPromptAnalisisTodas,
        callOpenAI,
        generarBracketCSP,
        fusionarRestricciones,
        esTemporalmenteViable,
        construirArbolBracket,
        aplanarArbol
    };
}