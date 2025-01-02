# WhatsApp Chat Viewer

This project is a simple, web-based WhatsApp chat viewer. It allows users to view a WhatsApp conversation in a format similar to the WhatsApp interface, with the ability to search through messages.

## Features

- Display WhatsApp-style chat messages
- Right-to-left (RTL) layout for Hebrew text
- Search functionality to find and highlight specific messages
- Responsive design for various screen sizes

## Live Demo

You can view a live demo of this project at: `https://eladmoshe.github.io/WhatsAppViewer/`

## How to Run

To run this project locally or deploy it to your own GitHub Pages, follow these steps:

1. Clone the repository:
   ```
   git clone https://github.com/eladmoshe/WhatsAppViewer.git
   cd WhatsAppViewer
   ```

2. Open `index.html` in your web browser to view the project locally.

3. To deploy to GitHub Pages:
   - Push your changes to GitHub:
     ```
     git add .
     git commit -m "Your commit message"
     git push origin main
     ```
   - Go to your repository's settings on GitHub
   - Scroll down to the "GitHub Pages" section
   - Under "Source", select the branch you want to use (usually "main" or "master")
   - Click "Save"

Your project will now be live at `https://eladmoshe.github.io/WhatsAppViewer/`

## Customization

To customize the chat data:

1. Edit the `chat_data.json` file to include your own chat messages.
2. Each message should follow this format:
   ```json
   {
     "datetime": "YYYY-MM-DD HH:MM",
     "sender": "Name",
     "content": "Message content"
   }
   ```
3. Messages with "sender" set to "You" will be displayed as outgoing messages (right-aligned).

To modify the appearance:

1. Edit the `styles.css` file to change colors, fonts, or layout.

To add or modify functionality:

1. Edit the `script.js` file to add new features or change existing behavior.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).
