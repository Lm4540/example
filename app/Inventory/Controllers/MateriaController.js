const MaterialController = {
    createMaterial: (req, res) => {
        //Crea la formula junto a los detalles de la misma
    },
    getMaterial: (req, res) => {
        //return a material info in Json Format
    },
    viewMaterial: (req, res) => {
        //Areturn a material info in HTML Render
    },
    updateMaterial: (req, res) => {
        
    },
    deleteMaterial: (req, res) => {
        //Verifica si un material no tiene  registros y lo elimina
        //En caso de tener registros envia un mensaje de prohibido
    },
    incativeMaterial: (req, res) => {
        //softDelete a Material
    },
};

module.exports = MaterialController;