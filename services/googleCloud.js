const speech = require("@google-cloud/speech").v1p1beta1;
const { TranslationServiceClient } = require("@google-cloud/translate").v3;

const speechClient = new speech.SpeechClient();
const translateClient = new TranslationServiceClient();

module.exports = {
  speechClient,
  translateClient
};
