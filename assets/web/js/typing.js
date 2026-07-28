// Typing Blitz Game Module
(function() {
    const DEFAULT_WORDS = [
        "antigravity", "javascript", "developer", "keyboard", "cyberpunk", 
        "synthwave", "retrogaming", "canvas", "async", "variable", 
        "function", "stylesheet", "database", "payload", "connection", 
        "algorithm", "responsive", "terminal", "console", "programming",
        "interface", "application", "repository", "animation", "grid"
    ];

    let typingWords = [...DEFAULT_WORDS];
    let currentWord = '';
    let typedCharCount = 0;
    let correctCharCount = 0;
    let correctWordCount = 0;
    let typingTimeLeft = 60; // seconds
    let typingTimer = null;
    let typingGameRunning = false;

    const setupTypingGame = () => {
        const inputEl = document.getElementById('typing-input');
        if (!inputEl) return;
        
        inputEl.addEventListener('input', () => {
            if (!typingGameRunning) return;
            handleTypingInput();
        });

        document.getElementById('btn-start-typing').addEventListener('click', startTypingGame);
        document.getElementById('btn-restart-typing').addEventListener('click', startTypingGame);
        document.getElementById('btn-load-dict-typing').addEventListener('click', loadSpanishDictionaryForTyping);

        resetTypingGame();
    };

    const resetTypingGame = () => {
        stopTypingGame();
        
        currentWord = '';
        typedCharCount = 0;
        correctCharCount = 0;
        correctWordCount = 0;
        typingTimeLeft = 60;
        typingGameRunning = false;

        // Reset UI stats
        document.getElementById('typing-wpm').innerText = '0';
        document.getElementById('typing-accuracy').innerText = '100%';
        document.getElementById('typing-timer').innerText = '60s';
        
        // Check state variables from window
        const loadDictBtn = document.getElementById('btn-load-dict-typing');
        if (window.state.dictLoaded) {
            loadDictBtn.innerText = '✓ Spanish Dict Loaded';
            loadDictBtn.disabled = true;
        } else {
            loadDictBtn.innerText = '📥 Load Spanish Words';
            loadDictBtn.disabled = false;
        }

        document.getElementById('typing-input').value = '';
        document.getElementById('typing-input').disabled = true;
        document.getElementById('typing-word-display').innerHTML = '<span style="color: var(--text-muted);">Click start to play</span>';
        
        document.getElementById('typing-start-screen').style.display = 'flex';
        document.getElementById('typing-gameover-screen').style.display = 'none';
    };

    const startTypingGame = () => {
        resetTypingGame();
        
        typingGameRunning = true;
        document.getElementById('typing-start-screen').style.display = 'none';
        
        const inputEl = document.getElementById('typing-input');
        inputEl.disabled = false;
        inputEl.focus();
        
        nextTypingWord();
        
        // Start countdown
        typingTimer = setInterval(() => {
            typingTimeLeft--;
            document.getElementById('typing-timer').innerText = `${typingTimeLeft}s`;
            
            // WPM real-time calculation
            const elapsedMinutes = (60 - typingTimeLeft) / 60;
            if (elapsedMinutes > 0) {
                const rawWpm = Math.round(correctWordCount / elapsedMinutes);
                document.getElementById('typing-wpm').innerText = rawWpm;
            }
            
            if (typingTimeLeft <= 0) {
                triggerTypingGameOver();
            }
        }, 1000);
    };

    const loadSpanishDictionaryForTyping = async () => {
        const btn = document.getElementById('btn-load-dict-typing');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-inline"></span> Loading...`;
        
        try {
            const url = `${window.getBaseUrl()}/assets/dictionary.json`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data && data.spanish) {
                // Filter words under 12 characters, strip accents to make it typing friendly
                typingWords = data.spanish.filter(w => w.length > 3 && w.length < 12).map(w => {
                    return w.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip accents
                });
                
                window.state.dictLoaded = true;
                window.state.dictWords = data.spanish;
                window.showToast('Spanish dictionary loaded for Typing Blitz!');
                btn.innerText = '✓ Spanish Dict Loaded';
            }
        } catch (err) {
            console.error(err);
            window.showToast('Error loading dictionary files.');
            btn.disabled = false;
            btn.innerText = '📥 Load Spanish Words';
        }
    };

    const nextTypingWord = () => {
        const rand = typingWords[Math.floor(Math.random() * typingWords.length)];
        currentWord = rand;
        
        renderWordCharacters('');
        document.getElementById('typing-input').value = '';
    };

    const renderWordCharacters = (typed) => {
        const displayEl = document.getElementById('typing-word-display');
        
        let html = '';
        for (let i = 0; i < currentWord.length; i++) {
            const char = currentWord[i];
            if (i < typed.length) {
                if (typed[i] === char) {
                    html += `<span class="word-correct-char">${char}</span>`;
                } else {
                    html += `<span class="word-wrong-char">${char}</span>`;
                }
            } else {
                html += `<span>${char}</span>`;
            }
        }
        
        displayEl.innerHTML = html;
    };

    const handleTypingInput = () => {
        const inputEl = document.getElementById('typing-input');
        const val = inputEl.value;
        
        typedCharCount++;
        
        // Exact word match
        if (val === currentWord) {
            correctWordCount++;
            correctCharCount += currentWord.length;
            
            // Pop effect
            const displayEl = document.getElementById('typing-word-display');
            displayEl.style.transform = 'scale(1.15)';
            displayEl.style.color = 'var(--neon-cyan)';
            
            setTimeout(() => {
                displayEl.style.transform = 'scale(1)';
                displayEl.style.color = '';
                nextTypingWord();
            }, 120);
        } else {
            renderWordCharacters(val);
        }

        // Live accuracy calculation
        if (typedCharCount > 0) {
            let correctProgress = correctCharCount;
            for (let i = 0; i < val.length; i++) {
                if (val[i] === currentWord[i]) correctProgress++;
            }
            const acc = Math.round((correctProgress / typedCharCount) * 100);
            document.getElementById('typing-accuracy').innerText = `${Math.min(100, Math.max(0, acc))}%`;
        }
    };

    const triggerTypingGameOver = () => {
        stopTypingGame();
        
        const wpm = correctWordCount;
        const acc = document.getElementById('typing-accuracy').innerText;
        
        document.getElementById('typing-final-wpm').innerText = wpm;
        document.getElementById('typing-final-acc').innerText = acc;
        
        document.getElementById('typing-input').disabled = true;
        document.getElementById('typing-gameover-screen').style.display = 'flex';
    };

    const stopTypingGame = () => {
        typingGameRunning = false;
        if (typingTimer) {
            clearInterval(typingTimer);
            typingTimer = null;
        }
    };

    // Bind public functions to window
    window.resetTypingGame = resetTypingGame;
    window.stopTypingGame = stopTypingGame;

    // Self initialize
    document.addEventListener('DOMContentLoaded', setupTypingGame);
})();
