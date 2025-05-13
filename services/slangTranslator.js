const fs = require("fs-extra");
const path = require("path");

function loadSlang(language, category) {
  const filepath = path.join(__dirname, "..", "dictionaries", language, `${category}.json`);
  return fs.readJSONSync(filepath);
}

function replaceSlang(text, fromLang, toLang) {
  const categories = ["gaming", "jerga", "sexo", "insultos"];
  let newText = text;

  for (const cat of categories) {
    const fromDict = loadSlang(fromLang, cat);
    const toDict = loadSlang(toLang, cat);

    Object.entries(fromDict).forEach(([key, value]) => {
      const regex = new RegExp(`\\b${key}\\b`, "gi");
      if (regex.test(newText)) {
        const translated = toDict[value] || value;
        newText = newText.replace(regex, translated);
      }
    });
  }

  return newText;
}

module.exports = { replaceSlang };
