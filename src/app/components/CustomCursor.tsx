import { useEffect, useRef } from 'react';

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const followerRef = useRef<HTMLDivElement>(null);
  const mousePosition = useRef({ x: 0, y: 0 });
  const followerPosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosition.current = { x: e.clientX, y: e.clientY };
      
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX - 6}px, ${e.clientY - 6}px)`;
      }
    };

    const animateFollower = () => {
      const dx = mousePosition.current.x - followerPosition.current.x;
      const dy = mousePosition.current.y - followerPosition.current.y;
      
      followerPosition.current.x += dx * 0.2;
      followerPosition.current.y += dy * 0.2;
      
      if (followerRef.current) {
        followerRef.current.style.transform = `translate(${followerPosition.current.x - 20}px, ${followerPosition.current.y - 20}px)`;
      }
      
      requestAnimationFrame(animateFollower);
    };

    const handleMouseDown = () => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${mousePosition.current.x - 6}px, ${mousePosition.current.y - 6}px) scale(0.8)`;
      }
      if (followerRef.current) {
        followerRef.current.style.transform = `translate(${followerPosition.current.x - 20}px, ${followerPosition.current.y - 20}px) scale(1.5)`;
      }
    };

    const handleMouseUp = () => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${mousePosition.current.x - 6}px, ${mousePosition.current.y - 6}px) scale(1)`;
      }
      if (followerRef.current) {
        followerRef.current.style.transform = `translate(${followerPosition.current.x - 20}px, ${followerPosition.current.y - 20}px) scale(1)`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    const animationId = requestAnimationFrame(animateFollower);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <>
      <div ref={cursorRef} className="custom-cursor" />
      <div ref={followerRef} className="custom-cursor-follower" />
    </>
  );
}
