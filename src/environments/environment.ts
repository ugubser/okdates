export const environment = {
  production: false,
  firebase: {
    apiKey: "demo-api-key",
    authDomain: "demo-project-id.firebaseapp.com",
    projectId: "okdates",
    storageBucket: "demo-project-id.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
  },
  useEmulators: true,
  emulators: {
    functions: "http://localhost:5001",
    firestore: "localhost:8081"
  }
};