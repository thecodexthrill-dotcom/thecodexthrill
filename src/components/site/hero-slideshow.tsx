"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play, Terminal } from "lucide-react";
import type { PublicHeroSlide } from "@/lib/cms-public";

export function HeroSlideshow({ slides }: { slides: PublicHeroSlide[] }) {
  const activeSlides = slides.length > 0 ? slides : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Auto-rotation timer (5 seconds)
  useEffect(() => {
    if (!isPlaying || isHovered || activeSlides.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isPlaying, isHovered, activeSlides.length]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 45) {
      handleNext();
    } else if (distance < -45) {
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (activeSlides.length === 0) {
    return null;
  }

  const currentSlide = activeSlides[currentIndex] || activeSlides[0];

  return (
    <div
      aria-label="TheCodexThrill Platform Showcase Slideshow"
      aria-roledescription="carousel"
      className="hero-brand-banner-frame"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
    >
      <div className="hero-banner-inner" role="group" aria-roledescription="slide" aria-label={`Slide ${currentIndex + 1} of ${activeSlides.length}: ${currentSlide.title}`}>
        {/* Render stacked slides for crossfade */}
        {activeSlides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          return (
            <div
              className={`hero-slide-pane ${isActive ? "slide-active" : "slide-hidden"}`}
              key={slide.id || idx}
              aria-hidden={!isActive}
            >
              <Image
                src={slide.imageUrl}
                alt={slide.altText || slide.title}
                width={1400}
                height={700}
                priority={idx === 0}
                loading={idx === 0 ? "eager" : "lazy"}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 95vw, 1200px"
                className="hero-banner-img"
              />
            </div>
          );
        })}

        <div className="hero-banner-overlay" />

        {/* Dynamic Slide Caption & Link */}
        <div className="hero-banner-caption">
          <div className="caption-pill">
            <Terminal aria-hidden="true" size={14} />
            <span>{currentSlide.label || "TheCodexThrill Engineering Studio"}</span>
          </div>

          <div className="caption-tagline">
            {currentSlide.linkUrl ? (
              <Link className="caption-link" href={currentSlide.linkUrl}>
                <span>{currentSlide.tagline || "BUILD | INNOVATE | DEPLOY | SCALE"}</span>
              </Link>
            ) : (
              <span>{currentSlide.tagline || "BUILD | INNOVATE | DEPLOY | SCALE"}</span>
            )}
          </div>
        </div>

        {/* Carousel Interactive Controls */}
        {activeSlides.length > 1 && (
          <div className="hero-carousel-controls">
            <button
              aria-label="Previous slide"
              className="carousel-control-btn"
              onClick={handlePrev}
              type="button"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              aria-label={isPlaying ? "Pause automatic slide rotation" : "Play automatic slide rotation"}
              className="carousel-control-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              type="button"
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            </button>

            <div className="carousel-indicators">
              {activeSlides.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  aria-label={`Go to slide ${dotIdx + 1}`}
                  className={`carousel-dot ${dotIdx === currentIndex ? "dot-active" : ""}`}
                  onClick={() => setCurrentIndex(dotIdx)}
                />
              ))}
            </div>

            <button
              aria-label="Next slide"
              className="carousel-control-btn"
              onClick={handleNext}
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
