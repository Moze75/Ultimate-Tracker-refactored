import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsDir = path.join(__dirname, 'public/assets/dice-box/models');

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
  console.log('📁 Dossier models/ créé');
}

// Liste des modèles à télécharger
const models = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
const baseUrl = 'https://unpkg.com/@3d-dice/dice-box-threejs@0.0.12/dist/models/';

let completed = 0;
let failed = 0;

console.log('🔍 Début du téléchargement...\n');

// Fonction pour télécharger un fichier
async function downloadFile(modelName) {
  const fileName = `${modelName}.json`;
  const url = `${baseUrl}${fileName}`;
  const filePath = path.join(modelsDir, fileName);

  console.log(`⏳ Téléchargement de ${fileName}...`);

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.text();
    fs.writeFileSync(filePath, data, 'utf8');
    
    completed++;
    console.log(`✅ ${fileName} téléchargé (${data.length} octets)`);
    
  } catch (error) {
    failed++;
    console.error(`❌ ${fileName} - Erreur: ${error.message}`);
  }
}

// Télécharger tous les fichiers en parallèle
Promise.all(models.map(m => downloadFile(m))).then(() => {
  console.log(`\n🎉 Terminé ! ${completed}/${models.length} fichiers téléchargés`);
  if (failed > 0) {
    console.log(`⚠️  ${failed} fichiers ont échoué`);
  }
});