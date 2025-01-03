let messages = [];
let mediaFiles = {};
let isSearchVisible = false;

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupDragAndDrop();
    const scrollToTopBtn = document.getElementById('scrollToTop');
    const scrollToBottomBtn = document.getElementById('scrollToBottom');
    const chatContainer = document.getElementById('chatContainer');

    scrollToTopBtn.addEventListener('click', () => {
        chatContainer.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    scrollToBottomBtn.addEventListener('click', () => {
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    });

    chatContainer.addEventListener('scroll', () => {
        if (chatContainer.scrollTop > 100) {
            scrollToTopBtn.style.display = 'flex';
        } else {
            scrollToTopBtn.style.display = 'none';
        }

        if (chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight > 100) {
            scrollToBottomBtn.style.display = 'flex';
        } else {
            scrollToBottomBtn.style.display = 'none';
        }
    });
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
            
            for (const [filename, zipEntry] of Object.entries(contents.files)) {
                if (filename.endsWith('.txt')) {
                    console.log(`Found text file: ${filename}, loading content...`);
                    chatFileContent = await zipEntry.async('string');
                    console.log("Chat content loaded, length:", chatFileContent.length);
                    break; // Stop after finding the first text file
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
                console.error("No text file found in the zip");
                throw new Error('No text file found in the zip');
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
    if (!text || typeof text !== 'string') {
        console.error("Invalid input to parseMessages:", text);
        return [];
    }

    const lines = text.split('\n');
    const parsedMessages = [];
    let currentMessage = null;
    let isLegacyFormat = null;

    // Regular expressions for both formats
    const newFormatRegex = /\[(\d{1,2}\/\d{1,2}\/\d{4},\s\d{1,2}:\d{2}:\d{2})\]\s(.*?):\s(.*)/;
    const legacyFormatRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4},\s\d{1,2}:\d{2}(?::\d{2})?)\s-\s(.*?):\s(.*)/;

    function parseDate(dateString, isLegacy) {
        const [datePart, timePart] = dateString.split(', ');
        let [day, month, year] = datePart.split('/');
        const [hour, minute, second] = timePart.split(':');

        // Adjust year for legacy format
        if (isLegacy && year.length === 2) {
            year = '20' + year;
        }

        // JavaScript months are 0-indexed
        return new Date(year, month - 1, day, hour, minute, second || 0);
    }

    function parseLineWithRegex(line, regex, isLegacy) {
        const match = line.match(regex);
        if (match) {
            const [, dateTime, sender, content] = match;
            return {
                datetime: parseDate(dateTime, isLegacy),
                sender: sender.trim(),
                content: content.trim(),
                type: 'regular'
            };
        }
        return null;
    }

    lines.forEach((line, index) => {
        if (!line.trim()) return; // Skip empty lines

        let parsedLine = null;

        if (isLegacyFormat === null) {
            // Determine the format based on the first valid message
            parsedLine = parseLineWithRegex(line, newFormatRegex, false);
            if (parsedLine) {
                isLegacyFormat = false;
            } else {
                parsedLine = parseLineWithRegex(line, legacyFormatRegex, true);
                if (parsedLine) {
                    isLegacyFormat = true;
                }
            }
        } else {
            // Parse subsequent lines based on the determined format
            parsedLine = parseLineWithRegex(line, isLegacyFormat ? legacyFormatRegex : newFormatRegex, isLegacyFormat);
        }

        if (parsedLine) {
            if (currentMessage) {
                parsedMessages.push(currentMessage);
            }
            currentMessage = parsedLine;
        } else if (currentMessage) {
            currentMessage.content += '\n' + line.trim();
        } else {
            // If we can't parse it and it's not a continuation, treat it as a system message
            parsedMessages.push({
                datetime: new Date(),
                sender: 'System',
                content: line.trim(),
                type: 'system'
            });
        }
    });

    if (currentMessage) {
        parsedMessages.push(currentMessage);
    }

    console.log("Number of parsed messages:", parsedMessages.length);
    console.log("Format detected:", isLegacyFormat ? "Legacy" : "New");
    return parsedMessages;
}

const userColors = {};

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function renderMessages() {
    const chatContainer = document.getElementById("chatContainer");
    chatContainer.innerHTML = "";
    let currentDate = null;

    function formatDate(date) {
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 7) {
            return date.toLocaleDateString('en-US', { weekday: 'long' });
        } else {
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
        }
    }

    messages.forEach((msg) => {
        const formattedDate = formatDate(msg.datetime);
        
        if (formattedDate !== currentDate) {
            const dateDiv = document.createElement("div");
            dateDiv.className = "date-separator";
            const dateBubble = document.createElement("span");
            dateBubble.className = "date-bubble";
            dateBubble.textContent = formattedDate;
            dateDiv.appendChild(dateBubble);
            chatContainer.appendChild(dateDiv);
            currentDate = formattedDate;
        }

        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${msg.sender === "You" ? "outgoing" : "incoming"}`;

        const bubbleDiv = document.createElement("div");
        bubbleDiv.className = `bubble ${msg.type === 'system' ? "system" : (msg.sender === "You" ? "outgoing" : "incoming")}`;
        bubbleDiv.dir = "auto";

        const mediaMatch = msg.content.match(/<attached: (.+)>/);
        if (mediaMatch && mediaFiles[mediaMatch[1]]) {
            const img = document.createElement('img');
            img.src = mediaFiles[mediaMatch[1]];
            img.alt = 'Attached media';
            img.className = mediaMatch[1].endsWith('.webp') ? 'attached-sticker' : 'attached-image';
            bubbleDiv.appendChild(img);
        } else {
            const contentSpan = document.createElement('span');
            contentSpan.className = 'message-content';
            contentSpan.innerHTML = renderContentWithLinks(msg.content);
            bubbleDiv.appendChild(contentSpan);

            // Adjust bubble width after rendering
            setTimeout(() => {
                const contentWidth = contentSpan.offsetWidth;
                const maxWidth = bubbleDiv.offsetWidth;
                const minWidth = 60; // Minimum width in pixels
                if (contentWidth < maxWidth) {
                    bubbleDiv.style.width = `${Math.max(contentWidth + 40, minWidth)}px`;
                }
            }, 0);
        }

        if (msg.type !== 'system') {
            const senderDiv = document.createElement("div");
            senderDiv.className = "sender";
            senderDiv.textContent = msg.sender;
            senderDiv.dir = "auto";
            senderDiv.style.textAlign = "right";
            
            if (!userColors[msg.sender]) {
                userColors[msg.sender] = getRandomColor();
            }
            senderDiv.style.color = userColors[msg.sender];
            
            msgDiv.appendChild(senderDiv);
        }

        const timeDiv = document.createElement("div");
        timeDiv.className = "message-time";
        timeDiv.textContent = msg.datetime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        bubbleDiv.appendChild(timeDiv);
        msgDiv.appendChild(bubbleDiv);
        chatContainer.appendChild(msgDiv);
    });
    
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

function renderContentWithLinks(content) {
    // Regular expression to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Replace URLs with clickable links
    return content.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}
