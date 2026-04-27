import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Rocket } from 'lucide-react';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Bullet extends GameObject {
  id: number;
}

interface Enemy extends GameObject {
  id: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export const SpaceGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('starship-high-score') || '0');
  });

  const gameRef = useRef({
    player: { x: 0, y: 0, width: 40, height: 40, invulnerable: 0 },
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    particles: [] as Particle[],
    keys: {} as Record<string, boolean>,
    lastShotTime: 0,
    spawnTimer: 0,
    stars: [] as { x: number, y: number, size: number, speed: number }[],
    frameCount: 0,
    lives: 3
  });

  // Handle High Score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('starship-high-score', score.toString());
    }
  }, [score, highScore]);

  // Audio Helpers
  const playSound = (freq: number, type: OscillatorType, duration: number) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio might be blocked by user gesture
    }
  };

  const playShootSound = () => playSound(800, 'square', 0.1);
  const playExplosionSound = () => playSound(100, 'sawtooth', 0.3);

  // Initialization
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        
        // Reset player pos
        gameRef.current.player.y = h - 80;
        gameRef.current.player.x = w / 2 - 20;

        // Re-init stars for new size
        const stars = [];
        for (let i = 0; i < 150; i++) {
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            size: Math.random() * 2,
            speed: Math.random() * 1.5 + 0.5
          });
        }
        gameRef.current.stars = stars;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      gameRef.current.keys[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      gameRef.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Ensure the window gets focus to capture keys
    window.focus();
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const spawnEnemy = (width: number) => {
    const id = Date.now() + Math.random();
    gameRef.current.enemies.push({
      id,
      x: Math.random() * (width - 40),
      y: -50,
      width: 40,
      height: 40,
      speed: Math.random() * 2 + 2 + (score / 1000)
    });
  };

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
      gameRef.current.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color
      });
    }
  };

  const startGame = () => {
    setScore(0);
    setLives(3);
    setGameState('PLAYING');
    gameRef.current.lives = 3;
    gameRef.current.enemies = [];
    gameRef.current.bullets = [];
    gameRef.current.particles = [];
    gameRef.current.player.invulnerable = 0;
    gameRef.current.player.x = (canvasRef.current?.width || 0) / 2 - 20;
  };

  // Game Loop
  useEffect(() => {
    let animationId: number;
    const ctx = canvasRef.current?.getContext('2d');

    const loop = () => {
      if (!ctx || !canvasRef.current) return;
      const { width, height } = canvasRef.current;

      // 1. Update
      if (gameState === 'PLAYING') {
        const { player, keys, bullets, enemies, particles, stars } = gameRef.current;

        // Player invulnerability frames
        if (player.invulnerable > 0) player.invulnerable--;

        // Player movement
        if (keys['ArrowLeft'] || keys['KeyA']) player.x -= 7;
        if (keys['ArrowRight'] || keys['KeyD']) player.x += 7;
        player.x = Math.max(0, Math.min(width - player.width, player.x));

        // Shooting
        const currentTime = Date.now();
        if (keys['Space'] && currentTime - gameRef.current.lastShotTime > 200) {
          bullets.push({
            id: currentTime,
            x: player.x + player.width / 2 - 2,
            y: player.y,
            width: 4,
            height: 15
          });
          gameRef.current.lastShotTime = currentTime;
          playShootSound();
        }

        // Bullets update
        gameRef.current.bullets = bullets.filter(b => {
          b.y -= 10;
          return b.y > -20;
        });

        // Enemies update
        gameRef.current.spawnTimer++;
        if (gameRef.current.spawnTimer > Math.max(20, 60 - (score / 200))) {
          spawnEnemy(width);
          gameRef.current.spawnTimer = 0;
        }

        gameRef.current.enemies = enemies.filter(e => {
          e.y += e.speed;
          
          // Collision with player
          if (
            player.invulnerable === 0 &&
            e.x < player.x + player.width - 5 &&
            e.x + e.width > player.x + 5 &&
            e.y < player.y + player.height - 5 &&
            e.y + e.height > player.y + 5
          ) {
            gameRef.current.lives -= 1;
            const nextLives = gameRef.current.lives;
            setLives(nextLives);
            
            createExplosion(player.x + 20, player.y + 20, '#ff0000');
            createExplosion(e.x + 20, e.y + 20, '#ffff00');
            playExplosionSound();
            
            if (nextLives <= 0) {
              setGameState('GAMEOVER');
            } else {
              player.invulnerable = 90; // About 1.5 seconds at 60fps
              // Note: we don't clear enemies anymore to avoid game feeling too easy/empty after hit
            }
            return false;
          }

          // Collision with bullets
          const hitBulletIndex = bullets.findIndex(b => 
            b.x < e.x + e.width &&
            b.x + b.width > e.x &&
            b.y < e.y + e.height &&
            b.y + b.height > e.y
          );

          if (hitBulletIndex !== -1) {
            bullets.splice(hitBulletIndex, 1);
            setScore(prev => prev + 100);
            createExplosion(e.x + 20, e.y + 20, '#00ff00');
            playExplosionSound();
            return false;
          }

          return e.y < height + 50;
        });

        // Particles
        gameRef.current.particles = particles.filter(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.02;
          return p.life > 0;
        });

        // Stars update
        stars.forEach(s => {
          s.y += s.speed;
          if (s.y > height) {
            s.y = -10;
            s.x = Math.random() * width;
          }
        });
      }

      // 2. Draw
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      // Draw Stars
      ctx.fillStyle = '#fff';
      gameRef.current.stars.forEach(s => {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.2;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });
      ctx.globalAlpha = 1.0;

      // Draw Player
      if (gameState !== 'GAMEOVER') {
        const p = gameRef.current.player;
        
        // Handle invulnerability flashing
        if (p.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
          ctx.globalAlpha = 0.3;
        }

        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.5)';
        ctx.fillStyle = '#06b6d4';
        
        // Sleek Rocket Body (Triangle)
        ctx.beginPath();
        ctx.moveTo(p.x + p.width / 2, p.y);
        ctx.lineTo(p.x, p.y + p.height);
        ctx.lineTo(p.x + p.width, p.y + p.height);
        ctx.fill();

        // Ship Identifier Label
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.font = '700 8px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AIS-01', p.x + p.width / 2, p.y + p.height - 8);
        
        // Cockpit Window
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(p.x + p.width / 2 - 2, p.y + 15, 4, 8);
        ctx.globalAlpha = 1.0;

        // Engine Glow
        if (gameState === 'PLAYING') {
          ctx.fillStyle = '#ff4e00';
          ctx.shadowColor = '#ff4e00';
          const flameH = 5 + Math.random() * 10;
          ctx.fillRect(p.x + p.width / 2 - 5, p.y + p.height, 10, flameH);
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      }

      // Draw Bullets
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00ffff';
      ctx.fillStyle = '#ffffff';
      gameRef.current.bullets.forEach(b => {
        ctx.fillRect(b.x, b.y, b.width, b.height);
      });
      ctx.shadowBlur = 0;

      // Draw Enemies
      gameRef.current.enemies.forEach(e => {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ec4899';
        ctx.fillStyle = '#ec4899';
        
        // Sleek Enemy ship (Inverted triangle)
        ctx.beginPath();
        ctx.moveTo(e.x + e.width / 2, e.y + e.height);
        ctx.lineTo(e.x, e.y);
        ctx.lineTo(e.x + e.width, e.y);
        ctx.fill();

        // Enemy core
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(e.x + e.width/2 - 4, e.y + 10, 8, 4);
      });
      ctx.shadowBlur = 0;

      // Draw Particles
      gameRef.current.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, 3, 3);
      });
      ctx.globalAlpha = 1.0;

      // CRT Scanlines Effect
      ctx.fillStyle = 'rgba(18, 16, 16, 0.1)';
      for (let i = 0; i < height; i += 4) {
        ctx.fillRect(0, i, width, 1);
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, score]);

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-black select-none font-mono">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Header UI */}
      <div className="absolute top-0 left-0 h-16 w-full border-b border-gray-800 bg-black/80 flex items-center justify-between px-8 z-10 font-mono">
        <div className="flex gap-12">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Score</span>
            <span className="text-2xl text-cyan-400 font-bold">{score.toString().padStart(6, '0')}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Hi-Score</span>
            <span className="text-2xl text-pink-500 font-bold">{highScore.toString().padStart(6, '0')}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i} 
                className={`w-4 h-6 rounded-sm transition-all duration-300 ${
                  i < lives ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-gray-700'
                }`} 
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-400 uppercase tracking-widest ml-2 font-bold">Life Support</span>
        </div>
      </div>

      {/* HUD Overlay */}
      {gameState === 'PLAYING' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-gray-800 z-10 transition-all">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700 text-white">A</kbd>
            <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700 text-white">D</kbd>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Move</span>
          </div>
          <div className="w-[1px] h-4 bg-gray-700"></div>
          <div className="flex items-center gap-2">
            <kbd className="px-4 py-1 bg-gray-800 rounded text-xs border border-gray-700 text-white">SPACE</kbd>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Fire Plasma</span>
          </div>
        </div>
      )}

      {/* Overlay Screens */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="mb-8"
            >
              <Rocket className="w-24 h-24 text-cyan-400" />
            </motion.div>
            <h1 className="mb-4 text-4xl font-bold tracking-tighter text-white md:text-6xl text-center">
              STARSHIP<br/>FRONTIER
            </h1>
            <p className="mb-12 text-gray-400 text-sm md:text-base text-center max-w-md leading-relaxed px-4">
              USE <span className="text-white">A, D</span> OR <span className="text-white">ARROWS</span> TO MOVE<br/>
              PRESS <span className="text-white">SPACE</span> TO SHOOT
            </p>
            <button 
              onClick={startGame}
              className="group relative px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white transition-all transform hover:scale-105 active:scale-95"
            >
              <span className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                START MISSION
              </span>
              <div className="absolute -inset-1 border border-cyan-400/30 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/40 backdrop-blur-md z-20"
          >
            <h2 className="mb-2 text-6xl font-bold text-red-500 tracking-tighter">MISSION FAILED</h2>
            <div className="flex flex-col items-center gap-4 mb-12">
              <div className="text-2xl text-white">FINAL SCORE: {score}</div>
              {score >= highScore && score > 0 && (
                <div className="flex items-center gap-2 text-yellow-400 animate-pulse">
                  <Trophy className="w-6 h-6" />
                  <span>NEW SECTOR RECORD!</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={startGame}
                className="flex items-center gap-2 px-8 py-4 bg-white text-black hover:bg-gray-200 transition-all font-bold group"
              >
                <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                REDEPLOY
              </button>
              
              <button 
                onClick={() => setGameState('START')}
                className="flex items-center gap-2 px-8 py-4 border border-white text-white hover:bg-white/10 transition-all font-bold"
              >
                MAIN MENU
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Effects Overlay */}
      <div className="absolute inset-0 pointer-events-none vignette" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,1),rgba(0,0,0,1))]" />
    </div>
  );
};
