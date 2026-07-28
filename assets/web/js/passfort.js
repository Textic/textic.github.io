// PassFort Password Generator Module
(function() {
    const setupPasswordGenerator = () => {
        const slider = document.getElementById('pass-length');
        const sliderValue = document.getElementById('pass-length-val');
        const generateBtn = document.getElementById('btn-generate-pass');
        
        if (!slider) return;

        slider.addEventListener('input', (e) => {
            sliderValue.innerText = e.target.value;
            generatePassword();
        });

        // Trigger generate password on configuration changes
        document.querySelectorAll('.passgen-checkbox').forEach(box => {
            box.addEventListener('change', generatePassword);
        });

        generateBtn.addEventListener('click', generatePassword);

        document.getElementById('btn-copy-pass').addEventListener('click', () => {
            const text = document.getElementById('pass-text').innerText;
            if (text && text !== 'Select options above') {
                window.copyToClipboard(text, 'Password copied!');
            }
        });

        // Generate starting password on load
        generatePassword();
    };

    const generatePassword = () => {
        const length = parseInt(document.getElementById('pass-length').value);
        const upper = document.getElementById('pass-upper').checked;
        const lower = document.getElementById('pass-lower').checked;
        const numbers = document.getElementById('pass-numbers').checked;
        const symbols = document.getElementById('pass-symbols').checked;
        
        const chars = {
            upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            lower: 'abcdefghijklmnopqrstuvwxyz',
            numbers: '0123456789',
            symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-='
        };

        let pool = '';
        if (upper) pool += chars.upper;
        if (lower) pool += chars.lower;
        if (numbers) pool += chars.numbers;
        if (symbols) pool += chars.symbols;

        const outputEl = document.getElementById('pass-text');
        
        if (pool === '') {
            outputEl.innerText = 'Select options above';
            updateStrengthMeter(0);
            return;
        }

        let password = '';
        
        // Push at least one of each chosen category for security
        const required = [];
        if (upper) required.push(chars.upper[Math.floor(Math.random() * chars.upper.length)]);
        if (lower) required.push(chars.lower[Math.floor(Math.random() * chars.lower.length)]);
        if (numbers) required.push(chars.numbers[Math.floor(Math.random() * chars.numbers.length)]);
        if (symbols) required.push(chars.symbols[Math.floor(Math.random() * chars.symbols.length)]);

        for (let i = 0; i < length - required.length; i++) {
            password += pool[Math.floor(Math.random() * pool.length)];
        }

        // Shuffle required characters into random parts of the string
        required.forEach(char => {
            const index = Math.floor(Math.random() * (password.length + 1));
            password = password.slice(0, index) + char + password.slice(index);
        });

        outputEl.innerText = password;
        
        // Calculate Entropy strength
        let poolSize = pool.length;
        let entropy = Math.round(length * (Math.log(poolSize) / Math.log(2)));
        updateStrengthMeter(entropy);
    };

    const updateStrengthMeter = (entropy) => {
        const fill = document.getElementById('strength-fill');
        const text = document.getElementById('strength-text-val');
        
        let pct = 0;
        let strength = 'None';
        let color = 'var(--neon-pink)';
        
        if (entropy > 0) {
            if (entropy < 35) {
                pct = 25;
                strength = 'Weak (Too insecure)';
                color = '#ef4444'; // pure red
            } else if (entropy < 60) {
                pct = 50;
                strength = 'Medium (Fair)';
                color = '#f59e0b'; // orange/amber
            } else if (entropy < 80) {
                pct = 75;
                strength = 'Strong (Secure)';
                color = '#a855f7'; // violet
            } else {
                pct = 100;
                strength = 'Very Strong (Military Grade)';
                color = '#10b981'; // emerald/cyan
            }
        }
        
        fill.style.width = `${pct}%`;
        fill.style.backgroundColor = color;
        text.innerText = strength;
    };

    // Self initialize
    document.addEventListener('DOMContentLoaded', setupPasswordGenerator);
})();
