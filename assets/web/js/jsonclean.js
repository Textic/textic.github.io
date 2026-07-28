// JSON Clean Formatter & Validator Module
(function() {
    const setupJsonTool = () => {
        const inputEl = document.getElementById('json-input');
        const statusEl = document.getElementById('json-status');
        const btnFormat = document.getElementById('btn-json-format');
        const btnMinify = document.getElementById('btn-json-minify');
        const btnCopy = document.getElementById('btn-json-copy');
        
        if (!inputEl) return;

        const validateJson = () => {
            const val = inputEl.value.trim();
            if (val === '') {
                statusEl.innerHTML = '';
                return true;
            }
            
            try {
                JSON.parse(val);
                statusEl.innerHTML = `<span class="json-status-tag json-status-ok">● Valid JSON</span>`;
                return true;
            } catch (e) {
                statusEl.innerHTML = `<span class="json-status-tag json-status-err">● Invalid JSON: ${e.message.split('at position')[0]}</span>`;
                return false;
            }
        };

        inputEl.addEventListener('input', validateJson);

        btnFormat.addEventListener('click', () => {
            const val = inputEl.value.trim();
            if (val === '') return;
            
            try {
                const parsed = JSON.parse(val);
                inputEl.value = JSON.stringify(parsed, null, 2);
                validateJson();
                window.showToast('JSON Formatted!');
            } catch (e) {
                window.showToast('Error: Invalid JSON syntax');
            }
        });

        btnMinify.addEventListener('click', () => {
            const val = inputEl.value.trim();
            if (val === '') return;
            
            try {
                const parsed = JSON.parse(val);
                inputEl.value = JSON.stringify(parsed);
                validateJson();
                window.showToast('JSON Minified!');
            } catch (e) {
                window.showToast('Error: Invalid JSON syntax');
            }
        });

        btnCopy.addEventListener('click', () => {
            const val = inputEl.value.trim();
            if (val === '') return;
            window.copyToClipboard(val, 'JSON content copied!');
        });
    };

    // Self initialize
    document.addEventListener('DOMContentLoaded', setupJsonTool);
})();
