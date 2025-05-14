# OkDates - Find the Perfect Date & Time for Events and Meetings

OkDates is an intelligent scheduling tool that makes it easy to find dates and times that work for everyone in your group. Whether you're planning day-long events or time-specific meetings, OkDates has you covered. Built with Angular and Firebase, it features AI-powered date and time parsing to handle natural language input, making scheduling effortless.

## 🌟 Features

- **Flexible Scheduling Options**: Create both day-events and time-specific meetings
- **Simple Creation Process**: Set up your event or meeting with just a title and optional description
- **Shareable Links**: Unique links for participants and separate admin access
- **Natural Language Input**: Enter availability any way you want - "next Monday at 2pm", "June 2-5", "6/15 from 10-3", "all day July 10", etc.
- **AI-Powered Parsing**: Utilizes LLMs (via OpenRouter API) to intelligently interpret date and time inputs
- **Visual Availability Overview**: See which dates and times work best for the whole group
- **Responsive Design**: Works great on mobile, tablet, and desktop

## 🚀 Live Demo

Visit [OkDates](https://okdates.web.app) to try it out!

## 🛠️ Technology Stack

- **Frontend**: Angular 19
- **Backend**: Firebase (Firestore, Cloud Functions, Storage)
- **AI Integration**: OpenRouter API for LLM-based date and time parsing
- **Authentication**: Anonymous authentication for simple user flow
- **Hosting**: Firebase Hosting
- **Security**: Firebase AppCheck with reCAPTCHA v3

## 🤔 How It Works

1. **Create an Event or Meeting**: Add a title, description, and generate shareable links, retain the Administrator link
2. **Share with Participants**: Send the participant link to everyone involved
3. **Collect Availability**: Participants enter their name and available dates/times in natural language
4. **Review Results**: Use the admin link to see which dates and times work for everyone, download the .ics file and send via email to every participant

## 📋 Date & Time Parsing Capabilities

The AI-powered parser can handle various formats:
- Simple dates: "June 15", "6/15/2025"
- Date ranges: "June 1-5", "June 1 to June 5"
- All-day events: "all day June 15", "whole day on the 20th"
- Specific times: "2pm", "14:00", "morning", "afternoon"
- Time ranges: "9am-11am", "between 2 and 4pm" 
- Days of week with times: "next Monday at 2pm", "Tuesdays 10-12"
- Relative dates: "tomorrow afternoon", "next week mornings"
- Combined formats: "June 15 at 3pm, July 3-5 all day, and next Monday 2-4pm"

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

5. Start firebase local emulator server:
   ```bash
   ./start-emulator.sh
   ```

### Building and Deployment

```bash
# Build for production
npm run build:prod

# Deploy to Firebase
firebase deploy
```

## 📊 Project Structure

- `src/app/core`: Core models and services
- `src/app/modules`: Feature modules (event, participant, home)
- `functions/src`: Cloud Functions for handling server-side operations
- `functions/src/parsing`: AI-powered date and time parsing logic

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