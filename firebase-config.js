export const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => value && !String(value).includes("COLE_AQUI")
);
