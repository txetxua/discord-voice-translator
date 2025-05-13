const prism = require("prism-media");
const { EndBehaviorType } = require("@discordjs/voice");
const { speechClient, translateClient } = require("./googleCloud");
const { replaceSlang } = require("./slangTranslator");

async function transcribeAndTranslate(connection, textChannel, config) {
  const receiver = connection.receiver;

  receiver.speaking.on("start", userId => {
    const opusStream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 },
    });

    const pcmStream = new prism.opus.Decoder({ rate: 16000, channels: 1, frameSize: 960 });
    opusStream.pipe(pcmStream);

    let audioChunks = [];

    pcmStream.on("data", chunk => {
      audioChunks.push(chunk);
    });

    pcmStream.on("end", async () => {
      const audioBuffer = Buffer.concat(audioChunks);

      const audio = {
        content: audioBuffer.toString("base64"),
      };

      const request = {
        config: {
          encoding: "LINEAR16",
          sampleRateHertz: 16000,
          languageCode: "es-IT", // auto detect among es/it
          alternativeLanguageCodes: ["es", "it"],
        },
        audio,
      };

      try {
        const [response] = await speechClient.recognize(request);
        const transcription = response.results.map(r => r.alternatives[0].transcript).join("\n");

        if (!transcription) return;

        const detectedLang = response.results[0].languageCode.startsWith("es") ? "es" : "it";
        const targetLang = detectedLang === "es" ? "it" : "es";

        const [translation] = await translateClient.translateText({
          parent: `projects/${process.env.GOOGLE_PROJECT_ID}/locations/global`,
          contents: [transcription],
          mimeType: "text/plain",
          sourceLanguageCode: detectedLang,
          targetLanguageCode: targetLang,
        });

        const slangCorrected = replaceSlang(translation.translations[0].translatedText, detectedLang, targetLang);

        await textChannel.send(`💬 (${detectedLang} ➡️ ${targetLang}) ${slangCorrected}`);
      } catch (err) {
        console.error("Transcripción fallida:", err);
      }
    });
  });
}

module.exports = { transcribeAndTranslate };
