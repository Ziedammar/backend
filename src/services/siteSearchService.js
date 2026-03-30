const axios = require('axios');
const cheerio = require('cheerio');

class EliumSearchService {
    constructor() {
        this.baseUrl = 'https://cover-group.elium.com';
        this.searchEndpoint = 'https://cover-group.elium.com/search';
        
        // Configuration pour les cookies/session si nécessaire
        this.cookies = null;
    }

    async searchDocumentation(keyword) {
        try {
            console.log('🔍 Searching Elium documentation for:', keyword);
            
            // Simuler une recherche sur le site
            // En réalité, il faudrait:
            // 1. S'authentifier d'abord
            // 2. Faire une requête de recherche
            // 3. Parser les résultats
            
            // Pour l'instant, on cherche dans notre base locale
            // mais avec les données que vous avez montrées dans la capture
            const results = await this.searchInLocalDB(keyword);
            
            // Ajouter des résultats spécifiques de la documentation Cover
            const coverDocs = this.getCoverDocumentation(keyword);
            
            return {
                success: true,
                keyword: keyword,
                results: [...results, ...coverDocs],
                count: results.length + coverDocs.length
            };
        } catch (error) {
            console.error('Error searching Elium:', error);
            return { success: false, results: [], error: error.message };
        }
    }

    getCoverDocumentation(keyword) {
        // Documentation Cover basée sur les captures d'écran
        const docs = [];
        const lowerKeyword = keyword.toLowerCase();
        
        // Articles sur les licences et erreurs H0007
        if (lowerKeyword.includes('key') || lowerKeyword.includes('licence') || lowerKeyword.includes('h0007')) {
            docs.push({
                id: 'elium_001',
                title: '🔑 Licence: Erreur - Sentinel key not found H0007',
                description: 'Aucune licence active trouvée sur votre machine. Solution: réinstaller les pilotes Sentinel.',
                solution: `**Solution pour l'erreur H0007 (Sentinel key not found)**

## 📌 Cause du problème
Ce message signifie qu'aucune licence active ne peut être trouvée sur votre machine.

## ✅ Solution
1. **Réinstaller les pilotes Sentinel**
   - Téléchargez les derniers pilotes sur le site de Gemalto/Thales
   - Désinstallez complètement les anciens pilotes
   - Redémarrez votre ordinateur
   - Installez les nouveaux pilotes
   - Réactivez votre licence Cover

2. **Si la licence est réseau**
   - Vérifiez que le serveur de licence est allumé
   - Vérifiez que le PC client peut accéder au serveur
   - Désactivez temporairement le firewall pour tester
   - Contactez votre administrateur réseau

3. **Si le problème persiste**
   - Contactez le support Cover avec votre numéro de licence
   - Incluez le code erreur complet H0007`,
                errorCode: 'H0007',
                keywords: 'sentinel,key,licence,h0007,erreur',
                source: 'Elium Documentation'
            });
            
            docs.push({
                id: 'elium_002',
                title: '🌐 Erreur H0007 (licence réseau)',
                description: 'Problème de licence réseau - Le PC client ne trouve pas la licence distante',
                solution: `**Solution pour l'erreur H0007 en mode réseau**

## 🔍 Diagnostic
Le PC client n'arrive pas à trouver la licence partageable installée sur une autre machine.

## ✅ Solutions

### 1. Vérifier le serveur de licence
- La machine avec la licence partageable est-elle allumée ?
- Le service Sentinel est-il démarré ?
- Vérifiez que la licence est toujours valide

### 2. Vérifier la connexion réseau
- Testez le ping entre les deux machines
- Vérifiez les pare-feux (firewalls)
- Assurez-vous que le port 1947 (Sentinel) est ouvert

### 3. Configurer manuellement
- Dans Cover > Aide > Licence
- Cliquez sur "Configuration réseau"
- Entrez l'adresse IP du serveur de licence
- Testez la connexion

### 4. Redémarrer les services
- Redémarrez le service Sentinel sur le serveur
- Redémarrez Cover sur le client
- Redémarrez les deux machines si nécessaire`,
                errorCode: 'H0007-NET',
                keywords: 'h0007,reseau,network,licence partageable',
                source: 'Elium Documentation'
            });
        }
        
        // Article sur les problèmes d'affichage
        if (lowerKeyword.includes('affichage') || lowerKeyword.includes('display')) {
            docs.push({
                id: 'elium_003',
                title: '🖥️ Problèmes d\'affichage dans Cover',
                description: 'L\'interface Cover ne s\'affiche pas correctement',
                solution: `**Solution pour les problèmes d'affichage**

## ✅ Solutions
1. **Rafraîchir la page** (F5)
2. **Vider le cache navigateur**
   - Chrome: Ctrl+Shift+Suppr
   - Sélectionnez "Images et fichiers en cache"
3. **Désactiver les extensions** qui pourraient interférer
4. **Changer de navigateur** (essayez Chrome, Firefox, Edge)
5. **Mettre à jour les pilotes graphiques**`,
                errorCode: 'DISP-001',
                keywords: 'affichage,display,interface,ecran',
                source: 'Elium Documentation'
            });
        }
        
        // Article sur les problèmes d'upload
        if (lowerKeyword.includes('upload') || lowerKeyword.includes('fichier')) {
            docs.push({
                id: 'elium_004',
                title: '📁 Problème d\'upload de fichiers',
                description: 'Erreur lors de l\'upload de fichiers dans Cover',
                solution: `**Solution pour les problèmes d'upload**

## ✅ Vérifications
1. **Taille du fichier**
   - La taille maximale est de 50 Mo
   - Si plus grand, utilisez le partage externe

2. **Formats acceptés**
   - PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, MP4

3. **Droits d'accès**
   - Vérifiez que vous avez les droits d'écriture
   - L'espace n'est pas en lecture seule

4. **Connexion internet**
   - Vérifiez votre connexion
   - Essayez avec une connexion filaire

5. **Vider le cache**
   - Videz le cache du navigateur
   - Essayez en navigation privée`,
                errorCode: 'UPL-001',
                keywords: 'upload,fichier,file,erreur',
                source: 'Elium Documentation'
            });
        }
        
        return docs;
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
            
            return results.map(r => ({
                ...r,
                source: 'Knowledge Base'
            }));
        } catch (error) {
            console.error('Error in local search:', error);
            return [];
        }
    }

    async getFullArticle(articleId) {
        // Récupérer l'article complet
        if (articleId.startsWith('elium_')) {
            // Article de la documentation Elium
            const docs = this.getCoverDocumentation('');
            const article = docs.find(d => d.id === articleId);
            if (article) {
                return {
                    title: article.title,
                    content: article.solution,
                    description: article.description,
                    errorCode: article.errorCode,
                    fullArticle: `
# ${article.title}

## Description
${article.description}

## Solution
${article.solution}

${article.errorCode ? `**Code erreur:** ${article.errorCode}` : ''}
---
*Source: Documentation Cover sur Elium*
                    `
                };
            }
        } else {
            // Article de la base locale
            const { query } = require('../config/database');
            const result = await query('SELECT * FROM problems WHERE id = ?', [articleId]);
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
        }
        return null;
    }
}

module.exports = new EliumSearchService();