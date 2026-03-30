 const { query } = require('../config/database');
const keywordMatcher = require('./keywordMatcher');
const eliumScraper = require('./eliumScraper');
const ocrService = require('./ocrService');
class ChatbotService {
    constructor() {
        this.searchContexts = new Map();
    }

async processUserMessage(message, screenshotPath = null, sessionId = null) {
    const startTime = Date.now();
    
    try {
        // Vérifier si l'utilisateur est en train de choisir un article
        const context = this.searchContexts.get(sessionId);
        if (context && context.waitingForChoice && this.isNumber(message)) {
            return await this.handleArticleChoice(message, context, startTime);
        }
        
        if (context && context.waitingForChoice && !this.isNumber(message)) {
            this.searchContexts.delete(sessionId);
        }
        
        let searchTerm = message;
        
        // === SI CAPTURE D'ÉCRAN, EXTRAIRE LE TEXTE AVEC OCR ===
        if (screenshotPath) {
            console.log('📸 Capture détectée, OCR en cours...');
            const ocrResult = await ocrService.extractTextFromImage(screenshotPath);
            
            if (ocrResult && ocrResult.text && ocrResult.text.length > 0) {
                console.log('📝 Texte OCR extrait:', ocrResult.text);
                
                // Extraire les mots-clés d'erreur
                const errorText = this.extractErrorText(ocrResult.text);
                
                if (errorText) {
                    searchTerm = errorText;
                    console.log('🔍 Recherche avec texte d\'erreur:', searchTerm);
                } else if (ocrResult.text.length > 5) {
                    searchTerm = ocrResult.text.substring(0, 200);
                    console.log('🔍 Recherche avec texte OCR:', searchTerm);
                }
            } else {
                console.log('⚠️ Aucun texte extrait par OCR');
            }
        }
        
        // Si pas de terme de recherche
        if (!searchTerm || searchTerm.trim() === '') {
            return {
                success: true,
                matched: false,
                message: "Veuillez décrire votre problème ou joindre une capture d'écran."
            };
        }
        
        console.log(`🔍 Recherche finale: "${searchTerm}"`);
        
        const articles = await eliumScraper.search(searchTerm);
        
        if (!articles || articles.length === 0) {
            const ticketId = await this.createTicket(searchTerm, screenshotPath);
            const response = "Je n'ai pas trouvé d'articles correspondant à votre problème. Un ticket a été créé.";
            return {
                success: true,
                matched: false,
                message: response,
                ticketId: ticketId
            };
        }
        
        if (articles.length === 1) {
            const pdfResult = await eliumScraper.generatePDF(articles[0]);
            let response = `${articles[0].title}\n\n`;
            if (pdfResult && pdfResult.success) {
                const fullUrl = `http://localhost:3000${pdfResult.downloadUrl}`;
                response += `Télécharger le PDF:\n\n${fullUrl}\n\n`;
            }
            return {
                success: true,
                matched: true,
                solution: response,
                article: articles[0]
            };
        }
        
        // Plusieurs articles
        this.searchContexts.set(sessionId, {
            waitingForChoice: true,
            articles: articles,
            originalMessage: searchTerm,
            screenshotPath: screenshotPath,
            sessionId: sessionId,
            timestamp: Date.now()
        });
        
        const response = this.formatArticleList(articles);
        return {
            success: true,
            matched: false,
            message: response,
            requiresChoice: true,
            articles: articles.map(a => ({ title: a.title, id: a.id }))
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            success: false,
            error: 'Une erreur est survenue'
        };
    }
}

// Fonction pour extraire le texte d'erreur
// Fonction intelligente pour extraire les mots-clés d'erreur
extractErrorText(text) {
    if (!text) return null;
    
    console.log('📝 Analyse du texte pour extraction...');
    
    let keywords = [];
    
    // 1. Extraire les patterns d'erreur spécifiques (priorité élevée)
    const priorityPatterns = [
        /runtime error (\d+)/i,
        /error (\d+)/i,
        /erreur (\d+)/i,
        /(EAccessViolation|Access violation)/i,
        /Exception\s+(\w+)/i,
    ];
    
    for (const pattern of priorityPatterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[0].toLowerCase().includes('runtime error')) {
                keywords.push(`runtime error ${match[1]}`);
            } else if (match[0].toLowerCase().includes('error')) {
                keywords.push(`error ${match[1]}`);
            } else {
                keywords.push(match[0].toLowerCase());
            }
        }
    }
    
    // 2. Extraire les noms de modules (.bpl, .dll, .exe)
    const modules = text.match(/\b\w+\.(bpl|dll|exe)\b/gi);
    if (modules) {
        keywords.push(...modules.map(m => m.toLowerCase()));
    }
    
    // 3. Extraire les codes d'erreur (ex: 50009D2D) - priorité basse
    const codes = text.match(/\b[0-9A-F]{8}\b/gi);
    if (codes && keywords.length === 0) {
        keywords.push(...codes.map(c => c.toLowerCase()));
    }
    
    // 4. Supprimer doublons
    keywords = [...new Set(keywords)];
    
    // 5. Filtrer les mots trop courts
    keywords = keywords.filter(k => k.length > 3);
    
    console.log('🎯 Mots-clés extraits:', keywords);
    
    // 6. Retourner le meilleur mot-clé
    if (keywords.length > 0) {
        // Priorité aux erreurs runtime/error
        const priority = keywords.find(k => 
            k.includes('runtime error') || 
            k.includes('error') ||
            k.includes('violation') || 
            k.includes('exception')
        );
        
        if (priority) {
            console.log('🔍 Recherche prioritaire:', priority);
            return priority;
        }
        
        console.log('🔍 Recherche standard:', keywords[0]);
        return keywords[0];
    }
    
    return null;
}

isNumber(message) {
    const num = parseInt(message);
    return !isNaN(num) && num.toString() === message.trim();
}

// Fonction pour extraire les mots-clés d'erreur
// Fonction intelligente pour extraire les mots-clés d'erreur
extractErrorKeywords(text) {
    if (!text) return null;
    
    // 1. Extraire le type d'erreur
    const errorPatterns = [
        /(EAccessViolation|Access violation)/i,
        /(Exception|Erreur|Error)\s+(\w+)/i,
        /(runtime error|erreur runtime)\s+(\d+)/i,
        /(read|write) of address/i,
        /(module|module)\s+(\w+\.\w+)/i,
        /at address\s+([0-9A-F]+)/i
    ];
    
    let keywords = [];
    
    // Chercher chaque pattern
    for (const pattern of errorPatterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[1] && match[1].toLowerCase().includes('access')) {
                keywords.push('EAccessViolation');
                keywords.push('access violation');
            } else if (match[1] && match[1].toLowerCase().includes('exception')) {
                keywords.push('exception');
                if (match[2]) keywords.push(match[2]);
            } else if (match[2]) {
                keywords.push(match[2]);
            } else if (match[1]) {
                keywords.push(match[1]);
            }
        }
    }
    
    // 2. Extraire les mots techniques importants
    const importantWords = text.match(/\b[A-Z][a-z]+(?:Error|Exception|Violation|Access|Module|Address)\b/gi);
    if (importantWords) {
        keywords.push(...importantWords);
    }
    
    // 3. Extraire les noms de modules (ex: rtl140.bpl, MRS_Structure.bpl)
    const modules = text.match(/\b\w+\.\w{3}\b/g);
    if (modules) {
        keywords.push(...modules);
    }
    
    // 4. Extraire les codes d'erreur (ex: 00000000)
    const codes = text.match(/\b[0-9A-F]{8}\b/g);
    if (codes) {
        keywords.push(...codes);
    }
    
    // 5. Nettoyer et dédoublonner
    keywords = [...new Set(keywords.map(k => k.toLowerCase()))];
    
    // 6. Supprimer les mots trop courts ou génériques
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    keywords = keywords.filter(k => k.length > 3 && !stopWords.includes(k));
    
    // 7. Construire la phrase de recherche
    if (keywords.length > 0) {
        // Priorité aux mots-clés spécifiques
        const priorityKeywords = keywords.filter(k => 
            k.includes('violation') || 
            k.includes('exception') || 
            k.includes('error') ||
            k.includes('.bpl') ||
            k.includes('access')
        );
        
        if (priorityKeywords.length > 0) {
            return priorityKeywords.slice(0, 5).join(' ');
        }
        return keywords.slice(0, 5).join(' ');
    }
    
    return null;
}

// Fonction pour vérifier si le message est un nombre
isNumber(message) {
    const num = parseInt(message);
    return !isNaN(num) && num.toString() === message.trim();
}

async handleArticleChoice(message, context, startTime) {
    console.log(`🎯 Traitement du choix: "${message}"`);
    console.log(`📋 Articles disponibles: ${context.articles.length}`);
    
    // Convertir le message en numéro
    const choice = parseInt(message);
    let selectedArticle = null;
    
    if (!isNaN(choice) && choice >= 1 && choice <= context.articles.length) {
        selectedArticle = context.articles[choice - 1];
        console.log(`✅ Article sélectionné: ${selectedArticle.title}`);
    } else {
        // Si ce n'est pas un numéro valide, redemander
        return {
            success: true,
            matched: false,
            message: "Je n'ai pas compris. Voici les articles disponibles :\n\n" + 
                context.articles.map((a, i) => `${i+1}. ${a.title}`).join('\n') +
                "\n\n📌 **Veuillez entrer le numéro de l'article (1, 2, 3...)**"
        };
    }
    
    if (selectedArticle) {
        // Générer le PDF pour l'article sélectionné
        console.log(`📄 Génération du PDF pour: "${selectedArticle.title}"`);
        const pdfResult = await eliumScraper.generatePDF(selectedArticle);
        
        let response = `## 📚 **${selectedArticle.title}**\n\n`;
        
        if (pdfResult && pdfResult.success) {
            const fullUrl = `http://localhost:3000${pdfResult.downloadUrl}`;
            response += `📄 **Télécharger le PDF:**\n\n`;
            response += `${fullUrl}\n\n`;
        } else {
            response += `❌ Erreur lors de la génération du PDF.`;
        }
        
        // 🔑 NE PAS SUPPRIMER LE CONTEXTE - pour permettre de choisir un autre article
        // On garde le contexte pour que l'utilisateur puisse choisir un autre numéro
        
        // Ajouter un message pour rappeler les autres articles disponibles
        response += `\n---\n📌 **Autres articles disponibles:**\n\n`;
        const otherArticles = context.articles.filter((_, i) => i !== choice - 1);
        otherArticles.slice(0, 5).forEach((article, idx) => {
            const originalIndex = context.articles.findIndex(a => a.title === article.title) + 1;
            response += `${originalIndex}. ${article.title}\n`;
        });
        response += `\n💡 *Tapez un autre numéro pour voir un autre article.*`;
        
        return {
            success: true,
            matched: true,
            solution: response,
            article: selectedArticle,
            pdfUrl: pdfResult?.downloadUrl,
            // Garder le contexte pour d'autres choix
            keepContext: true
        };
    }
}
    formatArticleList(articles) {
    let response = "🔍 Voici les articles trouvés :\n\n";
    
    articles.forEach((article, index) => {
        response += `${index + 1}. ${article.title}\n`;
    });
    
    response += "\n---\n";
    response += "📌 Tapez le numéro de l'article pour voir la solution.";
    
    return response;
}

    // Dans chatbotService.js - vers la fin du fichier
formatFullArticleResponse(article, content, pdfResult) {
    let response = `## 📚 **${article.title}**\n\n`;
    
    // Résumé court du contenu
    response += `📄 **Document disponible en PDF**\n\n`;
    
    if (pdfResult && pdfResult.success) {
        response += `**[📥 Télécharger le PDF](${pdfResult.downloadUrl})**\n\n`;
        response += `*Cliquez sur le lien pour télécharger et imprimer le document*`;
    } else {
        response += `❌ PDF non disponible`;
    }
    
    return response;
}

    formatArticleResponse(article) {
        return this.formatFullArticleResponse(article, article);
    }

    async createTicket(message, screenshotPath) {
        const result = await query(
            `INSERT INTO tickets (user_message, screenshot_path, status, priority) 
             VALUES (?, ?, 'open', 'medium')`,
            [message, screenshotPath]
        );
        return result.insertId;
    }
}

module.exports = new ChatbotService();