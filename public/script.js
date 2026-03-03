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

// Yield to the browser so UI updates (progress label/bar) actually paint
function yieldToUI() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

async function updateProgress(label, percent) {
    const progressLabel = document.getElementById('progressLabel');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    progressLabel.textContent = label;
    if (percent !== undefined) {
        progressBar.value = percent;
        progressText.textContent = percent + '%';
        progressBar.style.display = '';
        progressText.style.display = '';
    } else {
        // Indeterminate mode — hide bar, just show label
        progressBar.style.display = 'none';
        progressText.style.display = 'none';
    }
}

async function loadZipFile(event) {
    const file = event.target.files[0];
    if (!file) {
        alert('Please select a ZIP file');
        return;
    }

    // Extract chat name from filename
    chatFileName = file.name.replace('.zip', '');
    const chatNameMatch = chatFileName.match(/WhatsApp Chat (?:with |[-–] )(.+)/i);
    if (chatNameMatch) {
        chatFileName = chatNameMatch[1].trim();
    }

    try {
        const zip = new JSZip();
        const progressBarContainer = document.getElementById('progressBarContainer');
        progressBarContainer.style.display = 'block';

        // Phase 1: Reading ZIP file
        await updateProgress('...קורא קובץ ZIP', 0);
        const contents = await zip.loadAsync(file, {
            onprogress: (metadata) => {
                const percent = Math.round(metadata.percent);
                updateProgress('...קורא קובץ ZIP', percent);
            }
        });

        // Phase 2: Extracting files
        await updateProgress('...מחלץ קבצים', 0);
        await yieldToUI();

        let chatFileContent = '';
        const totalFiles = Object.keys(contents.files).length;
        let processedFiles = 0;
        const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.3gp', '.opus', '.ogg', '.m4a', '.pdf'];
        const mediaLoadPromises = [];

        for (const [filename, zipEntry] of Object.entries(contents.files)) {
            if (filename.endsWith('.txt')) {
                chatFileContent = await zipEntry.async('string');
            } else if (mediaExtensions.some(ext => filename.toLowerCase().endsWith(ext))) {
                mediaLoadPromises.push(loadMediaFile(filename, zipEntry));
            }
            processedFiles++;
            const percent = Math.round((processedFiles / totalFiles) * 100);
            await updateProgress('...מחלץ קבצים', percent);
        }

        // Phase 3: Loading media
        if (mediaLoadPromises.length > 0) {
            let loadedMedia = 0;
            const totalMedia = mediaLoadPromises.length;
            await updateProgress(`...טוען מדיה (0/${totalMedia})`, 0);
            await yieldToUI();

            const trackedPromises = mediaLoadPromises.map(p =>
                p.then(() => {
                    loadedMedia++;
                    const percent = Math.round((loadedMedia / totalMedia) * 100);
                    updateProgress(`(${loadedMedia}/${totalMedia}) ...טוען מדיה`, percent);
                })
            );
            await Promise.all(trackedPromises);
        }

        if (!chatFileContent) {
            throw new Error('No text file found in the zip');
        }

        // Phase 4: Parsing messages
        await updateProgress('...מעבד הודעות');
        await yieldToUI();
        messages = parseMessages(chatFileContent);

        // Phase 5: Rendering
        await updateProgress(`...מציג ${messages.length.toLocaleString()} הודעות`);
        await yieldToUI();
        renderMessages();
        populateAuthorFilter();

        document.getElementById('fileUploadArea').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'block';
        document.getElementById('iphoneToggle').style.display = '';
        document.getElementById('desktopInputBar').style.display = '';

        progressBarContainer.style.display = 'none';
    } catch (error) {
        console.error('Error processing zip file:', error);
        document.getElementById('progressBarContainer').style.display = 'none';
        alert('Error loading ZIP file: ' + error.message);
    }
}

async function loadMediaFile(filename, zipEntry) {
    try {
        const blob = await zipEntry.async('blob');
        mediaFiles[filename] = URL.createObjectURL(blob);
    } catch (error) {
        console.error("Error loading media file:", filename, error);
    }
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
        // Match <attached: filename> with optional invisible Unicode marks (LTR/RTL)
        const mediaMatch = msg.content.match(/[\u200e\u200f]*<[\u200e\u200f]*attached: (.+?)>[\u200e\u200f]*/);
        const mediaUrl = mediaMatch ? mediaFiles[mediaMatch[1]] : null;
        if (mediaMatch && mediaUrl) {
            const fname = mediaMatch[1].toLowerCase();
            if (fname.endsWith('.mp4') || fname.endsWith('.3gp')) {
                const video = document.createElement('video');
                video.src = mediaUrl;
                video.controls = true;
                video.preload = 'metadata';
                video.className = 'attached-video';
                bubbleDiv.appendChild(video);
            } else if (fname.endsWith('.opus') || fname.endsWith('.ogg') || fname.endsWith('.m4a')) {
                const audio = document.createElement('audio');
                audio.src = mediaUrl;
                audio.controls = true;
                audio.className = 'attached-audio';
                bubbleDiv.appendChild(audio);
            } else if (fname.endsWith('.webp')) {
                const img = document.createElement('img');
                img.src = mediaUrl;
                img.alt = 'Sticker';
                img.className = 'attached-sticker';
                bubbleDiv.appendChild(img);
            } else {
                const img = document.createElement('img');
                img.src = mediaUrl;
                img.alt = 'Attached image';
                img.className = 'attached-image';
                bubbleDiv.appendChild(img);
            }
            // Show text content alongside media if there's more than just the attachment tag
            const remainingText = msg.content.replace(/[\u200e\u200f]*<[\u200e\u200f]*attached: .+?>[\u200e\u200f]*/, '').trim();
            if (remainingText) {
                const contentSpan = document.createElement('span');
                contentSpan.className = 'message-content';
                contentSpan.innerHTML = renderContentWithLinks(remainingText);
                bubbleDiv.appendChild(contentSpan);
            }
        } else {
            const contentSpan = document.createElement('span');
            contentSpan.className = 'message-content';
            contentSpan.innerHTML = renderContentWithLinks(msg.content);
            bubbleDiv.appendChild(contentSpan);
        }

        // Time spacer (reserves inline space for the absolutely-positioned time)
        const spacer = document.createElement("span");
        spacer.className = "time-spacer";
        bubbleDiv.appendChild(spacer);

        // Time
        const timeDiv = document.createElement("span");
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

    const allBubbles = document.querySelectorAll(".bubble");

    allBubbles.forEach((bubble) => {
        const msgEl = bubble.closest(".message");
        const sender = msgEl ? msgEl.dataset.sender : null;
        const isSystem = bubble.classList.contains("system");

        // Author filter: system messages pass when no author filter is set
        const senderMatch = !hasAuthor || sender === authorFilter;

        // Text match: for regular messages use .message-content only (excludes
        // sender label and timestamp); for system messages use bubble text
        let bodyText;
        if (isSystem) {
            bodyText = bubble.textContent.toLowerCase();
        } else {
            const contentEl = bubble.querySelector(".message-content");
            bodyText = contentEl ? contentEl.textContent.toLowerCase() : '';
        }
        const textMatch = !hasQuery || bodyText.includes(searchQuery);

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
function getVisibleCenterMessage() {
    const container = document.getElementById('chatContainer');
    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;
    const messages = container.querySelectorAll('.message');
    let closest = null;
    let closestDist = Infinity;
    messages.forEach(msg => {
        const rect = msg.getBoundingClientRect();
        const msgCenter = rect.top + rect.height / 2;
        const dist = Math.abs(msgCenter - centerY);
        if (dist < closestDist) {
            closestDist = dist;
            closest = msg;
        }
    });
    return closest;
}

function flashMessage(msgEl) {
    const bubble = msgEl.querySelector('.bubble');
    if (!bubble) return;
    bubble.classList.remove('mode-switch-flash');
    // Force reflow to restart animation
    void bubble.offsetWidth;
    bubble.classList.add('mode-switch-flash');
    bubble.addEventListener('animationend', () => {
        bubble.classList.remove('mode-switch-flash');
    }, { once: true });
}

function toggleIphoneMode() {
    const appContainer = document.getElementById('appContainer');
    const iphoneHeader = document.getElementById('iphoneHeader');
    const iosInputBar = document.getElementById('iosInputBar');
    const exitBtn = document.getElementById('exitIphoneBtn');
    const isActive = appContainer.classList.contains('iphone-mode');

    // Find the message currently at the center of the viewport
    const anchorMsg = getVisibleCenterMessage();

    function applyModeSwitch() {
        if (isActive) {
            appContainer.classList.remove('iphone-mode');
            document.body.classList.remove('iphone-bg');
            iphoneHeader.style.display = 'none';
            iosInputBar.style.display = 'none';
            exitBtn.style.display = 'none';
        } else {
            appContainer.classList.add('iphone-mode');
            document.body.classList.add('iphone-bg');
            iphoneHeader.style.display = 'block';
            iosInputBar.style.display = 'flex';
            exitBtn.style.display = 'flex';

            if (isSearchVisible) {
                closeSearch();
            }

            const contactName = document.getElementById('iosContactName');
            const contactAvatar = document.getElementById('iosContactAvatar');
            contactName.textContent = chatFileName || 'Group Chat';

            const name = chatFileName || 'G';
            contactAvatar.textContent = name[0].toUpperCase();

            const now = new Date();
            document.getElementById('iosTime').textContent = now.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: false
            });
        }
    }

    if (anchorMsg) {
        // 1. Flash the anchor in the current view
        anchorMsg.scrollIntoView({ block: 'center' });
        flashMessage(anchorMsg);

        // 2. While the flash plays, apply the mode switch hidden so the
        //    browser can layout/reflow off-screen during the animation
        requestAnimationFrame(() => {
            appContainer.style.visibility = 'hidden';
            applyModeSwitch();
            // Scroll to anchor in the hidden layout so it's ready
            anchorMsg.scrollIntoView({ block: 'center' });
        });

        // 3. When the flash ends, reveal the pre-rendered view and flash again
        const bubble = anchorMsg.querySelector('.bubble');
        bubble.addEventListener('animationend', () => {
            anchorMsg.scrollIntoView({ block: 'center' });
            appContainer.style.visibility = '';
            flashMessage(anchorMsg);
        }, { once: true });
    } else {
        applyModeSwitch();
    }
}

/* ===========================
   UTILITIES
   =========================== */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderContentWithLinks(content) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    // Split on URLs, escape each non-URL part, then wrap URLs in anchor tags
    const parts = content.split(urlRegex);
    return parts.map((part, i) => {
        if (i % 2 === 1) {
            // This is a URL match - escape the display text and sanitize the href
            const escaped = escapeHtml(part);
            return `<a href="${escaped}" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
        }
        return escapeHtml(part);
    }).join('');
}

window.loadZipFile = loadZipFile;
window.handleSearch = handleSearch;
