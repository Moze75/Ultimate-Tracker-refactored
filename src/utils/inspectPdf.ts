import { PDFDocument } from 'pdf-lib';

export async function inspectPdfFields() {
  try {
    // On charge le PDF depuis le dossier public
    const formUrl = '/FDP/eFeuillePersoDD2024.pdf';
    const formPdfBytes = await fetch(formUrl).then(res => res.arrayBuffer());

    const pdfDoc = await PDFDocument.load(formPdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log('--- DÉBUT ANALYSE PDF ---');
    console.log(`Nombre de champs trouvés : ${fields.length}`);
    
    fields.forEach(field => {
      const type = field.constructor.name;
      const name = field.getName();
      console.log(`Type: ${type} | Nom: ${name}`);
    });
    console.log('--- FIN ANALYSE PDF ---');
    
    return fields.map(f => f.getName());
  } catch (err) {
    console.error("Erreur lors de l'inspection du PDF:", err);
  }
}