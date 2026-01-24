const { Op } = require('sequelize');
const SystemWarning = require('../Models/Warning');


const warningController = {};

// 1. Buscar warnings entre dos fechas
warningController.getWarningsByDateRange = async (req, res) => {
    try {
        const { init, end } = req.query;

        // Validación básica de parámetros
        if (!init || !end) {
            return res.status(400).json({ 
                error: 'Debes proporcionar fechaInicio y fechaFin en el query string (formato YYYY-MM-DD).' 
            });
        }

        // Se agrega "23:59:59" a la fecha fin para incluir todo ese día en la búsqueda
        const warnings = await SystemWarning.findAll({
            where: {
                createdAt: {
                    [Op.between]: [
                        new Date(`${init}T00:00:00Z`), 
                        new Date(`${end}T23:59:59Z`)
                    ]
                }
            },
            order: [['createdAt', 'DESC']] // Ordenamos del más reciente al más antiguo
        });

        res.status(200).json({
            count: warnings.length,
            data: warnings
        });

    } catch (error) {
        console.error('Error al consultar warnings:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// 2. Guardar un warning nuevo (revisado por defecto es false)
warningController.createWarning = async (req, res) => {
    try {
        const { usuario, tipo, descripcion, proceso, usuario_auditado } = req.body;

        // El modelo ya tiene 'revisado: false' por defecto, 
        // y Sequelize creará el 'createdAt' y 'updatedAt' automáticamente.
        const nuevoWarning = await SystemWarning.create({
            usuario,
            tipo,
            descripcion,
            proceso,
            usuario_auditado
        });

        res.status(201).json({
            message: 'Alerta del sistema registrada con éxito.',
            data: nuevoWarning
        });

    } catch (error) {
        // Manejo específico para errores de validación de Sequelize (ej. si mandan un 'tipo' inválido en el ENUM)
        if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeDatabaseError') {
            return res.status(400).json({ error: 'Datos inválidos. Verifica el tipo de alerta u otros campos.' });
        }
        console.error('Error al crear warning:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// 3. Cambiar el estado de revisado a verdadero
warningController.markAsReviewed = async (req, res) => {
    try {
        const { id } = req.params;

        // Buscamos si el registro existe
        const warning = await SystemWarning.findByPk(id);

        if (!warning) {
            return res.status(404).json({ error: `No se encontró una alerta con el ID: ${id}` });
        }

        if (warning.revisado) {
            return res.status(400).json({ message: 'Esta alerta ya estaba marcada como revisada.' });
        }

        // Actualizamos el estado
        warning.revisado = true;
        await warning.save(); // Esto también actualizará el campo 'updatedAt' automáticamente

        res.status(200).json({
            message: 'Alerta marcada como revisada exitosamente.',
            data: warning
        });

    } catch (error) {
        console.error('Error al actualizar el estado:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ... (código anterior del controlador)

// 4. Función interna para consumir desde otros controladores
warningController.logInternalWarning = async (warningData) => {
    try {
        // Desestructuramos para asegurar la limpieza de los datos que entran
        const { usuario, tipo, descripcion, proceso, usuario_auditado } = warningData;

        // Validación de seguridad para el campo obligatorio en la BD
        if (!tipo) {
            console.warn('⚠️ Omisión de registro: Se intentó guardar un warning sin "tipo".');
            return null; // Retornamos null en lugar de lanzar un error que rompa el flujo principal
        }

        // Creamos el registro asíncronamente
        const nuevoWarning = await SystemWarning.create({
            usuario: usuario || 'Sistema', // Si no envían usuario, asume que fue un proceso automático del sistema
            tipo,
            descripcion,
            proceso,
            usuario_auditado
        });

        return nuevoWarning; // Retornamos el objeto por si el controlador original necesita su ID

    } catch (error) {
        // Hacemos log del error, pero NO lanzamos el error (throw) 
        // para evitar que se caiga el proceso de negocio que llamó a esta función.
        console.error('❌ Error crítico al registrar alerta interna del sistema:', error.message);
        return null; 
    }
};

module.exports = warningController;