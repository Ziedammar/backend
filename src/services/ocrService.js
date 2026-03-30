const Tesseract = require('tesseract.js');
const fs = require('fs');

class OCRService {
    async extractTextFromImage(imagePath) {
        try {
            console.log('🔍 OCR en cours sur:', imagePath);
            
            // Vérifier que le fichier existe
            if (!fs.existsSync(imagePath)) {
                console.log('❌ Fichier introuvable:', imagePath);
                return { text: '', success: false };
            }
            
            const { data: { text } } = await Tesseract.recognize(
                imagePath,
                'fra+eng',
                {
                    logger: m => console.log('OCR:', m.status)
                }
            );
            
            console.log('📝 TEXTE OCR EXTRAIT:');
            console.log('====================================');
            console.log(text);
            console.log('====================================');
            
            return {
                text: text.trim(),
                success: true
            };
            
        } catch (error) {
            console.error('❌ OCR Error:', error);
            return { text: '', success: false };
        }
    }
}

module.exports = new OCRService();