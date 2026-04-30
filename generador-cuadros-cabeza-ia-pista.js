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

async function generarPrimeraRonda(horariosPorPista, inscripciones, cabezasDeSerie = {}, apiKey, formatos = {}, intentos = 1000) {
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
    const restriccionesJSON = await callOpenAI(prompt, apiKey);

    // Auditoría en terminal de la respuesta de la IA
    console.log("\n=== RESTRICCIONES DETECTADAS POR LA IA ===");
    console.log(JSON.stringify(restriccionesJSON, null, 2));
    console.log("==========================================\n");

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

        let mejorCuadroGrupo = null;
        let mejorScoreGlobal = { imp: Infinity, pen: Infinity };
        let estancamiento = 0;

        if (formato === 'bracket') {
            // --- LÓGICA DE BRACKET ELIMINATORIO ---
            let numParejas = parejas.length;
            let potencia = 1;
            while (potencia < numParejas) potencia *= 2;

            const bracketBase = new Array(potencia).fill(null);
            const semillas = cabezasDeSerie[nombreGrupo] || [];
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
            for (let pos of posicionesAsignadas) {
                bracketBase[pos] = { nombre: "Fantasma (BYE)", esBye: true };
            }

            let actual_orden = [...parejasRestantes];

            for (let intento = 0; intento < intentos; intento++) {
                let intento_orden = [...actual_orden];
                if (intento > 0) {
                    const idx1 = Math.floor(Math.random() * intento_orden.length);
                    const idx2 = Math.floor(Math.random() * intento_orden.length);
                    [intento_orden[idx1], intento_orden[idx2]] = [intento_orden[idx2], intento_orden[idx1]];
                }

                let bracketIntento = [...bracketBase];
                let puntero = 0;
                for (let i = 0; i < potencia; i++) {
                    if (bracketIntento[i] === null) {
                        bracketIntento[i] = intento_orden[puntero] || { nombre: "Fantasma (BYE)", esBye: true };
                        puntero++;
                    }
                }

                const partidosIntento = [];
                let slotsUsadosVirtualmente = new Set();
                let scoreIntento = { imp: 0, pen: 0 };

                for (let i = 0; i < bracketIntento.length; i += 2) {
                    const j1 = bracketIntento[i] || { nombre: "Fantasma (BYE)", esBye: true };
                    const j2 = bracketIntento[i + 1] || { nombre: "Fantasma (BYE)", esBye: true };
                    const esBye = j1.esBye || j2.esBye;
                    const partido = { pareja1: j1.nombre, pareja2: j2.nombre, esBye };

                    if (!esBye) {
                        let mejorSlot = null;
                        let mejorScoreSlot = { imp: Infinity, pen: Infinity };
                        let indiceMejorSlot = -1;

                        for (let s = 0; s < slotsDisponibles.length; s++) {
                            if (slotsGastadosGlobales.has(s) || slotsUsadosVirtualmente.has(s)) continue;

                            const slot = slotsDisponibles[s];
                            const scoreSlot = evaluarPartidoUnico(j1.nombre, j2.nombre, slot.fechaHora, restriccionesCat);

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
                            scoreIntento.imp += mejorScoreSlot.imp;
                            scoreIntento.pen += mejorScoreSlot.pen;
                        } else {
                            partido.error = "No hay horarios disponibles.";
                            scoreIntento.imp += 1000;
                        }
                    }
                    partidosIntento.push(partido);
                }

                let esMejor = (scoreIntento.imp < mejorScoreGlobal.imp) || (scoreIntento.imp === mejorScoreGlobal.imp && scoreIntento.pen < mejorScoreGlobal.pen);
                if (esMejor || intento === 0) {
                    mejorScoreGlobal = scoreIntento;
                    mejorCuadroGrupo = partidosIntento;
                    actual_orden = intento_orden;
                    estancamiento = 0;
                    if (scoreIntento.imp === 0 && scoreIntento.pen === 0) break;
                } else {
                    estancamiento++;
                }

                if (estancamiento > 50) {
                    actual_orden.sort(() => Math.random() - 0.5);
                    estancamiento = 0;
                }
            }

        } else if (formato === 'groups') {
            // --- LÓGICA DE FASE DE GRUPOS (Round Robin) ---
            let todosLosPartidos = [];
            for (let i = 0; i < parejas.length; i++) {
                for (let j = i + 1; j < parejas.length; j++) {
                    todosLosPartidos.push({ pareja1: parejas[i], pareja2: parejas[j], esBye: false });
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

                // Mapeo estricto para evitar que un equipo juegue dos veces a la misma hora
                let bloqueosHorariosEquipos = {};
                parejas.forEach(p => bloqueosHorariosEquipos[p.nombre] = new Set());

                for (const matchBase of intento_orden) {
                    const partido = { pareja1: matchBase.pareja1.nombre, pareja2: matchBase.pareja2.nombre, esBye: false };

                    let mejorSlot = null;
                    let mejorScoreSlot = { imp: Infinity, pen: Infinity };
                    let indiceMejorSlot = -1;

                    for (let s = 0; s < slotsDisponibles.length; s++) {
                        if (slotsGastadosGlobales.has(s) || slotsUsadosVirtualmente.has(s)) continue;

                        const slot = slotsDisponibles[s];

                        // Control de colisión temporal
                        if (bloqueosHorariosEquipos[partido.pareja1].has(slot.fechaHora) ||
                            bloqueosHorariosEquipos[partido.pareja2].has(slot.fechaHora)) {
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
                        bloqueosHorariosEquipos[partido.pareja1].add(mejorSlot.fechaHora);
                        bloqueosHorariosEquipos[partido.pareja2].add(mejorSlot.fechaHora);

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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        evaluarPartidoUnico,
        generarPrimeraRonda,
        construirPromptAnalisisTodas,
        callOpenAI
    };
}