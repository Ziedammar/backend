class KeywordMatcher {
    extractKeywords(text) {
        if (!text || typeof text !== 'string') {
            return [];
        }
        
        console.log('Extracting keywords from:', text);
        
        // Convertir en minuscules et supprimer la ponctuation
        const cleaned = text.toLowerCase().replace(/[^\w\s]/g, '');
        const words = cleaned.split(/\s+/);
        
        // Mots à ignorer
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'];
        
        // Filtrer les mots
        const keywords = words.filter(word => 
            word.length > 2 && !stopWords.includes(word)
        );
        
        console.log('Extracted keywords:', keywords);
        return [...new Set(keywords)];
    }

    calculateRelevance(text, problemKeywords) {
        const keywords = this.extractKeywords(text);
        const problemKeywordArray = problemKeywords.toLowerCase().split(',');
        
        let matches = 0;
        for (const keyword of keywords) {
            if (problemKeywordArray.some(pk => pk.trim().includes(keyword))) {
                matches++;
            }
        }
        
        return problemKeywordArray.length > 0 ? matches / problemKeywordArray.length : 0;
    }
}

// Créer une instance et l'exporter
const keywordMatcher = new KeywordMatcher();
module.exports = keywordMatcher;