const fs = require('fs');
const path = require('path');

const dictionaries = {
  es: {
    gaming: [
      "campear", "hacer ragequit", "nerfear", "buffear", "tryhard", "noob", "smurf", "GG", "glitchear", "farmear"
    ],
    calle: [
      "qué pasa loco", "todo bien hermano", "tirar barra", "dar el palo", "hacer la movida", "pillar cacho", "meterse en líos"
    ],
    sexo: [
      "echar un polvo", "irse al catre", "hacer el amor", "darle duro", "ponerse a tono", "estar caliente", "ligar"
    ],
    insultos: [
      "capullo", "gilipollas", "tonto del culo", "payaso", "subnormal", "pendejo", "hijo de puta"
    ]
  },
  it: {
    gaming: [
      "camperare", "fare ragequit", "nerfare", "buffare", "tryhard", "niubbo", "smurfare", "GG", "glitchare", "farmare"
    ],
    calle: [
      "che succede fratè", "tutto a posto fratello", "sparare rime", "fare il colpo", "fare la mossa", "cuccare", "cacciarsi nei guai"
    ],
    sexo: [
      "scopare", "andare a letto", "fare l'amore", "darci dentro", "andare su di giri", "essere arrapato", "rimorchiare"
    ],
    insultos: [
      "stronzo", "coglione", "testa di cazzo", "pagliaccio", "ritardato", "pischello", "figlio di puttana"
    ]
  }
};

// Traducción básica usando diccionarios de jerga
function translate(text, sourceLang) {
  const targetLang = sourceLang === 'es' ? 'it' : 'es';
  const sourceDict = dictionaries[sourceLang];
  const targetDict = dictionaries[targetLang];
  let result = text;

  Object.keys(sourceDict).forEach(category => {
    sourceDict[category].forEach((phrase, index) => {
      const translation = targetDict[category][index];
      const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
      result = result.replace(regex, translation);
    });
  });

  return result;
}

module.exports = {
  translate,
  dictionaries
};
