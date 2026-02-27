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

    // 1. Duras
    let posible = true;
    for (const req of todasDuras) {
        // Miramos si la restricción le afecta hoy
        const afectaDia = (req.dia === "TODOS" || req.dia === diaSemanaTexto || req.dia === `${diaSemanaTexto}_MANANA` || req.dia === `${diaSemanaTexto}_TARDE`);

        if (afectaDia) {
            if (req.tipo === "hora_minima" && horaPartidoTexto < req.hora) posible = false;
            if (req.tipo === "hora_maxima" && horaPartidoTexto > req.hora) posible = false;
            if (req.tipo === "dia_excluido") posible = false;
        }
    }

    if (!posible) {
        imp++;
        pen += 1000;
    } else {
        // 2. Blandas
        for (const req of todasBlandas) {
            const afectaDia = (req.dia === "TODOS" || req.dia === diaSemanaTexto);
            if (afectaDia) {
                if (req.tipo === "hora_minima" && horaPartidoTexto < req.hora) pen += (req.peso || 5);
                if (req.tipo === "hora_maxima" && horaPartidoTexto > req.hora) pen += (req.peso || 5);
                if (req.tipo === "dia_evitar") pen += (req.peso || 5);
                if (req.tipo === "preferencia_tarde" && horaPartidoTexto < "16:00") pen += (req.peso || 5);
            }
        }
    }

    return { imp, pen };
}

async function generarPrimeraRonda(horariosPorPista, inscripciones, cabezasDeSerie = {}, apiKey, intentos = 1000) {
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
    // console.log(JSON.stringify(restriccionesJSON, null, 2));

    // === EL NUEVO BUCLE DE PISTAS ===
    const slotsDisponibles = [];
    for (const datosPista of horariosPorPista) {
        for (const hora of datosPista.horarios) {
            slotsDisponibles.push({
                fechaHora: hora,
                pista: datosPista.pista // Ahora guarda el nombre o ID exacto de la pista
            });
        }
    }

    // Usaremos un Set global para ir tachando los slots que ya se han gastado en otros grupos
    const slotsGastadosGlobales = new Set();
    const cuadroTorneo = {};

    for (const [nombreGrupo, parejas] of Object.entries(grupos)) {
        let numParejas = parejas.length;
        let potencia = 1;
        while (potencia < numParejas) potencia *= 2;

        const bracketBase = new Array(potencia).fill(null);
        const semillas = cabezasDeSerie[nombreGrupo] || [];
        const restriccionesCat = restriccionesJSON[nombreGrupo] || {};

        let parejasRestantes = [];
        let seed1 = null, seed2 = null;

        for (const j of parejas) {
            if (semillas.length > 0 && j.nombre === semillas[0]) seed1 = j;
            else if (semillas.length > 1 && j.nombre === semillas[1]) seed2 = j;
            else parejasRestantes.push(j);
        }

        if (seed1) bracketBase[0] = seed1;
        if (seed2) bracketBase[potencia - 1] = seed2;

        // Para evitar huecos vacíos que Javascript lee de array(potencia)
        let bracketIntentoReal = [];

        const fantasmasNecesarios = potencia - numParejas;
        let posicionesFantasmas = new Set([1, potencia - 2]);

        for (let i = 1; i < potencia; i += 2) {
            if (posicionesFantasmas.size < fantasmasNecesarios + 2) {
                posicionesFantasmas.add(i);
            }
        }

        let fantasmasCount = 0;
        for (let i = 0; i < potencia; i++) {
            if (posicionesFantasmas.has(i) && fantasmasCount < fantasmasNecesarios) {
                bracketBase[i] = { nombre: "Fantasma (BYE)", esBye: true };
                fantasmasCount++;
            }
        }

        let mejorCuadroGrupo = null;
        let mejorScoreGlobal = { imp: Infinity, pen: Infinity };
        let actual_orden = [...parejasRestantes];
        let estancamiento = 0;

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
                        // === ASIGNAMOS LA PISTA EXACTA DE ESE SLOT ===
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

            let esMejor = (scoreIntento.imp < mejorScoreGlobal.imp) ||
                (scoreIntento.imp === mejorScoreGlobal.imp && scoreIntento.pen < mejorScoreGlobal.pen);

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

        for (const partido of mejorCuadroGrupo) {
            if (!partido.esBye && partido.slotIndex !== undefined) {
                slotsGastadosGlobales.add(partido.slotIndex);
                delete partido.slotIndex;
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

        AMBIGÜEDADES:
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
            model: "gpt-4-turbo-preview", // Updated to a valid known model
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

// --- EJEMPLO DE USO (SOLO EN ENTORNO NODE.JS) ---
if (typeof require !== 'undefined' && require.main === module) {
    // ... (rest of the example code remains)
    const misInscripciones = [
        { grupo: "PRIMERA MASCULINA", nombre: "Marc Quixal Beltran - Miquel Meseguer Fonollosa", observaciones: "Marc Quixal i Miquel Meseguer  Disponibilitat: tots los dies a partir de els 20:30h   DIJOUS NO DISSABTE DE MATÍ TAMPOC" },
        { grupo: "PRIMERA MASCULINA", nombre: "Samuel sanchez- Lucas Sánchez", observaciones: "Samuel Sánchez Fairweather  Lucas Sánchez Fairweather Disponibilidad: de tarde En 2@ categoría" },
        { grupo: "PRIMERA MASCULINA", nombre: "Amado Clotet Galia - Josep Mayo Gavalda", observaciones: "" },
        { grupo: "PRIMERA MASCULINA", nombre: "Esteban van camp- Gerard Guimerá", observaciones: "Gerard Guimerá Estaban van camp a partir de les 22 de dilluns a Dijous  Divendres a partir de les 20:30  En 1@ categoría" },
        { grupo: "PRIMERA MASCULINA", nombre: "Albert Bassedas Gasco - Joaquim Peñarroya Camats", observaciones: "" },
        { grupo: "PRIMERA MASCULINA", nombre: "Alex Checa Llamosí - Moisés Cortijo Stirb", observaciones: "" },
        { grupo: "PRIMERA MASCULINA", nombre: "Carlos Belles Aparicio - Antonio Mata Benet", observaciones: "" },
        { grupo: "PRIMERA MASCULINA", nombre: "Jaime ortega- Cristian esteller", observaciones: "Jaime ortega Cristian esteller Disponibilidad: Jugar 7 y 8,30 a poder ser A 1@ categoría" },
        { grupo: "QUARTA MASCULNA", nombre: "Javi parras- Fran alcaide", observaciones: "Cuarta categoría" },
        { grupo: "QUARTA MASCULNA", nombre: "Rafael pichardo -Raul blazquez", observaciones: "Rafael Pichardo Molina. Disponibilidad: todo los días a partir de las 18h RAUL BLAZQUEZ SANCHEZ,  Disponibilidad todos los días a partir de las 18:10" },
        { grupo: "QUARTA MASCULNA", nombre: "Yassin Lachmi- Musta barohu", observaciones: "Yassin Lachmi El Ghayat  Musta barohu el bakli A partir de las 20:30 4@ categoría" },
        { grupo: "QUARTA MASCULNA", nombre: "Iván Pegueroles - Dani Espada", observaciones: "4@ categoría" },
        { grupo: "QUARTA MASCULNA", nombre: "sergio vizcarro -alvaro perdomo", observaciones: "" },
        { grupo: "QUARTA MASCULNA", nombre: "Pedro obrero - David fernandez", observaciones: "Pedro Obrero Marín y David Fernández Iglesias. De lunes a viernes por las tardes a partir de las 19 y finde de semana en principio de mañana. 4@ categoría" },
        { grupo: "QUARTA MASCULNA", nombre: "Eneko Blázquez - Santi García", observaciones: "Eneko Blázquez Santi García Barba  4@ categoría" },
        { grupo: "QUARTA MASCULNA", nombre: "ximo esteller -ivan fernandez", observaciones: "" },
        { grupo: "SEGONA  FEMENINA", nombre: "Jacqueline Colom Sieiro,Andrea Arnau Traver", observaciones: "" },
        { grupo: "SEGONA  FEMENINA", nombre: "Aroa Jiménez - Patricia moreno", observaciones: "Aroa Jiménez Martorell  Patricia Moreno García-Pardo Jugar a las 19  Pueden todos los días  2@ femenina" },
        { grupo: "SEGONA  FEMENINA", nombre: "Sara Cherta - Sandra Cuadros", observaciones: "" },
        { grupo: "SEGONA MASCULINA", nombre: "Nil Sabaté vidal - Josep Lorente Bordes", observaciones: "Segona Jugar lo mes pronte posible perfa" },
        { grupo: "SEGONA MASCULINA", nombre: "Eudald Aubalat Queralt - Ramon Reverte Romeu", observaciones: "Segona" },
        { grupo: "SEGONA MASCULINA", nombre: "Joan Foix Negre - bruno baca soriano", observaciones: "Bruno baca enero Joan foix negre Disponibilitat tots els dies a partir de 19:00 A 2@ categoría" },
        { grupo: "SEGONA MASCULINA", nombre: "Marc maluenda - Marc querol", observaciones: "Marc Maluenda Marin Joan Querol Fores  Disponibilidad: Todos los dias a partir de 18:30 2@ categoría" },
        { grupo: "SEGONA MASCULINA", nombre: "Manuel Monserrat Comes,Marc Segarra Ballester", observaciones: "Dilluns, dimarts i dimecres jugar a partir de 20:30h" },
        { grupo: "SEGONA MASCULINA", nombre: "VICTOR ALONSO LORES - Iu Callarisa Querol", observaciones: "Iu Callarisa Querol Victor Alonso 2@ categoría  Tots els dies a partir de les 19:30  Dimarts no poden jugar" },
        { grupo: "SEGONA MASCULINA", nombre: "Juanca lores- Miguel moreno", observaciones: "Guillermo moreno  Juanka lores A partir de las 19 2@ categoría" },
        { grupo: "SEGONA MASCULINA", nombre: "Andrés Gómez Pasadas,Sebastian Febrer Obon", observaciones: "Camisetas los dos tallas XL.  Disponibilidad: De lunes a viernes de 18h en adelante. Sábado y domingo preferiblemente por la mañana." },
        { grupo: "SEGONA MASCULINA", nombre: "Denis monfort - Josep bueno", observaciones: "Denis Monfort L Josep Bueno XL Disponibilitat totes les tardes a partir de les 19 2@ categoría" },
        { grupo: "SEGONA MASCULINA", nombre: "Roger trench - Xavier batalla", observaciones: "Segona ,Talles L i L  Horaris a partir de les 21 h" },
        { grupo: "SEGONA MASCULINA", nombre: "Marc Blanco Caballer - Miguel Ayora Torres", observaciones: "" },
        { grupo: "SEGONA  FEMENINA", nombre: "Stefanie Montes -Valentina pinilla", observaciones: "" },
        { grupo: "SEGONA  FEMENINA", nombre: "Sandra Rosado Rubio,SARA PITARCH AYZA", observaciones: "" },
        { grupo: "SEGONA  FEMENINA", nombre: "Ariadna Mercader  - Mireia Gómez", observaciones: "Ariadna Mercader Garcia  Mireia Gómez Garcia  3@ femenina" },
        { grupo: "SEGONA MASCULINA", nombre: "aaron Félix / Juan Carlos Sánchez", observaciones: "Segunda" },
        { grupo: "SEGONA MASCULINA", nombre: "Javier Zapata - Victor Albiol Gomez", observaciones: "" },
        { grupo: "SEGONA MASCULINA", nombre: "David batiste - Marcos bolumar", observaciones: "buenas te he cridat antes pa incriuremos, te paso les dades: 1- David Batiste Ladrón     2-Marcos Bolumar Orti   la disponibilidad sería a partir del día 20 , y entre semana de tarde , els findes tambe podriem de mati. seria pa apuntarnos en 2a" },
        { grupo: "SEGONA MASCULINA", nombre: "Esteban Van Camp - Houria Boukholda", observaciones: "" },
        { grupo: "SEGONA MASCULINA", nombre: "Manel Giner Rabasco - Carlos Casarrubio Talavera", observaciones: "Manel Giner Rabasco - XL Carlos Casarrubio Talavera - XXL 2@ categoría  A les 19 si pot ser" },
        { grupo: "TERCERA MASCULINA", nombre: "Ismael Vives Fora - Oscar Grañana Castell", observaciones: "Ok natros tardes de les 18:30 per avant siempre antes pos se tindria que mirar matins no podem" },
        { grupo: "TERCERA MASCULINA", nombre: "Guillem Ripolles  - Kiko Royo", observaciones: "Cat 3.5 Tardes a partir d las 16.30 Camiseta L i L" },
        { grupo: "TERCERA MASCULINA", nombre: "Adrian Comes Milian,Carles  Lin Lin", observaciones: "" },
        { grupo: "TERCERA MASCULINA", nombre: "David Castañeda -Jose Castañeda", observaciones: "David Castañeda Borras Jose Castañeda Borras Tots els dies a partir de les 20:30" },
        { grupo: "TERCERA MASCULINA", nombre: "Raúl Miravet Joan furio", observaciones: "Raúl Miravet Joan furio  Pueden jugar Lunes  jueves y domingo En 3@ categoría gracies" },
        { grupo: "TERCERA MASCULINA", nombre: "erik lópez  - iker garcia", observaciones: "erik lópez ferreres iker garcia gomez A partir de les 20:30  4@ categoría" },
        { grupo: "TERCERA MASCULINA", nombre: "Albert Alberich - Pepe roda", observaciones: "Albert Alberich Barroso Pepe roda colomer 3ª  A partir de las 19  Martes 20:30" },
        { grupo: "TERCERA MASCULINA", nombre: "Adrián perez- Jose María Meléndez", observaciones: "Adrián Pérez López José María Melendez Narvaez 3@ categoría  A partir de las 19" },
        { grupo: "TERCERA MASCULINA", nombre: "Ruben flos Maura - Javier Picher Alepuz", observaciones: "Ruben flos Maura Javier Picher Alepuz  En 3@ categoría" },
        { grupo: "TERCERA MASCULINA", nombre: "Rafa marin segura- Ivan marin segura", observaciones: "Tercera categoria audi Rafa marin segura Ivan marin segura" },
        { grupo: "TERCERA MASCULINA", nombre: "Ruben Cerdá - Miquel Piera", observaciones: "Si las partidas pueden ser a partir de las 18:30 podemos todos los dias Tercera masculina" },
        { grupo: "TERCERA MASCULINA", nombre: "Jorge esteller - Pau mercader", observaciones: "jorge esteller guijarro  Talla L Pau mercader garcia XL Jueves y viernes no puede  3@ categoría  Gracies" },
        { grupo: "TERCERA MASCULINA", nombre: "Ernesto sanz f - Pedro Rodríguez", observaciones: "Totes les tardes a partir de les18:00  Serien de 3@" },
        { grupo: "TERCERA MASCULINA", nombre: "Javier Orero - Marco Sunsi", observaciones: "Podemos jugar todas las tardes y sábado por la mañana De 3@" },
        { grupo: "TERCERA MASCULINA", nombre: "Christian Sanchez Vericat,Ferran Dellá Muñoz", observaciones: "A partir de les 20:00 Christian L Ferran L" },
        { grupo: "TERCERA MASCULINA", nombre: "Ivan Marco Ferré - Biel Viladoms Sole", observaciones: "Tercera" },
        { grupo: "TERCERA MASCULINA", nombre: "Joel vizcaíno - Carlos Fajardo", observaciones: "Tercera" },
        { grupo: "TERCERA MASCULINA", nombre: "Miguel Irigaray Zambrano - Boris Enrique Pacheco Bohórquez", observaciones: "Miguel irigaray Boris pacheco Viernes no pueden 3@ categoría" },
        { grupo: "TERCERA MASCULINA", nombre: "Ferrán torres - Fernando ferrer", observaciones: "Ferrán torres Fernando Ferrer A partir de las 20:30  3@ categoría" },
        { grupo: "TERCERA MASCULINA", nombre: "Blai robles- robert giménez", observaciones: "Blai Robles Ferré Talla M Rober Gimenez Vazquez  Talla M 3a categoría" },
        { grupo: "TERCERA MASCULINA", nombre: "alfredo perez -adria ruiz", observaciones: "" }
    ];

    // --- EJEMPLO DE USO ---

    const misHorariosPorPista = [];

    // Define los nombres de tus pistas aquí
    const nombresPistas = ["Pista 1", "Pista 2"];

    for (const nombre of nombresPistas) {
        const horariosDeEstaPista = [];

        // Bucle para los días: del 19 al 25 de Enero de 2026
        for (let dia = 19; dia <= 25; dia++) {

            // Formateamos el día para que siempre tenga dos dígitos (Ej: "19")
            const diaStr = dia.toString().padStart(2, '0');

            // 1. Horario de mañana: de 9:00 a 13:00 (Turnos: 9, 10, 11 y 12)
            for (let hora = 9; hora < 13; hora++) {
                const horaStr = hora.toString().padStart(2, '0');
                // Añadimos la 'Z' al final para indicar formato estándar UTC (recomendado)
                horariosDeEstaPista.push(new Date(`2026-01-${diaStr}T${horaStr}:00:00Z`));
            }

            // 2. Horario de tarde: de 17:00 a 22:00 (Turnos: 17, 18, 19, 20 y 21)
            for (let hora = 17; hora < 22; hora++) {
                const horaStr = hora.toString().padStart(2, '0');
                horariosDeEstaPista.push(new Date(`2026-01-${diaStr}T${horaStr}:00:00Z`));
            }
        }

        // Añadimos el bloque completo de esta pista al array principal
        misHorariosPorPista.push({
            pista: nombre,
            horarios: horariosDeEstaPista
        });
    }

    // Opcional: para comprobar cómo ha quedado
    // console.log(JSON.stringify(misHorariosPorPista, null, 2));

    const misCabezasDeSerie = {
        "PRIMERA MASCULINA": ["Marc Quixal Beltran - Miquel Meseguer Fonollosa", "Alex Checa Llamosí - Moisés Cortijo Stirb"] // La Pareja A y E no se cruzarán hasta la final
    };

    generarPrimeraRonda(misHorariosPorPista, misInscripciones, misCabezasDeSerie)
        .then(resultados => {
            console.log("Torneo generado con éxito:");
            console.log(JSON.stringify(resultados, null, 2));
        })
        .catch(err => {
            console.error("Error fatal:", err);
        });
}