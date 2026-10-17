export const firebaseConfig = {
  apiKey: "AIzaSyB1tU_V4mn269jsfroJyqbPPeXbFijWYsc",
  authDomain: "l-engenharia---diario-de-obra.firebaseapp.com",
  projectId: "l-engenharia---diario-de-obra",
  storageBucket: "l-engenharia---diario-de-obra.firebasestorage.app",
  messagingSenderId: "757202700811",
  appId: "1:757202700811:web:d1c6ef6bfe8055caf0550e",
  measurementId: "G-BLQVP70HW5"
};

export const cloudinaryConfig = {
  cloudName: "loan1csk",
  uploadPreset: "diario_obra_lengenharia"
};

export const isFirebaseConfigured = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId
].every((value) => value && !String(value).includes("COLE_AQUI"));

export const isCloudinaryConfigured = [
  cloudinaryConfig.cloudName,
  cloudinaryConfig.uploadPreset
].every((value) => value && !String(value).includes("COLE_AQUI"));
