export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSyDummyApiKeyForDevelopment",
    authDomain: "something.web.app",
    projectId: "something",
    storageBucket: "something.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000"
  },
  useEmulators: true,
  emulators: {
    functions: "http://localhost:5001",
    firestore: "localhost:8081"
  }
};