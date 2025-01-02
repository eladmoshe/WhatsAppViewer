let messages = [];
let mediaFiles = {};
let isSearchVisible = false;

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupDragAndDrop();
});

function setupEventListeners() {
    // File input
    const fileInput = document.getElementById('zipFile');
    fileInput.addEventListener('change', loadZipFile);

    // Search functionality
    const searchToggle = document.querySelector('.search-toggle');
    const searchBar = document.querySelector('.search-bar');
    const searchBack = document.querySelector('.search-back');
    const searchInput = document.getElementById('searchQuery');

    searchToggle.addEventListener('click', () => {
        searchBar.style.display = 'block';
        searchInput.focus();
        isSearchVisible = true;
    });

    searchBack.addEventListener('click', () => {
        searchBar.style.display = 'none';
        searchInput.value = '';
        clearHighlights();
        isSearchVisible = false;
    });

    searchInput.addEventListener('input', handleSearch);

    // Scroll to bottom button
    const scrollButton = document.getElementById('scrollToBottom');
    const chatContainer = document.getElementById('chatContainer');

    chatContainer.addEventListener('scroll', () => {
        const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
        scrollButton.style.display = isNearBottom ? 'none' : 'flex';
    });

    scrollButton.addEventListener('click', () => {
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    });

    // File upload area click
    const fileUploadArea = document.getElementById('fileUploadArea');
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });
}

function setupDragAndDrop() {
    const dropZone = document.getElementById('fileUploadArea');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    dropZone.addEventListener('drop', handleDrop, false);

    function highlight(e) {
        dropZone.classList.add('highlight');
    }

    function unhighlight(e) {
        dropZone.classList.remove('highlight');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0 && files[0].type === 'application/zip') {
            loadZipFile({ target: { files: files } });
        } else {
            alert('Please drop a ZIP file.');
        }
    }
}

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
                console.log("Parsing chat content...");
                messages = parseMessages(chatFileContent);
                console.log("Parsed messages count:", messages.length);
                console.log("Rendering messages...");
                renderMessages();
                
                // Hide file upload area and show chat container
                document.getElementById('fileUploadArea').style.display = 'none';
                document.getElementById('chatContainer').style.display = 'block';
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
    let lastSender = '';
    let lastDatetime = '';

    lines.forEach((line, index) => {
        const match = line.match(/^\[(\d{2}\/\d{2}\/\d{4},\s\d{1,2}:\d{2}:\d{2})\]\s(.+?):\s(.+)$/);
        if (match) {
            lastDatetime = match[1];
            lastSender = match[2].trim();
            parsedMessages.push({
                datetime: lastDatetime,
                sender: lastSender,
                content: match[3].trim(),
                type: 'regular'
            });
        } else if (line.trim() !== '') {
            // This might be a continuation of the previous message or a standalone message
            if (lastSender) {
                parsedMessages.push({
                    datetime: lastDatetime,
                    sender: lastSender,
                    content: line.trim(),
                    type: 'standalone'
                });
            } else {
                // If we don't have a last sender, treat it as a system message
                parsedMessages.push({
                    datetime: '',
                    sender: 'System',
                    content: line.trim(),
                    type: 'system'
                });
            }
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
        if (msg.type !== 'system' && msg.type !== 'standalone') {
            msgDiv.appendChild(senderDiv);
        }
        msgDiv.appendChild(bubbleDiv);
        chatContainer.appendChild(msgDiv);
    });
    console.log("Finished rendering messages");
    
    // Scroll to bottom after rendering
    chatContainer.scrollTop = chatContainer.scrollHeight;
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

function clearHighlights() {
    const highlightedElements = document.querySelectorAll(".highlight");
    highlightedElements.forEach(element => {
        element.classList.remove("highlight");
    });
}

// Make sure these functions are in the global scope
window.loadZipFile = loadZipFile;
window.handleSearch = handleSearch;

console.log("Script loaded and ready");
