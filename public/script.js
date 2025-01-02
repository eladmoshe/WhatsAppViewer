import JSZip from 'jszip';

let messages = [];
let mediaFiles = {};

window.addEventListener('load', () => {
    loadSavedUrl();
});

function loadSavedUrl() {
    const savedUrl = localStorage.getItem('driveUrl');
    if (savedUrl) {
        document.getElementById('driveUrl').value = savedUrl;
        loadChatData();
    }
}

function saveUrl() {
    const url = document.getElementById('driveUrl').value;
    localStorage.setItem('driveUrl', url);
    loadChatData();
}

function loadChatData() {
    const url = document.getElementById('driveUrl').value;
    if (url) {
        console.log("Attempting to fetch URL:", url);
        fetch(`/proxy?url=${encodeURIComponent(url)}`)
            .then(response => {
                console.log("Response status:", response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                console.log("Received data:", data.substring(0, 100) + "..."); // Log first 100 characters
                if (data.startsWith('<!DOCTYPE html>')) {
                    throw new Error('Received HTML instead of chat data. Make sure the file is publicly accessible.');
                }
                messages = parseWhatsAppChat(data);
                console.log("Parsed messages:", messages.length);
                renderMessages();
            })
            .catch(error => {
                console.error("Error loading chat data:", error);
                alert("שגיאה בטעינת הנתונים: " + error.message);
            });
    } else {
        alert("אנא הכנס קישור לקובץ Google Drive.");
    }
}

function parseWhatsAppChat(chatText) {
    console.log("Parsing chat text:", chatText.substring(0, 100) + "..."); // Log first 100 characters
    const lines = chatText.split('\n');
    const messages = [];
    let currentMessage = null;

    const dateRegex = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4},?\s\d{1,2}:\d{2}(?::\d{2})?(?:\s[AP]M)?)\]?\s-\s/;
    const senderRegex = /^(.*?):\s/;

    lines.forEach(line => {
        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
            if (currentMessage) {
                messages.push(currentMessage);
            }
            const [, datetime] = dateMatch;
            const remainingContent = line.slice(dateMatch[0].length);
            const senderMatch = remainingContent.match(senderRegex);
            let sender = "Unknown";
            let content = remainingContent;
            if (senderMatch) {
                sender = senderMatch[1];
                content = remainingContent.slice(senderMatch[0].length);
            }
            currentMessage = { datetime, sender, content };
        } else if (currentMessage) {
            currentMessage.content += '\n' + line;
        }
    });

    if (currentMessage) {
        messages.push(currentMessage);
    }

    return messages;
}

function renderMessages() {
    console.log("Rendering messages:", messages.length);
    const chatContainer = document.getElementById("chatContainer");
    chatContainer.innerHTML = "";
    messages.forEach((msg) => {
        const msgDiv = document.createElement("div");
        msgDiv.className = "message";

        const timestampDiv = document.createElement("div");
        timestampDiv.className = "timestamp";
        timestampDiv.textContent = msg.datetime;

        const bubbleDiv = document.createElement("div");
        bubbleDiv.className = `bubble ${msg.sender === "You" ? "outgoing" : "incoming"}`;
        
        // Check if the content is an image file
        const imageMatch = msg.content.match(/<attached: (.+)>/);
        if (imageMatch && mediaFiles[imageMatch[1]]) {
            const img = document.createElement('img');
            img.src = mediaFiles[imageMatch[1]];
            img.alt = 'Attached image';
            img.className = 'attached-image';
            bubbleDiv.appendChild(img);
        } else {
            bubbleDiv.textContent = msg.content;
        }

        const senderDiv = document.createElement("div");
        senderDiv.className = "sender";
        senderDiv.textContent = msg.sender;

        msgDiv.appendChild(timestampDiv);
        msgDiv.appendChild(senderDiv);
        msgDiv.appendChild(bubbleDiv);
        chatContainer.appendChild(msgDiv);
    });
}

function handleSearch() {
    const searchQuery = document.getElementById("searchQuery").value.toLowerCase();
    const messageElements = document.querySelectorAll(".bubble");
    let found = false;
    
    messageElements.forEach((element) => {
        element.classList.remove("highlight");
        if (element.textContent.toLowerCase().includes(searchQuery)) {
            element.classList.add("highlight");
            if (!found) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
                found = true;
            }
        }
    });
}

async function loadZipFile() {
    const fileInput = document.getElementById('zipFile');
    const file = fileInput.files[0];
    if (file) {
        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(file);
            
            let chatFileContent = '';
            
            for (const [filename, zipEntry] of Object.entries(contents.files)) {
                if (filename.endsWith('.txt')) {
                    chatFileContent = await zipEntry.async('string');
                } else if (filename.endsWith('.jpg') || filename.endsWith('.png') || filename.endsWith('.gif')) {
                    const blob = await zipEntry.async('blob');
                    mediaFiles[filename] = URL.createObjectURL(blob);
                }
            }
            
            if (chatFileContent) {
                messages = parseWhatsAppChat(chatFileContent);
                renderMessages();
            } else {
                throw new Error('No chat file found in the zip');
            }
        } catch (error) {
            console.error('Error processing zip file:', error);
            alert('שגיאה בטעינת קובץ ה-ZIP: ' + error.message);
        }
    } else {
        alert('אנא בחר קובץ ZIP');
    }
}

// Make sure to expose the loadZipFile function to the global scope
window.loadZipFile = loadZipFile;
