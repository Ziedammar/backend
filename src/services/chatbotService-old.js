const { query } = require('../config/database');
const { extractTextFromImage } = require('./ocrService');
const keywordMatcher = require('./keywordMatcher');
const eliumSearchService = require('./eliumSearchService');  // ← Ajouter cette ligne

class ChatbotService {
    constructor() {
        // Stocker le contexte de recherche pour chaque session
        this.searchContexts = new Map();
    }

    async processUserMessage(message, screenshotPath = null, sessionId = null) {
         console.log('📨 MESSAGE REÇU DU CHAT:', message);  // ← AJOUTER CETTE LIGNE
    
    const startTime = Date.now();
        let matchedProblem = null;
        let ticketId = null;
        let screenshotText = null;

        try {
            // Vérifier si l'utilisateur est en train de préciser une recherche
            const context = this.searchContexts.get(sessionId);
            if (context && context.waitingForPrecision) {
                return await this.handlePrecisionResponse(message, context, startTime);
            }

            // Étape 1: Analyser le message utilisateur
            const searchResults = await this.searchProblemsWithSite(message);
            
            // Étape 2: Analyser la capture d'écran si fournie
            if (screenshotPath) {
                const ocrResult = await extractTextFromImage(screenshotPath);
                if (ocrResult) {
                    screenshotText = ocrResult;
                    const screenshotResults = await this.searchProblemsWithSite(ocrResult);
                    searchResults.push(...screenshotResults);
                }
            }

            // Étape 3: Si plusieurs résultats, demander des précisions
            if (searchResults.length > 1) {
                // Sauvegarder le contexte
                this.searchContexts.set(sessionId, {
                    waitingForPrecision: true,
                    results: searchResults,
                    message: message,
                    screenshotPath: screenshotPath,
                    timestamp: Date.now()
                });
                
                const response = this.formatMultipleResultsMessage(searchResults);
                await this.logInteraction(message, response, screenshotPath, null, null, Date.now() - startTime);
                
                return {
                    success: true,
                    matched: false,
                    message: response,
                    requiresPrecision: true,
                    results: searchResults.map(r => ({ title: r.title, id: r.id }))
                };
            }
            
            // Étape 4: Si un seul résultat, donner la solution
            if (searchResults.length === 1) {
                matchedProblem = searchResults[0];
                const response = this.formatFullSolution(matchedProblem);
                await this.logInteraction(message, response, screenshotPath, matchedProblem.id, null, Date.now() - startTime);
                
                return {
                    success: true,
                    matched: true,
                    solution: response,
                    problemId: matchedProblem.id
                };
            }

            // Étape 5: Aucun résultat, créer ticket
            ticketId = await this.createTicket(message, screenshotPath, JSON.stringify({ searchTerms: message, screenshotText }));
            const response = "Je n'ai pas trouvé de solution dans la documentation. Un ticket a été créé (ID: " + ticketId + "). Notre équipe vous contactera rapidement.";
            
            await this.logInteraction(message, response, screenshotPath, null, ticketId, Date.now() - startTime);
            
            return {
                success: true,
                matched: false,
                message: response,
                ticketId: ticketId
            };
        } catch (error) {
            console.error('Error processing message:', error);
            return {
                success: false,
                error: 'Une erreur est survenue'
            };
        }
    }

    async handlePrecisionResponse(message, context, startTime) {
        try {
            // Chercher dans les résultats précédents
            const selectedResult = context.results.find(r => 
                r.title.toLowerCase().includes(message.toLowerCase()) ||
                r.errorCode?.toLowerCase().includes(message.toLowerCase())
            );
            
            if (selectedResult) {
                // L'utilisateur a précisé lequel
                const response = this.formatFullSolution(selectedResult);
                this.searchContexts.delete(context.sessionId);
                await this.logInteraction(context.message, response, context.screenshotPath, selectedResult.id, null, Date.now() - startTime);
                
                return {
                    success: true,
                    matched: true,
                    solution: response,
                    problemId: selectedResult.id
                };
            } else {
                // Demander plus de précisions
                const response = "Je n'ai pas compris. Parmi ces sujets, lequel correspond à votre problème ?\n\n" + 
                    context.results.map((r, i) => `${i+1}. ${r.title}`).join('\n');
                
                return {
                    success: true,
                    matched: false,
                    message: response,
                    requiresPrecision: true
                };
            }
        } catch (error) {
            console.error('Error handling precision response:', error);
            return {
                success: false,
                error: 'Erreur lors du traitement'
            };
        }
    }

    async searchProblemsWithSite(keyword) {
    if (!keyword) return [];
    
    console.log('Searching for:', keyword);
    
    // 1. Chercher dans la base de connaissances locale
    const localResults = await this.searchProblems(keyword);
    
    // 2. Chercher dans le service Elium
    const siteResults = await eliumSearchService.searchDocumentation(keyword);
    
    // 3. Combiner les résultats
    const allResults = [...localResults];
    for (const siteResult of siteResults.results) {
        if (!allResults.some(r => r.title === siteResult.title)) {
            allResults.push(siteResult);
        }
    }
    
    console.log(`Total results: ${allResults.length}`);
    return allResults;
}

    async searchProblems(keyword) {
        if (!keyword) return [];
        
        const keywords = keywordMatcher.extractKeywords(keyword);
        if (keywords.length === 0) return [];
        
        const problems = await query(
            `SELECT * FROM problems WHERE 
            keywords LIKE ? OR 
            title LIKE ? OR 
            description LIKE ? OR
            solution LIKE ?
            LIMIT 10`,
            [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`]
        );
        
        return problems;
    }

    formatMultipleResultsMessage(results) {
        let message = "🔍 J'ai trouvé plusieurs articles qui pourraient correspondre à votre problème :\n\n";
        
        results.forEach((result, index) => {
            message += `${index + 1}. **${result.title}**\n`;
            if (result.errorCode) message += `   Code: ${result.errorCode}\n`;
            message += `   ${result.description?.substring(0, 100)}...\n\n`;
        });
        
        message += "📌 **Pouvez-vous préciser lequel correspond à votre problème ?**\n";
        message += "Répondez avec le numéro ou le titre de l'article.";
        
        return message;
    }

    formatFullSolution(problem) {
        return `## 📚 Solution: ${problem.title}\n\n` +
               `### 📝 Description\n${problem.description || 'Non spécifiée'}\n\n` +
               `### ✅ Solution\n${problem.solution}\n\n` +
               `${problem.errorCode ? `### 🔢 Code erreur\n${problem.errorCode}\n\n` : ''}` +
               `---\n💡 **Conseil:** Si cette solution ne résout pas votre problème, n'hésitez pas à fournir plus de détails ou une capture d'écran.`;
    }

    async createTicket(message, screenshotPath, contextInfo) {
        const result = await query(
            `INSERT INTO tickets (user_message, screenshot_path, status, priority, resolution_notes) 
             VALUES (?, ?, 'open', 'medium', ?)`,
            [message, screenshotPath, contextInfo]
        );
        return result.insertId;
    }

    async logInteraction(message, response, screenshotPath, problemId, ticketId, responseTime) {
        await query(
            `INSERT INTO support_logs (user_message, response, screenshot_path, matched_problem_id, ticket_id, response_time_ms)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [message, response, screenshotPath, problemId, ticketId, responseTime]
        );
    }
}

module.exports = new ChatbotService();