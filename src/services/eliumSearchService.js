class EliumSearchService {
    async searchDocumentation(keyword) {
        try {
            console.log('🔍 Searching documentation for:', keyword);
            
            // Rechercher dans la base locale
            const results = await this.searchInLocalDB(keyword);
            
            return {
                success: true,
                keyword: keyword,
                results: results,
                count: results.length
            };
        } catch (error) {
            console.error('Error searching documentation:', error);
            return { success: false, results: [], error: error.message };
        }
    }

    async searchInLocalDB(keyword) {
        const { query } = require('../config/database');
        
        try {
            const results = await query(`
                SELECT * FROM problems 
                WHERE keywords LIKE ? 
                OR title LIKE ? 
                OR description LIKE ?
                LIMIT 10
            `, [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]);
            
            console.log(`Found ${results.length} results for keyword: ${keyword}`);
            
            return results.map(r => ({
                id: r.id,
                title: r.title,
                description: r.description,
                solution: r.solution,
                errorCode: r.error_code,
                keywords: r.keywords,
                type: 'knowledge_base'
            }));
        } catch (error) {
            console.error('Error in searchInLocalDB:', error);
            return [];
        }
    }

    async getFullArticle(problemId) {
        const { query } = require('../config/database');
        
        try {
            const result = await query('SELECT * FROM problems WHERE id = ?', [problemId]);
            
            if (result.length > 0) {
                return {
                    title: result[0].title,
                    content: result[0].solution,
                    description: result[0].description,
                    errorCode: result[0].error_code,
                    fullArticle: `
# ${result[0].title}

## Description
${result[0].description}

## Solution
${result[0].solution}

${result[0].error_code ? `**Code erreur:** ${result[0].error_code}` : ''}
                    `
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting full article:', error);
            return null;
        }
    }
}

module.exports = new EliumSearchService();