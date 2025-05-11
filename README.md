# OkDates - Find the Perfect Date that Works for Everyone

OkDates is an intelligent event scheduling tool that makes it easy to find dates that work for everyone in your group. Built with Angular and Firebase, it features AI-powered date parsing to handle natural language input, making scheduling effortless.

## 🌟 Features

- **Simple Event Creation**: Create events with just a title and optional description
- **Shareable Links**: Unique links for participants and separate admin access
- **Natural Language Date Input**: Enter dates any way you want - "next Monday", "June 2-5", "6/15, 6/16", etc.
- **AI-Powered Date Parsing**: Utilizes LLMs (via OpenRouter API) to intelligently interpret date inputs
- **Visual Availability Overview**: See which dates work best for the whole group
- **Responsive Design**: Works great on mobile, tablet, and desktop

## 🚀 Live Demo

Visit [OkDates](https://okdates.web.app) to try it out!

## 🛠️ Technology Stack

- **Frontend**: Angular 19
- **Backend**: Firebase (Firestore, Cloud Functions, Storage)
- **AI Integration**: OpenRouter API for LLM-based date parsing
- **Authentication**: Anonymous authentication for simple user flow
- **Hosting**: Firebase Hosting
- **Security**: Firebase AppCheck with reCAPTCHA v3

## 🤔 How It Works

1. **Create an Event**: Add a title, description, and generate shareable links
2. **Share with Participants**: Send the participant link to everyone involved
3. **Collect Availability**: Participants enter their name and available dates in natural language
4. **Review Results**: Use the admin link to see which dates work for everyone

## 📋 Date Parsing Capabilities

The AI-powered date parser can handle various formats:
- Simple dates: "June 15", "6/15/2025"
- Ranges: "June 1-5", "June 1 to June 5"
- Days of week: "next Monday", "this weekend"
- Relative dates: "tomorrow", "next week"
- Combined formats: "June 15, July 3-5, and next Monday"

## 🔧 Local Development

### Prerequisites

- Node.js 18+
- Angular CLI
- Firebase CLI (for emulator and deployment)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/ugubser/okdates.git
   cd okdates
   ```

2. Install dependencies:
   ```bash
   npm install
   cd functions
   npm install
   cd ..
   ```

3. Set up Firebase:
   - Create a Firebase project
   - Enable Firestore and Cloud Functions
   - Copy your Firebase config to environment files
   - Set up Firebase AppCheck with reCAPTCHA v3:
     - Go to Firebase Console > AppCheck
     - Register a new reCAPTCHA v3 site key
     - Add the site key to your environment files in the `recaptcha.siteKey` field

4. Configure OpenRouter API (for AI features):
   - Get an API key from [OpenRouter](https://openrouter.ai)
   - Create a `functions/ai.config.json` using the template from `functions/ai.config.template.json`
   - Add your API key to the config file

5. Start development server:
   ```bash
   npm run start
   ```

6. Start Firebase emulators:
   ```bash
   npm run emulators
   ```

### Building and Deployment

```bash
# Build for production
ng build

# Deploy to Firebase
firebase deploy
```

## 📊 Project Structure

- `src/app/core`: Core models and services
- `src/app/modules`: Feature modules (event, participant, home)
- `functions/src`: Cloud Functions for handling server-side operations
- `functions/src/parsing`: AI-powered date parsing logic

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📜 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgements

- [Angular](https://angular.io/)
- [Firebase](https://firebase.google.com/)
- [OpenRouter](https://openrouter.ai)
- [Claude Code & Anthropic](https://docs.anthropic.com/en/docs/claude-code/overview)


- All icons and libraries used in this project