let messages = [];
let mediaFiles = {};
let isSearchVisible = false;
let searchMatches = [];
let currentMatchIndex = -1;
let chatFileName = '';

// Curated sender color palette - readable, distinct colors
const SENDER_COLORS = [
    '#e17076', '#7bc862', '#e5c441', '#65aadd', '#a695e7',
    '#ee7aae', '#6ec9cb', '#faa774', '#82b1ff', '#f48fb1',
    '#4fc3f7', '#aed581', '#ffb74d', '#ba68c8', '#4db6ac'
];

function getSenderColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupDragAndDrop();
    setupScrollButtons();
});

function setupScrollButtons() {
    const scrollToTopBtn = document.getElementById('scrollToTop');
    const scrollToBottomBtn = document.getElementById('scrollToBottom');
    const chatContainer = document.getElementById('chatContainer');

    scrollToTopBtn.addEventListener('click', () => {
        chatContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });

    scrollToBottomBtn.addEventListener('click', () => {
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    });

    chatContainer.addEventListener('scroll', () => {
        scrollToTopBtn.style.display = chatContainer.scrollTop > 100 ? 'flex' : 'none';
        const atBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight <= 100;
        scrollToBottomBtn.style.display = atBottom ? 'none' : 'flex';
    });
}

function setupEventListeners() {
    // File input
    const fileInput = document.getElementById('zipFile');
    fileInput.addEventListener('change', loadZipFile);

    // Search functionality
    const searchToggle = document.querySelector('.search-toggle');
    const searchBar = document.getElementById('searchBar');
    const searchBack = document.querySelector('.search-back');
    const searchInput = document.getElementById('searchQuery');
    const authorFilter = document.getElementById('authorFilter');

    searchToggle.addEventListener('click', () => {
        searchBar.style.display = 'block';
        searchInput.focus();
        isSearchVisible = true;
    });

    searchBack.addEventListener('click', closeSearch);

    searchInput.addEventListener('input', handleSearch);
    authorFilter.addEventListener('change', handleSearch);

    // Search keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                navigateMatch(-1);
            } else {
                navigateMatch(1);
            }
        } else if (e.key === 'Escape') {
            closeSearch();
        }
    });

    // Search nav buttons
    document.getElementById('searchPrev').addEventListener('click', () => navigateMatch(-1));
    document.getElementById('searchNext').addEventListener('click', () => navigateMatch(1));

    // File upload area click
    const fileUploadArea = document.getElementById('fileUploadArea');
    fileUploadArea.addEventListener('click', () => fileInput.click());

    // iPhone mode toggle
    document.getElementById('iphoneToggle').addEventListener('click', toggleIphoneMode);
    document.getElementById('exitIphoneBtn').addEventListener('click', toggleIphoneMode);
}

function closeSearch() {
    const searchBar = document.getElementById('searchBar');
    const searchInput = document.getElementById('searchQuery');
    const authorFilter = document.getElementById('authorFilter');

    searchBar.style.display = 'none';
    searchInput.value = '';
    authorFilter.value = '';
    clearHighlights();
    isSearchVisible = false;
    searchMatches = [];
    currentMatchIndex = -1;
    document.getElementById('searchNavRow').style.display = 'none';
}

function setupDragAndDrop() {
    const dropZone = document.getElementById('fileUploadArea');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('highlight'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('highlight'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/zip') {
            loadZipFile({ target: { files: files } });
        } else {
            alert('Please drop a ZIP file.');
        }
    }, false);
}

async function loadZipFile(event) {
    const file = event.target.files[0];
    if (!file) {
        alert('Please select a ZIP file');
        return;
    }

    // Extract chat name from filename
    chatFileName = file.name.replace('.zip', '');
    // WhatsApp exports: "WhatsApp Chat with Name.zip" or "WhatsApp Chat - Name.zip"
    const chatNameMatch = chatFileName.match(/WhatsApp Chat (?:with |[-–] )(.+)/i);
    if (chatNameMatch) {
        chatFileName = chatNameMatch[1].trim();
    }

    try {
        const zip = new JSZip();

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

        let chatFileContent = '';
        let totalFiles = Object.keys(contents.files).length;
        let processedFiles = 0;

        for (const [filename, zipEntry] of Object.entries(contents.files)) {
            if (filename.endsWith('.txt')) {
                chatFileContent = await zipEntry.async('string');
                break;
            } else if (filename.endsWith('.jpg') || filename.endsWith('.png') || filename.endsWith('.gif')) {
                loadImageInBackground(filename, zipEntry);
            }
            processedFiles++;
            const percent = Math.round((processedFiles / totalFiles) * 100);
            progressBar.value = percent;
            progressText.textContent = percent + '%';
        }

        if (chatFileContent) {
            messages = parseMessages(chatFileContent);
            renderMessages();
            populateAuthorFilter();

            document.getElementById('fileUploadArea').style.display = 'none';
            document.getElementById('chatContainer').style.display = 'block';
            // Show iPhone toggle now that we have messages
            document.getElementById('iphoneToggle').style.display = '';
        } else {
            throw new Error('No text file found in the zip');
        }

        progressBarContainer.style.display = 'none';
    } catch (error) {
        console.error('Error processing zip file:', error);
        alert('Error loading ZIP file: ' + error.message);
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
        return [];
    }

    const lines = text.split('\n');
    const parsedMessages = [];
    let currentMessage = null;
    let isLegacyFormat = null;

    const newFormatRegex = /\[(\d{1,2}\/\d{1,2}\/\d{4},\s\d{1,2}:\d{2}:\d{2})\]\s(.*?):\s(.*)/;
    const legacyFormatRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4},\s\d{1,2}:\d{2}(?::\d{2})?)\s-\s(.*?):\s(.*)/;

    function parseDate(dateString, isLegacy) {
        const [datePart, timePart] = dateString.split(', ');
        let [day, month, year] = datePart.split('/');
        const [hour, minute, second] = timePart.split(':');

        if (isLegacy && year.length === 2) {
            year = '20' + year;
        }

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

    lines.forEach((line) => {
        if (!line.trim()) return;

        let parsedLine = null;

        if (isLegacyFormat === null) {
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

    return parsedMessages;
}

function populateAuthorFilter() {
    const authorFilter = document.getElementById('authorFilter');
    const senders = new Set();
    messages.forEach(msg => {
        if (msg.type !== 'system') {
            senders.add(msg.sender);
        }
    });

    // Clear existing options except the first
    authorFilter.innerHTML = '<option value="">כל המשתתפים</option>';
    const sorted = Array.from(senders).sort();
    sorted.forEach(sender => {
        const option = document.createElement('option');
        option.value = sender;
        option.textContent = sender;
        authorFilter.appendChild(option);
    });
}

function renderMessages() {
    const chatContainer = document.getElementById("chatContainer");
    chatContainer.innerHTML = "";
    let currentDate = null;
    let prevSender = null;

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

    messages.forEach((msg, index) => {
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
            prevSender = null;
        }

        if (msg.type === 'system') {
            const sysDiv = document.createElement("div");
            sysDiv.className = "message";
            sysDiv.style.justifyContent = "center";
            const sysBubble = document.createElement("div");
            sysBubble.className = "bubble system";
            sysBubble.dir = "auto";
            sysBubble.textContent = msg.content;
            sysDiv.appendChild(sysBubble);
            chatContainer.appendChild(sysDiv);
            prevSender = null;
            return;
        }

        const isOutgoing = msg.sender === "You";
        const isSameSender = msg.sender === prevSender;
        const senderColor = getSenderColor(msg.sender);

        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${isOutgoing ? "outgoing" : "incoming"}`;
        msgDiv.dataset.sender = msg.sender;
        msgDiv.dataset.index = index;

        // Avatar for incoming messages
        if (!isOutgoing) {
            const avatarDiv = document.createElement("div");
            avatarDiv.className = "message-avatar" + (isSameSender ? " hidden" : "");
            avatarDiv.style.backgroundColor = senderColor;
            // Get initials (first letter of first and last word)
            const words = msg.sender.trim().split(/\s+/);
            const initials = words.length > 1
                ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                : msg.sender[0].toUpperCase();
            avatarDiv.textContent = initials;
            msgDiv.appendChild(avatarDiv);
        }

        // Message wrapper
        const wrapperDiv = document.createElement("div");
        wrapperDiv.className = "message-wrapper";

        // Bubble
        const bubbleDiv = document.createElement("div");
        bubbleDiv.className = `bubble ${isOutgoing ? "outgoing" : "incoming"}`;
        if (isSameSender) {
            bubbleDiv.classList.add('no-tail');
        }
        bubbleDiv.dir = "auto";

        // Sender name (only for incoming, first in group)
        if (!isOutgoing && !isSameSender) {
            const senderDiv = document.createElement("div");
            senderDiv.className = "sender";
            senderDiv.textContent = msg.sender;
            senderDiv.dir = "auto";
            senderDiv.style.color = senderColor;
            bubbleDiv.appendChild(senderDiv);
        }

        // Content
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
        }

        // Time
        const timeDiv = document.createElement("div");
        timeDiv.className = "message-time";
        timeDiv.textContent = msg.datetime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        bubbleDiv.appendChild(timeDiv);

        wrapperDiv.appendChild(bubbleDiv);
        msgDiv.appendChild(wrapperDiv);
        chatContainer.appendChild(msgDiv);

        prevSender = msg.sender;
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/* ===========================
   SEARCH
   =========================== */
function handleSearch() {
    const searchQuery = document.getElementById("searchQuery").value.toLowerCase().trim();
    const authorFilter = document.getElementById("authorFilter").value;

    clearHighlights();
    searchMatches = [];
    currentMatchIndex = -1;

    const hasQuery = searchQuery.length > 0;
    const hasAuthor = authorFilter.length > 0;

    if (!hasQuery && !hasAuthor) {
        document.getElementById('searchNavRow').style.display = 'none';
        return;
    }

    const messageElements = document.querySelectorAll(".message[data-sender]");

    messageElements.forEach((msgEl) => {
        const sender = msgEl.dataset.sender;
        const bubble = msgEl.querySelector(".bubble");
        if (!bubble) return;

        const senderMatch = !hasAuthor || sender === authorFilter;
        const textContent = bubble.textContent.toLowerCase();
        const textMatch = !hasQuery || textContent.includes(searchQuery);

        if (senderMatch && textMatch) {
            bubble.classList.add("search-highlight");
            searchMatches.push(bubble);
        }
    });

    // Show nav row and update counter
    const navRow = document.getElementById('searchNavRow');
    if (searchMatches.length > 0) {
        navRow.style.display = 'flex';
        currentMatchIndex = 0;
        updateMatchHighlight();
        searchMatches[0].scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
        navRow.style.display = 'flex';
        updateSearchCounter();
    }
}

function navigateMatch(direction) {
    if (searchMatches.length === 0) return;

    // Remove active highlight from current
    if (currentMatchIndex >= 0 && currentMatchIndex < searchMatches.length) {
        searchMatches[currentMatchIndex].classList.remove("search-highlight-active");
    }

    currentMatchIndex += direction;
    if (currentMatchIndex >= searchMatches.length) {
        currentMatchIndex = 0;
    } else if (currentMatchIndex < 0) {
        currentMatchIndex = searchMatches.length - 1;
    }

    updateMatchHighlight();
    searchMatches[currentMatchIndex].scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateMatchHighlight() {
    // Clear all active highlights
    document.querySelectorAll('.search-highlight-active').forEach(el => {
        el.classList.remove('search-highlight-active');
    });

    if (currentMatchIndex >= 0 && currentMatchIndex < searchMatches.length) {
        searchMatches[currentMatchIndex].classList.add("search-highlight-active");
    }

    updateSearchCounter();
}

function updateSearchCounter() {
    const counter = document.getElementById('searchCounter');
    if (searchMatches.length === 0) {
        counter.textContent = 'No results';
    } else {
        counter.textContent = `${currentMatchIndex + 1} of ${searchMatches.length}`;
    }
}

function clearHighlights() {
    document.querySelectorAll(".search-highlight, .search-highlight-active").forEach(element => {
        element.classList.remove("search-highlight", "search-highlight-active");
    });
}

/* ===========================
   IPHONE MODE
   =========================== */
function toggleIphoneMode() {
    const appContainer = document.getElementById('appContainer');
    const iphoneHeader = document.getElementById('iphoneHeader');
    const iosInputBar = document.getElementById('iosInputBar');
    const exitBtn = document.getElementById('exitIphoneBtn');
    const isActive = appContainer.classList.contains('iphone-mode');

    if (isActive) {
        // Exit iPhone mode
        appContainer.classList.remove('iphone-mode');
        document.body.classList.remove('iphone-bg');
        iphoneHeader.style.display = 'none';
        iosInputBar.style.display = 'none';
        exitBtn.style.display = 'none';
    } else {
        // Enter iPhone mode
        appContainer.classList.add('iphone-mode');
        document.body.classList.add('iphone-bg');
        iphoneHeader.style.display = 'block';
        iosInputBar.style.display = 'flex';
        exitBtn.style.display = 'flex';

        // Close search if open
        if (isSearchVisible) {
            closeSearch();
        }

        // Set contact name from filename
        const contactName = document.getElementById('iosContactName');
        const contactAvatar = document.getElementById('iosContactAvatar');
        contactName.textContent = chatFileName || 'Group Chat';

        // Set avatar initial
        const name = chatFileName || 'G';
        contactAvatar.textContent = name[0].toUpperCase();

        // Set current time in iOS format
        const now = new Date();
        document.getElementById('iosTime').textContent = now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: false
        });
    }
}

/* ===========================
   UTILITIES
   =========================== */
function renderContentWithLinks(content) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

window.loadZipFile = loadZipFile;
window.handleSearch = handleSearch;
