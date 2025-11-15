// Liste des URLs possibles à tester
const urlsToTest = [
  // Tentative 1 : dice-box-threejs
  'https://unpkg.com/@3d-dice/dice-box-threejs@0.0.12/dist/models/d20.json',
  'https://unpkg.com/@3d-dice/dice-box-threejs@0.0.12/models/d20.json',
  'https://unpkg.com/@3d-dice/dice-box-threejs@latest/dist/models/d20.json',
  
  // Tentative 2 : dice-box
  'https://unpkg.com/@3d-dice/dice-box@1.1.4/dist/models/d20.json',
  'https://unpkg.com/@3d-dice/dice-box@latest/dist/models/d20.json',
  'https://unpkg.com/@3d-dice/dice-box/dist/models/d20.json',
  
  // Tentative 3 : jsDelivr
  'https://cdn.jsdelivr.net/npm/@3d-dice/dice-box-threejs@0.0.12/dist/models/d20.json',
  'https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@latest/dist/models/d20.json',
  
  // Tentative 4 : GitHub raw
  'https://raw.githubusercontent.com/3d-dice/dice-box-threejs/main/dist/models/d20.json',
  'https://raw.githubusercontent.com/3d-dice/dice-box/main/dist/models/d20.json',
];

console.log('🔍 Test des URLs pour trouver les modèles 3D...\n');

async function testUrl(url) {
  try {
    const response = await fetch(url);
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      const text = await response.text();
      const size = text.length;
      
      console.log(`✅ TROUVÉ: ${url}`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Taille: ${size} octets`);
      
      // Vérifier si c'est du JSON valide
      try {
        JSON.parse(text);
        console.log(`   ✓ JSON valide\n`);
        return url;
      } catch {
        console.log(`   ⚠️  Pas du JSON valide\n`);
      }
    } else {
      console.log(`❌ ${response.status} - ${url}`);
    }
  } catch (error) {
    console.log(`❌ ERREUR - ${url}`);
    console.log(`   ${error.message}\n`);
  }
  return null;
}

// Tester toutes les URLs
Promise.all(urlsToTest.map(url => testUrl(url))).then(results => {
  const validUrls = results.filter(r => r !== null);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 RÉSUMÉ:');
  console.log(`   ${validUrls.length} URL(s) valide(s) trouvée(s)`);
  
  if (validUrls.length > 0) {
    console.log('\n✅ URL(s) fonctionnelle(s):');
    validUrls.forEach(url => console.log(`   - ${url}`));
  } else {
    console.log('\n❌ Aucune URL fonctionnelle trouvée');
    console.log('💡 Les modèles 3D ne sont peut-être pas distribués via CDN');
    console.log('💡 Solution alternative: Utiliser un CDN temporaire dans le code');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});