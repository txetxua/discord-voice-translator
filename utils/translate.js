const { Translate } = require('@google-cloud/translate').v2;
const path = require('path');
const dictionary = require('./dictionary');

const keyFilename = path.join(__dirname, '..', 'key.json');
const translateClient = new Translate({ keyFilename });

async function translateText(text, target) {
  const [translation] = await translateClient.translate(text, target);
  return translation;
}

async function autoTranslate(text, sourceLang) {
  const targetLang = sourceLang === 'es' ? 'it' : 'es';
  
  // Paso 1: traducción por diccionario (coloquial)
  const slangAdjusted = dictionary.translate(text, sourceLang);

  // Paso 2: traducción general
  const finalTranslation = await translateText(slangAdjusted, targetLang);
  return finalTranslation;
}

module.exports = {
  autoTranslate
};
