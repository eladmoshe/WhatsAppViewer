let messages = [];
let mediaFiles = {};

document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('zipFile');
    fileInput.addEventListener('change', loadZipFile);
});

async function loadZipFile(event) {
    console.log("loadZipFile function called");
    const file = event.target.files[0];
    if (file) {
        console.log("File selected:", file.name);
        try {
            const zip = new JSZip();
            console.log("Loading zip file...");
            
            // Show progress bar
            const progressBarContainer = document.getElementById('progressBarContainer');
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');
            progressBarContainer.style.display = 'block';
            
            const contents = await zip.loadAsync(file, {
                onprogress: (metadata) => {
                    const percent = Math.round(metadata.percent);
                    progressBar.value = percent;
                    progressText.textContent = percent + '%';
                }
            });
            console.log("Zip file loaded successfully");
            
            let chatFileContent = '';
            let totalFiles = Object.keys(contents.files).length;
            let processedFiles = 0;
            
            console.log("Files in the zip:", Object.keys(contents.files));
            
            for (const [filename, zipEntry] of Object.entries(contents.files)) {
                console.log("Processing file:", filename);
                if (filename === '_chat.txt') {
                    console.log("Found _chat.txt, loading content...");
                    chatFileContent = await zipEntry.async('string');
                    console.log("Chat content loaded, length:", chatFileContent.length);
                } else if (filename.endsWith('.jpg') || filename.endsWith('.png') || filename.endsWith('.gif')) {
                    // Load images in the background
                    loadImageInBackground(filename, zipEntry);
                }
                processedFiles++;
                const percent = Math.round((processedFiles / totalFiles) * 100);
                progressBar.value = percent;
                progressText.textContent = percent + '%';
            }
            
            if (chatFileContent) {
                console.log("Chat content sample:", chatFileContent.substring(0, 200));
                console.log("Parsing chat content...");
                messages = parseMessages(chatFileContent);
                console.log("Parsed messages count:", messages.length);
                console.log("First 5 parsed messages:", messages.slice(0, 5));
                console.log("Rendering messages...");
                renderMessages();
            } else {
                console.error("No _chat.txt file found in the zip");
                throw new Error('No _chat.txt file found in the zip');
            }
            
            // Hide progress bar
            progressBarContainer.style.display = 'none';
        } catch (error) {
            console.error('Error processing zip file:', error);
            alert('Error loading ZIP file: ' + error.message);
        }
    } else {
        console.log("No file selected");
        alert('Please select a ZIP file');
    }
}

function loadImageInBackground(filename, zipEntry) {
    zipEntry.async('blob').then(blob => {
        mediaFiles[filename] = URL.createObjectURL(blob);
    }).catch(error => {
        console.error("Error loading media file:", filename, error);
    });
}

function parseMessages(text) {
    const lines = text.split('\n');
    const parsedMessages = [];

    lines.forEach((line, index) => {
        const match = line.match(/^\[(\d{2}\/\d{2}\/\d{4},\s\d{1,2}:\d{2}:\d{2})\]\s(.+?):\s(.+)$/);
        if (match) {
            parsedMessages.push({
                datetime: match[1],
                sender: match[2].trim(),
                content: match[3].trim(),
                type: 'regular'
            });
        } else if (line.trim() !== '') {
            // This might be a system message or other non-standard format
            parsedMessages.push({
                datetime: '',
                sender: 'System',
                content: line.trim(),
                type: 'system'
            });
        }
    });

    console.log("Number of parsed messages:", parsedMessages.length);
    return parsedMessages;
}

function renderMessages() {
    console.log("Rendering messages, count:", messages.length);
    const chatContainer = document.getElementById("chatContainer");
    chatContainer.innerHTML = "";
    messages.forEach((msg, index) => {
        console.log(`Rendering message ${index + 1}:`, msg);
        const msgDiv = document.createElement("div");
        msgDiv.className = "message";

        const timestampDiv = document.createElement("div");
        timestampDiv.className = "timestamp";
        timestampDiv.textContent = msg.datetime;

        const bubbleDiv = document.createElement("div");
        bubbleDiv.className = `bubble ${msg.type === 'system' ? "system" : (msg.sender === "You" ? "outgoing" : "incoming")}`;
        
        // Check if the content is an image file
        const imageMatch = msg.content.match(/<attached: (.+)>/);
        if (imageMatch && mediaFiles[imageMatch[1]]) {
            console.log(`Rendering image for message ${index + 1}:`, imageMatch[1]);
            const img = document.createElement('img');
            img.src = mediaFiles[imageMatch[1]];
            img.alt = 'Attached image';
            img.className = 'attached-image';
            bubbleDiv.appendChild(img);
        } else {
            // Use textContent to prevent XSS
            bubbleDiv.textContent = msg.content;
        }

        const senderDiv = document.createElement("div");
        senderDiv.className = "sender";
        senderDiv.textContent = msg.sender;

        msgDiv.appendChild(timestampDiv);
        if (msg.type !== 'system') {
            msgDiv.appendChild(senderDiv);
        }
        msgDiv.appendChild(bubbleDiv);
        chatContainer.appendChild(msgDiv);
    });
    console.log("Finished rendering messages");
}

function handleSearch() {
    console.log("Search function called");
    const searchQuery = document.getElementById("searchQuery").value.toLowerCase();
    console.log("Search query:", searchQuery);
    const messageElements = document.querySelectorAll(".bubble");
    let found = false;
    
    messageElements.forEach((element, index) => {
        element.classList.remove("highlight");
        if (element.textContent.toLowerCase().includes(searchQuery)) {
            console.log(`Match found in message ${index + 1}`);
            element.classList.add("highlight");
            if (!found) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
                found = true;
            }
        }
    });
    
    console.log("Search completed, matches found:", found);
}

// Make sure these functions are in the global scope
window.loadZipFile = loadZipFile;
window.handleSearch = handleSearch;

console.log("Script loaded and ready");
