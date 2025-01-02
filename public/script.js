let messages = [];

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
        fetch(`/proxy?url=${encodeURIComponent(url)}`)
            .then(response => response.text())
            .then(data => {
                messages = parseWhatsAppChat(data);
                renderMessages();
            })
            .catch(error => {
                console.error("Error loading chat data:", error);
                alert("שגיאה בטעינת הנתונים. אנא ודא שהקישור תקין ושהקובץ נגיש.");
            });
    } else {
        alert("אנא הכנס קישור לקובץ Google Drive.");
    }
}

function parseWhatsAppChat(chatText) {
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
        bubbleDiv.textContent = msg.content;

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
