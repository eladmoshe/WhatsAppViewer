let messages = [];

window.addEventListener('load', () => {
    loadChatData();
});

function loadChatData() {
    fetch('chat_data.json')
        .then(response => response.json())
        .then(data => {
            messages = data;
            renderMessages();
        })
        .catch(error => console.error("Error loading chat data:", error));
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

        msgDiv.appendChild(timestampDiv);
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