// Telegram Bot setup script
// Run this once to set up the web app URL in your bot

const BOT_TOKEN = '7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I';
const WEB_APP_URL = 'https://your-app-name.netlify.app'; // Replace with your Netlify URL

async function setWebAppUrl() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commands: [
          {
            command: 'start',
            description: 'Запустить игру'
          },
          {
            command: 'play',
            description: 'Играть'
          }
        ]
      })
    });

    const data = await response.json();
    console.log('Commands set:', data);
  } catch (error) {
    console.error('Error setting commands:', error);
  }
}

// You can also manually set the menu button via BotFather or use this:
async function setMenuButton() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '🎮 Играть',
          web_app: {
            url: WEB_APP_URL
          }
        }
      })
    });

    const data = await response.json();
    console.log('Menu button set:', data);
  } catch (error) {
    console.error('Error setting menu button:', error);
  }
}

// Uncomment to run:
// setWebAppUrl();
// setMenuButton();

