require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { callOpenAI, construirPromptAnalisisTodas, evaluarPartidoUnico, generarPrimeraRonda } = require('./public/generador-cuadros-cabeza-ia-pista.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Log para verificar variables en producción
console.log("--- Verificación de Entorno ---");
console.log(`Puerto: ${PORT}`);
console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Cargada' : '❌ No encontrada'}`);
console.log("-------------------------------");

// Habilitar CORS para que el frontend local pueda hacer peticiones
app.use(cors());

// Aumentar los límites de carga de JSON por si los datos del Excel son muy grandes
app.use(express.json({ limit: '50mb' }));

// Servir la carpeta 'public' como archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para general los cuadros con OpenAI
app.post('/api/generar-cuadros', async (req, res) => {
    try {
        const { horariosPorPista, inscripciones, cabezasDeSerie } = req.body;

        if (!horariosPorPista || !inscripciones) {
            return res.status(400).json({ error: "Faltan datos obligatorios para generar los cuadros." });
        }

        // Cargamos la clave directamente de las variables de entorno exclusivas del servidor Node
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "Falta configurar la OPENAI_API_KEY en el servidor." });
        }

        // Replicar la estructuración de grupos de main.js/app.js pero en servidor
        const grupos = {};
        for (const ins of inscripciones) {
            if (!grupos[ins.grupo]) grupos[ins.grupo] = [];
            grupos[ins.grupo].push(ins);
        }

        const cuadros = await generarPrimeraRonda(horariosPorPista, inscripciones, cabezasDeSerie, apiKey);
        res.status(200).json(cuadros);

    } catch (error) {
        console.error("Error en /api/generar-cuadros:", error);
        res.status(500).json({ error: "Error en el servidor al invocar OpenAI." });
    }
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor backend encendido en http://0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
    console.error("❌ Error de servidor:", err);
});

process.on('exit', (code) => {
    console.log(`⚠️  El proceso de Node salió con el código: ${code}`);
});

process.on('SIGINT', () => {
    console.log("\n🛑 Recibido SIGINT, apagando servidor...");
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log("\n🛑 Recibido SIGTERM, apagando servidor...");
    server.close(() => {
        process.exit(0);
    });
});
