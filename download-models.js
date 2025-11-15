const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'public/assets/dice-box/models');

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
  console.log('📁 Dossier models/ créé');
}

// Liste des modèles à télécharger depuis le CDN jsDelivr
const models = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
const baseUrl = 'https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1.1.4/dist/models/';

let completed = 0;
let failed = 0;

models.forEach(modelName => {
  const fileName = `${modelName}.json`;
  const url = `${baseUrl}${fileName}`;
  const filePath = path.join(modelsDir, fileName);

  console.log(`⏳ Téléchargement de ${fileName}...`);

  https.get(url, (response) => {
    if (response.statusCode === 200) {
      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        completed++;
        console.log(`✅ ${fileName} téléchargé`);
        
        if (completed + failed === models.length) {
          console.log(`\n🎉 Terminé ! ${completed}/${models.length} fichiers téléchargés`);
          if (failed > 0) {
            console.log(`⚠️  ${failed} fichiers ont échoué`);
          }
        }
      });
    } else {
      failed++;
      console.error(`❌ ${fileName} - Erreur ${response.statusCode}`);
      
      if (completed + failed === models.length) {
        console.log(`\n🎉 Terminé ! ${completed}/${models.length} fichiers téléchargés`);
        if (failed > 0) {
          console.log(`⚠️  ${failed} fichiers ont échoué`);
        }
      }
    }
  }).on('error', (err) => {
    failed++;
    console.error(`❌ ${fileName} - Erreur réseau:`, err.message);
    
    if (completed + failed === models.length) {
      console.log(`\n🎉 Terminé ! ${completed}/${models.length} fichiers téléchargés`);
      if (failed > 0) {
        console.log(`⚠️  ${failed} fichiers ont échoué`);
      }
    }
  });
});