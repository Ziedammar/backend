const puppeteer = require('puppeteer');

class EliumScraper {
    constructor() {
        this.browser = null;
        this.baseUrl = 'https://cover-group.elium.com';
        this.username = 'zied.ammar@cover3d.com';
        this.password = '213JmT5556//++';
        this.isConnected = false;
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async connect() {
        if (this.isConnected) return true;
        
        try {
            console.log('🌐 Connexion au site...');
            
           this.browser = await puppeteer.launch({
    headless: "new", // Version plus stable pour les serveurs
    args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Important pour éviter les crashs sur Render
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
    ],
    defaultViewport: { width: 1280, height: 800 }
});
            
            const page = await this.browser.newPage();
            await page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.wait(3000);
            
            // Remplir email
            const emailInput = await page.$('input[type="email"], input[name="login"], input[name="email"], input[type="text"]');
            if (emailInput) {
                await emailInput.type(this.username, { delay: 50 });
                console.log('✅ Email saisi');
            }
            
            // Remplir mot de passe
            const passwordInput = await page.$('input[type="password"]');
            if (passwordInput) {
                await passwordInput.type(this.password, { delay: 50 });
                console.log('✅ Mot de passe saisi');
            }
            
            // Cliquer sur le bouton
            const submitButton = await page.$('#field-submit, input[value="Login"], button[type="submit"]');
            if (submitButton) {
                await submitButton.click();
                console.log('✅ Clic sur le bouton');
            } else if (passwordInput) {
                await passwordInput.press('Enter');
                console.log('✅ Entrée pressée');
            }
            
            await this.wait(8000);
            console.log('✅ Connecté avec succès');
            this.isConnected = true;
            return true;
            
        } catch (error) {
            console.error('❌ Erreur de connexion:', error.message);
            return false;
        }
    }

    async search(keyword) {
    console.log(`🔍 RECHERCHE SUR LE SITE POUR: "${keyword}"`);
    
    try {
        const connected = await this.connect();
        if (!connected) {
            return [];
        }
        
        const pages = await this.browser.pages();
        const page = pages[pages.length - 1];
        
        // Faire la recherche
        const searchUrl = `https://cover-group.elium.com/search?q=${encodeURIComponent(keyword)}`;
        console.log(`📍 Recherche: ${searchUrl}`);
        
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.wait(5000);
        
        // === EXTRAIRE LES ARTICLES AVEC LEURS LIENS ===
        const articles = await page.evaluate(() => {
            const results = [];
            
            // Méthode 1: Cibler les liens qui pointent vers /title/view/
            const articleLinks = document.querySelectorAll('a[href*="/title/view/"]');
            
            for (const link of articleLinks) {
                let title = link.innerText.trim();
                let href = link.href;
                
                // Nettoyer le titre
                if (title && title.length > 3 && title.length < 200) {
                    // Exclure les titres indésirables
                    const excludeWords = ['Voir plus', 'Tous les', 'Plus de', 'Rechercher', 'Filtrer'];
                    let exclude = false;
                    for (const word of excludeWords) {
                        if (title === word || title.startsWith(word)) {
                            exclude = true;
                            break;
                        }
                    }
                    
                    if (!exclude && !results.find(r => r.title === title)) {
                        results.push({
                            id: `article_${results.length}`,
                            title: title,
                            link: href,
                            description: '',
                            source: 'Site Cover'
                        });
                    }
                }
            }
            
            // Méthode 2: Utiliser la classe spécifique des titres
            const titleElements = document.querySelectorAll('.CommonStorySummaryTitle__StoryViewLinkStyled, [class*="StoryViewLinkStyled"], .result-item a, .search-result a');
            
            for (const el of titleElements) {
                let title = el.innerText.trim();
                let href = el.href;
                
                if (title && title.length > 3 && title.length < 200 && !results.find(r => r.title === title)) {
                    const excludeWords = ['Voir plus', 'Tous les'];
                    let exclude = false;
                    for (const word of excludeWords) {
                        if (title === word) {
                            exclude = true;
                            break;
                        }
                    }
                    
                    if (!exclude) {
                        results.push({
                            id: `article_${results.length}`,
                            title: title,
                            link: href || '',
                            description: '',
                            source: 'Site Cover'
                        });
                    }
                }
            }
            
            console.log(`🔍 Trouvé ${results.length} articles avec liens`);
            return results.slice(0, 10);
        });
        
        console.log(`📚 ${articles.length} ARTICLES TROUVÉS:`);
        if (articles.length > 0) {
            articles.forEach((a, i) => {
                console.log(`   ${i+1}. ${a.title}`);
                console.log(`      🔗 ${a.link}`);
            });
            return articles;
        }
        
        return [];
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        return [];
    }
}
    async getArticleContent(article) {
    try {
        console.log(`📖 Récupération du contenu de l'article: "${article.title}"`);
        
        if (!article.link) {
            console.log('⚠️ Pas de lien disponible pour cet article');
            return {
                ...article,
                fullContent: "Contenu disponible sur le site Cover. Veuillez cliquer sur le lien pour voir l'article."
            };
        }
        
        const pages = await this.browser.pages();
        const page = pages[pages.length - 1];
        
        console.log(`🔗 Ouverture du lien: ${article.link}`);
        await page.goto(article.link, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.wait(3000);
        
        // Extraire le contenu de l'article
        const content = await page.evaluate(() => {
            // Chercher le contenu principal
            const contentSelectors = [
                '.article-content',
                '.story-content',
                '.content',
                'main',
                '[class*="content"]',
                '.description',
                '.story-body',
                'article'
            ];
            
            for (const selector of contentSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const text = element.innerText.trim();
                    if (text && text.length > 50) {
                        return text;
                    }
                }
            }
            
            // Si rien trouvé, prendre tous les paragraphes
            const paragraphs = document.querySelectorAll('p');
            let text = '';
            for (const p of paragraphs) {
                text += p.innerText.trim() + '\n\n';
            }
            return text || null;
        });
        
        if (content && content.length > 0) {
            console.log(`✅ Contenu récupéré (${content.length} caractères)`);
            
            // Formater le contenu
            const formattedContent = this.formatContent(content, article.title);
            
            return {
                ...article,
                fullContent: formattedContent
            };
        }
        
        console.log('⚠️ Contenu non trouvé, retour de l\'article sans contenu');
        return {
            ...article,
            fullContent: `📄 **${article.title}**\n\nL'article complet est disponible sur le site Cover.\n\n🔗 **Lien:** ${article.link}`
        };
        
    } catch (error) {
        console.error('❌ Erreur lors de la récupération du contenu:', error.message);
        return {
            ...article,
            fullContent: `❌ Erreur lors de la récupération du contenu.\n\n🔗 **Lien direct:** ${article.link || 'Non disponible'}`
        };
    }
}

formatContent(content, title) {
    // Nettoyer et formater le contenu
    let cleanContent = content
        .replace(/\n\s*\n\s*\n/g, '\n\n')  // Supprimer les lignes vides multiples
        .replace(/\n{3,}/g, '\n\n')         // Limiter les sauts de ligne
        .trim();
    
    // Limiter la longueur si trop long (optionnel)
    if (cleanContent.length > 4000) {
        cleanContent = cleanContent.substring(0, 4000) + '\n\n... (contenu tronqué)';
    }
    
    return `## 📚 **${title}**\n\n${cleanContent}`;
}
async generatePDF(article) {
    try {
        console.log(`📄 Génération du PDF pour: "${article.title}"`);
        
        if (!article.link) {
            return null;
        }
        
        const pages = await this.browser.pages();
        const page = pages[pages.length - 1];
        
        // Aller à la page de l'article
        await page.goto(article.link, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.wait(3000);
        
        // Nom du fichier PDF
        const timestamp = Date.now();
        const filename = `${article.title.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.pdf`;
        const pdfPath = `./uploads/${filename}`;
        
        // Générer le PDF
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                bottom: '20mm',
                left: '15mm',
                right: '15mm'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div style="font-size:10px; text-align:center; width:100%;">Cover Documentation</div>',
            footerTemplate: `<div style="font-size:10px; text-align:center; width:100%;">
                Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
            </div>`
        });
        
        console.log(`✅ PDF généré: ${pdfPath}`);
        
        return {
            success: true,
            pdfPath: pdfPath,
            filename: filename,
            downloadUrl: `/uploads/${filename}`
        };
        
    } catch (error) {
        console.error('❌ Erreur génération PDF:', error.message);
        return null;
    }
}
}

module.exports = new EliumScraper();