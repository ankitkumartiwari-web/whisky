import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface WaveformVisualizerProps {
  isPlaying: boolean;
  color?: string;
}

export function WaveformVisualizer({ isPlaying, color = '#FF6B35' }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const barsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    // Initialize bars
    const barCount = 60;
    if (barsRef.current.length === 0) {
      barsRef.current = Array.from({ length: barCount }, () => Math.random() * 0.5 + 0.2);
    }

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      const barWidth = width / barCount;
      const barGap = 2;

      barsRef.current.forEach((barHeight, index) => {
        const x = index * barWidth;
        const normalizedHeight = barHeight * height;
        const y = (height - normalizedHeight) / 2;

        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(x, y, x, y + normalizedHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, `${color}40`);

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth - barGap, normalizedHeight);

        // Animate bars if playing
        if (isPlaying) {
          // Create wave-like motion
          const time = Date.now() / 1000;
          const wave = Math.sin(time * 2 + index * 0.2) * 0.15;
          const random = Math.random() * 0.1;
          const target = 0.3 + wave + random;
          
          barsRef.current[index] += (target - barHeight) * 0.1;
        } else {
          // Decay to minimal height when not playing
          barsRef.current[index] += (0.2 - barHeight) * 0.05;
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', updateSize);
    };
  }, [isPlaying, color]);

  return (
    <div className="relative w-full h-24">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-xl"
      />
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-white/40">Paused</p>
        </div>
      )}
    </div>
  );
}
