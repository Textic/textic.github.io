// Cyber Snake Game Module
(function() {
    let canvas, ctx;
    let snake = [];
    let food = { x: 0, y: 0 };
    let snakeDir = { x: 0, y: 0 };
    let snakeNextDir = { x: 0, y: 0 };
    let snakeScore = 0;
    let snakeHighScore = parseInt(localStorage.getItem('snake_highscore') || '0');
    let snakeSpeed = 100; // ms
    let snakeTimer = null;
    let snakeRunning = false;
    let snakeGameOver = true;

    const setupSnakeGame = () => {
        canvas = document.getElementById('snake-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        
        // Key bindings for snake
        window.addEventListener('keydown', (e) => {
            if (!snakeRunning && e.key === ' ') {
                if (window.state.activePanel === 'arcade' && window.state.activeGame === 'snake') {
                    e.preventDefault();
                    startSnakeGame();
                }
                return;
            }
            
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                // Prevent browser scrolling inside arcade pane
                if (window.state.activePanel === 'arcade' && window.state.activeGame === 'snake') {
                    e.preventDefault();
                }
            }
            
            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    if (snakeDir.y === 0) snakeNextDir = { x: 0, y: -1 };
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    if (snakeDir.y === 0) snakeNextDir = { x: 0, y: 1 };
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    if (snakeDir.x === 0) snakeNextDir = { x: -1, y: 0 };
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    if (snakeDir.x === 0) snakeNextDir = { x: 1, y: 0 };
                    break;
            }
        });

        document.getElementById('btn-start-snake').addEventListener('click', startSnakeGame);
        document.getElementById('btn-restart-snake').addEventListener('click', startSnakeGame);

        // Initial setup
        resetSnake();
    };

    const resetSnake = () => {
        snakeScore = 0;
        document.getElementById('snake-score').innerText = '000';
        document.getElementById('snake-highscore').innerText = String(snakeHighScore).padStart(3, '0');
        
        snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];
        snakeDir = { x: 1, y: 0 };
        snakeNextDir = { x: 1, y: 0 };
        snakeSpeed = 100;
        snakeGameOver = false;
        snakeRunning = false;
        
        spawnFood();
        drawSnakeFrame();
        
        document.getElementById('snake-start-screen').style.display = 'flex';
        document.getElementById('snake-gameover-screen').style.display = 'none';
    };

    const spawnFood = () => {
        const cols = canvas.width / 20;
        const rows = canvas.height / 20;
        
        let valid = false;
        while (!valid) {
            food.x = Math.floor(Math.random() * cols);
            food.y = Math.floor(Math.random() * rows);
            
            valid = true;
            for (let segment of snake) {
                if (segment.x === food.x && segment.y === food.y) {
                    valid = false;
                    break;
                }
            }
        }
    };

    const drawSnakeFrame = () => {
        // Clear canvas background
        ctx.fillStyle = '#03040b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw Grid Lines (Subtle retro grid)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }
        
        // Draw Food Pulsing Neon Circle
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff007f';
        ctx.fillStyle = '#ff007f';
        ctx.beginPath();
        ctx.arc(food.x * 20 + 10, food.y * 20 + 10, 7, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw Snake Body segments
        ctx.shadowColor = '#00f0ff';
        snake.forEach((seg, i) => {
            const ratio = i / snake.length;
            ctx.fillStyle = i === 0 ? '#00f0ff' : `rgba(0, 240, 255, ${1 - ratio * 0.75})`;
            ctx.shadowBlur = i === 0 ? 15 : 0;
            ctx.fillRect(seg.x * 20 + 1, seg.y * 20 + 1, 18, 18);
        });
        
        // Reset canvas blur values
        ctx.shadowBlur = 0;
    };

    const runSnakeLoop = () => {
        if (!snakeRunning) return;
        
        snakeDir = snakeNextDir;
        
        const head = {
            x: snake[0].x + snakeDir.x,
            y: snake[0].y + snakeDir.y
        };
        
        const cols = canvas.width / 20;
        const rows = canvas.height / 20;
        
        // Collision checks
        if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows || checkSnakeSelfCollision(head)) {
            triggerSnakeGameOver();
            return;
        }
        
        snake.unshift(head);
        
        // Eat food check
        if (head.x === food.x && head.y === food.y) {
            snakeScore += 10;
            document.getElementById('snake-score').innerText = String(snakeScore).padStart(3, '0');
            
            if (snakeScore > snakeHighScore) {
                snakeHighScore = snakeScore;
                localStorage.setItem('snake_highscore', snakeHighScore);
                document.getElementById('snake-highscore').innerText = String(snakeHighScore).padStart(3, '0');
            }
            
            spawnFood();
            
            // Dynamic difficulty scaling speedup
            if (snakeSpeed > 50) {
                snakeSpeed -= 2;
                clearInterval(snakeTimer);
                snakeTimer = setInterval(runSnakeLoop, snakeSpeed);
            }
        } else {
            snake.pop();
        }
        
        drawSnakeFrame();
    };

    const checkSnakeSelfCollision = (head) => {
        for (let i = 1; i < snake.length; i++) {
            if (snake[i].x === head.x && snake[i].y === head.y) {
                return true;
            }
        }
        return false;
    };

    const startSnakeGame = () => {
        if (snakeTimer) clearInterval(snakeTimer);
        resetSnake();
        
        snakeRunning = true;
        document.getElementById('snake-start-screen').style.display = 'none';
        snakeTimer = setInterval(runSnakeLoop, snakeSpeed);
    };

    const triggerSnakeGameOver = () => {
        stopSnakeGame();
        snakeGameOver = true;
        document.getElementById('snake-final-score').innerText = String(snakeScore).padStart(3, '0');
        document.getElementById('snake-gameover-screen').style.display = 'flex';
    };

    const stopSnakeGame = () => {
        snakeRunning = false;
        if (snakeTimer) {
            clearInterval(snakeTimer);
            snakeTimer = null;
        }
    };

    // Bind public functions to window object
    window.resetSnake = resetSnake;
    window.stopSnakeGame = stopSnakeGame;
    window.startSnakeGame = startSnakeGame;

    // Self Initialize
    document.addEventListener('DOMContentLoaded', setupSnakeGame);
})();
