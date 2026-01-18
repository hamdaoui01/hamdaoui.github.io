/* ========================================
   PART 4/5 - JAVASCRIPT CORE ANIMATIONS
   ======================================== */

// ========================================
// UTILITY FUNCTIONS
// ========================================

const clamp = (v, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const round = (v, precision = 3) => parseFloat(v.toFixed(precision));
const adjust = (v, fMin, fMax, tMin, tMax) => 
  round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin));

// ========================================
// PROFILE CARD TILT ENGINE
// ========================================

class ProfileCardTilt {
  constructor(wrapEl, shellEl) {
    this.wrapEl = wrapEl;
    this.shellEl = shellEl;
    this.rafId = null;
    this.running = false;
    this.lastTs = 0;
    
    this.currentX = 0;
    this.currentY = 0;
    this.targetX = 0;
    this.targetY = 0;
    
    this.DEFAULT_TAU = 0.14;
    this.INITIAL_TAU = 0.6;
    this.initialUntil = 0;
    
    this.enterTimer = null;
    this.leaveRaf = null;
  }
  
  setVarsFromXY(x, y) {
    if (!this.shellEl || !this.wrapEl) return;
    
    const width = this.shellEl.clientWidth || 1;
    const height = this.shellEl.clientHeight || 1;
    
    const percentX = clamp((100 / width) * x);
    const percentY = clamp((100 / height) * y);
    
    const centerX = percentX - 50;
    const centerY = percentY - 50;
    
    const properties = {
      '--pointer-x': `${percentX}%`,
      '--pointer-y': `${percentY}%`,
      '--background-x': `${adjust(percentX, 0, 100, 35, 65)}%`,
      '--background-y': `${adjust(percentY, 0, 100, 35, 65)}%`,
      '--pointer-from-center': `${clamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1)}`,
      '--pointer-from-top': `${percentY / 100}`,
      '--pointer-from-left': `${percentX / 100}`,
      '--rotate-x': `${round(-(centerX / 5))}deg`,
      '--rotate-y': `${round(centerY / 4)}deg`
    };
    
    for (const [k, v] of Object.entries(properties)) {
      this.wrapEl.style.setProperty(k, v);
    }
  }
  
  step(ts) {
    if (!this.running) return;
    if (this.lastTs === 0) this.lastTs = ts;
    const dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    
    const tau = ts < this.initialUntil ? this.INITIAL_TAU : this.DEFAULT_TAU;
    const k = 1 - Math.exp(-dt / tau);
    
    this.currentX += (this.targetX - this.currentX) * k;
    this.currentY += (this.targetY - this.currentY) * k;
    
    this.setVarsFromXY(this.currentX, this.currentY);
    
    const stillFar = Math.abs(this.targetX - this.currentX) > 0.05 || 
                     Math.abs(this.targetY - this.currentY) > 0.05;
    
    if (stillFar || document.hasFocus()) {
      this.rafId = requestAnimationFrame((ts) => this.step(ts));
    } else {
      this.running = false;
      this.lastTs = 0;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
  }
  
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTs = 0;
    this.rafId = requestAnimationFrame((ts) => this.step(ts));
  }
  
  setImmediate(x, y) {
    this.currentX = x;
    this.currentY = y;
    this.setVarsFromXY(this.currentX, this.currentY);
  }
  
  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
    this.start();
  }
  
  toCenter() {
    if (!this.shellEl) return;
    this.setTarget(this.shellEl.clientWidth / 2, this.shellEl.clientHeight / 2);
  }
  
  beginInitial(durationMs) {
    this.initialUntil = performance.now() + durationMs;
    this.start();
  }
  
  getCurrent() {
    return { x: this.currentX, y: this.currentY, tx: this.targetX, ty: this.targetY };
  }
  
  cancel() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.running = false;
    this.lastTs = 0;
  }
  
  destroy() {
    this.cancel();
    if (this.enterTimer) clearTimeout(this.enterTimer);
    if (this.leaveRaf) cancelAnimationFrame(this.leaveRaf);
  }
}

// ========================================
// GLOBAL SPOTLIGHT EFFECT
// ========================================

class GlobalSpotlight {
  constructor() {
    this.spotlight = document.getElementById('globalSpotlight');
    this.gridRef = document.getElementById('bentoGrid');
    this.isInsideSection = false;
    this.spotlightRadius = 300;
    this.glowColor = '132, 0, 255';
    
    this.init();
  }
  
  init() {
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseleave', () => this.handleMouseLeave());
  }
  
  calculateSpotlightValues(radius) {
    return {
      proximity: radius * 0.5,
      fadeDistance: radius * 0.75
    };
  }
  
  updateCardGlowProperties(card, mouseX, mouseY, glow, radius) {
    const rect = card.getBoundingClientRect();
    const relativeX = ((mouseX - rect.left) / rect.width) * 100;
    const relativeY = ((mouseY - rect.top) / rect.height) * 100;
    
    card.style.setProperty('--glow-x', `${relativeX}%`);
    card.style.setProperty('--glow-y', `${relativeY}%`);
    card.style.setProperty('--glow-intensity', glow.toString());
    card.style.setProperty('--glow-radius', `${radius}px`);
  }
  
  handleMouseMove(e) {
    if (!this.spotlight || !this.gridRef) return;
    
    const section = this.gridRef.closest('.bento-section');
    const rect = section?.getBoundingClientRect();
    const mouseInside = rect && 
      e.clientX >= rect.left && 
      e.clientX <= rect.right && 
      e.clientY >= rect.top && 
      e.clientY <= rect.bottom;
    
    this.isInsideSection = mouseInside || false;
    const cards = this.gridRef.querySelectorAll('.magic-bento-card');
    
    if (!mouseInside) {
      gsap.to(this.spotlight, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.out'
      });
      cards.forEach(card => {
        card.style.setProperty('--glow-intensity', '0');
      });
      return;
    }
    
    const { proximity, fadeDistance } = this.calculateSpotlightValues(this.spotlightRadius);
    let minDistance = Infinity;
    
    cards.forEach(card => {
      const cardRect = card.getBoundingClientRect();
      const centerX = cardRect.left + cardRect.width / 2;
      const centerY = cardRect.top + cardRect.height / 2;
      const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY) - 
                      Math.max(cardRect.width, cardRect.height) / 2;
      const effectiveDistance = Math.max(0, distance);
      
      minDistance = Math.min(minDistance, effectiveDistance);
      
      let glowIntensity = 0;
      if (effectiveDistance <= proximity) {
        glowIntensity = 1;
      } else if (effectiveDistance <= fadeDistance) {
        glowIntensity = (fadeDistance - effectiveDistance) / (fadeDistance - proximity);
      }
      
      this.updateCardGlowProperties(card, e.clientX, e.clientY, glowIntensity, this.spotlightRadius);
    });
    
    gsap.to(this.spotlight, {
      left: e.clientX,
      top: e.clientY,
      duration: 0.1,
      ease: 'power2.out'
    });
    
    const targetOpacity = minDistance <= proximity ? 0.8 :
      minDistance <= fadeDistance ? 
        ((fadeDistance - minDistance) / (fadeDistance - proximity)) * 0.8 : 0;
    
    gsap.to(this.spotlight, {
      opacity: targetOpacity,
      duration: targetOpacity > 0 ? 0.2 : 0.5,
      ease: 'power2.out'
    });
  }
  
  handleMouseLeave() {
    this.isInsideSection = false;
    this.gridRef?.querySelectorAll('.magic-bento-card').forEach(card => {
      card.style.setProperty('--glow-intensity', '0');
    });
    if (this.spotlight) {
      gsap.to(this.spotlight, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.out'
      });
    }
  }
}

// ========================================
// PARTICLE SYSTEM
// ========================================

class ParticleSystem {
  constructor(card) {
    this.card = card;
    this.particles = [];
    this.timeouts = [];
    this.isHovered = false;
    this.particleCount = 12;
    this.glowColor = '132, 0, 255';
    this.memoizedParticles = [];
    this.particlesInitialized = false;
  }
  
  createParticleElement(x, y) {
    const el = document.createElement('div');
    el.className = 'particle';
    el.style.cssText = `
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(${this.glowColor}, 1);
      box-shadow: 0 0 6px rgba(${this.glowColor}, 0.6);
      pointer-events: none;
      z-index: 100;
      left: ${x}px;
      top: ${y}px;
    `;
    return el;
  }
  
  initializeParticles() {
    if (this.particlesInitialized || !this.card) return;
    
    const { width, height } = this.card.getBoundingClientRect();
    this.memoizedParticles = Array.from({ length: this.particleCount }, () =>
      this.createParticleElement(Math.random() * width, Math.random() * height)
    );
    this.particlesInitialized = true;
  }
  
  clearAllParticles() {
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];
    
    this.particles.forEach(particle => {
      gsap.to(particle, {
        scale: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'back.in(1.7)',
        onComplete: () => {
          particle.parentNode?.removeChild(particle);
        }
      });
    });
    this.particles = [];
  }
  
  animateParticles() {
    if (!this.card || !this.isHovered) return;
    
    if (!this.particlesInitialized) {
      this.initializeParticles();
    }
    
    this.memoizedParticles.forEach((particle, index) => {
      const timeoutId = setTimeout(() => {
        if (!this.isHovered || !this.card) return;
        
        const clone = particle.cloneNode(true);
        this.card.appendChild(clone);
        this.particles.push(clone);
        
        gsap.fromTo(clone, 
          { scale: 0, opacity: 0 }, 
          { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
        );
        
        gsap.to(clone, {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          ease: 'none',
          repeat: -1,
          yoyo: true
        });
        
        gsap.to(clone, {
          opacity: 0.3,
          duration: 1.5,
          ease: 'power2.inOut',
          repeat: -1,
          yoyo: true
        });
      }, index * 100);
      
      this.timeouts.push(timeoutId);
    });
  }
  
  start() {
    this.isHovered = true;
    this.animateParticles();
  }
  
  stop() {
    this.isHovered = false;
    this.clearAllParticles();
  }
  
  destroy() {
    this.clearAllParticles();
  }
}

// ========================================
// BENTO CARD EFFECTS
// ========================================

class BentoCardEffects {
  constructor(card, index) {
    this.card = card;
    this.index = index;
    this.particleSystem = new ParticleSystem(card);
    this.magnetismAnimation = null;
    
    this.init();
  }
  
  init() {
    this.card.addEventListener('mouseenter', () => this.handleMouseEnter());
    this.card.addEventListener('mouseleave', () => this.handleMouseLeave());
    this.card.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.card.addEventListener('click', (e) => this.handleClick(e));
  }
  
  handleMouseEnter() {
    this.particleSystem.start();
    
    gsap.to(this.card, {
      rotateX: 5,
      rotateY: 5,
      duration: 0.3,
      ease: 'power2.out',
      transformPerspective: 1000
    });
  }
  
  handleMouseLeave() {
    this.particleSystem.stop();
    
    gsap.to(this.card, {
      rotateX: 0,
      rotateY: 0,
      x: 0,
      y: 0,
      duration: 0.3,
      ease: 'power2.out'
    });
  }
  
  handleMouseMove(e) {
    const rect = this.card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Tilt effect
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;
    
    gsap.to(this.card, {
      rotateX,
      rotateY,
      duration: 0.1,
      ease: 'power2.out',
      transformPerspective: 1000
    });
    
    // Magnetism effect
    const magnetX = (x - centerX) * 0.05;
    const magnetY = (y - centerY) * 0.05;
    
    if (this.magnetismAnimation) {
      this.magnetismAnimation.kill();
    }
    
    this.magnetismAnimation = gsap.to(this.card, {
      x: magnetX,
      y: magnetY,
      duration: 0.3,
      ease: 'power2.out'
    });
  }
  
  handleClick(e) {
    const rect = this.card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const maxDistance = Math.max(
      Math.hypot(x, y),
      Math.hypot(x - rect.width, y),
      Math.hypot(x, y - rect.height),
      Math.hypot(x - rect.width, y - rect.height)
    );
    
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: absolute;
      width: ${maxDistance * 2}px;
      height: ${maxDistance * 2}px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(132, 0, 255, 0.4) 0%, rgba(132, 0, 255, 0.2) 30%, transparent 70%);
      left: ${x - maxDistance}px;
      top: ${y - maxDistance}px;
      pointer-events: none;
      z-index: 1000;
    `;
    
    this.card.appendChild(ripple);
    
    gsap.fromTo(ripple,
      { scale: 0, opacity: 1 },
      {
        scale: 1,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
        onComplete: () => ripple.remove()
      }
    );
  }
  
  destroy() {
    this.particleSystem.destroy();
    if (this.magnetismAnimation) {
      this.magnetismAnimation.kill();
    }
  }
}

// CONTINUE IN PART 5...
/* ========================================
   PART 5/5 - INITIALIZATION & FINAL EFFECTS
   ======================================== */

// ========================================
// PROJECT CARD EFFECTS
// ========================================

class ProjectCardEffects {
  constructor(card, index) {
    this.card = card;
    this.index = index;
    this.init();
  }
  
  init() {
    this.card.addEventListener('mouseenter', () => this.handleMouseEnter());
    this.card.addEventListener('mouseleave', () => this.handleMouseLeave());
    this.card.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.card.addEventListener('click', () => this.handleClick());
  }
  
  handleMouseEnter() {
    gsap.to(this.card, {
      scale: 1.02,
      duration: 0.4,
      ease: 'power2.out'
    });
  }
  
  handleMouseLeave() {
    gsap.to(this.card, {
      scale: 1,
      rotateX: 0,
      rotateY: 0,
      duration: 0.4,
      ease: 'power2.out'
    });
  }
  
  handleMouseMove(e) {
    const rect = this.card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;
    
    gsap.to(this.card, {
      rotateX,
      rotateY,
      duration: 0.2,
      ease: 'power2.out',
      transformPerspective: 1000
    });
  }
  
  handleClick() {
    // Add pulse effect on click
    gsap.timeline()
      .to(this.card, {
        scale: 0.95,
        duration: 0.1,
        ease: 'power2.in'
      })
      .to(this.card, {
        scale: 1.02,
        duration: 0.3,
        ease: 'elastic.out(1, 0.5)'
      });
  }
}

// ========================================
// FORM HANDLER
// ========================================

class ContactFormHandler {
  constructor() {
    this.form = document.getElementById('contactForm');
    this.init();
  }
  
  init() {
    if (!this.form) return;
    
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Add focus animations to form inputs
    const inputs = this.form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', () => this.handleInputFocus(input));
      input.addEventListener('blur', () => this.handleInputBlur(input));
    });
  }
  
  handleInputFocus(input) {
    gsap.to(input, {
      scale: 1.02,
      duration: 0.3,
      ease: 'power2.out'
    });
  }
  
  handleInputBlur(input) {
    gsap.to(input, {
      scale: 1,
      duration: 0.3,
      ease: 'power2.out'
    });
  }
  
  handleSubmit(e) {
    e.preventDefault();
    
    const submitBtn = this.form.querySelector('.submit-btn');
    const originalText = submitBtn.querySelector('span').textContent;
    
    // Disable button
    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Sending...';
    
    // Simulate form submission
    setTimeout(() => {
      // Success animation
      gsap.timeline()
        .to(submitBtn, {
          scale: 0.9,
          duration: 0.1
        })
        .to(submitBtn, {
          scale: 1,
          duration: 0.3,
          ease: 'elastic.out(1, 0.5)'
        });
      
      submitBtn.querySelector('span').textContent = 'Message Sent! ✓';
      submitBtn.style.background = 'linear-gradient(135deg, #300927ff 0%, #b9a3eeff 100%)';
      
      // Reset form
      setTimeout(() => {
        this.form.reset();
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = originalText;
        submitBtn.style.background = '';
      }, 3000);
    }, 1500);
  }
}

// ========================================
// SCROLL ANIMATIONS
// ========================================

class ScrollAnimations {
  constructor() {
    this.init();
  }
  
  init() {
    // Animate sections on scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            this.animateSection(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    
    const sections = document.querySelectorAll('.skills-section, .projects-section, .contact-section');
    sections.forEach(section => {
      section.style.opacity = '0';
      section.style.transform = 'translateY(50px)';
      observer.observe(section);
    });
  }
  
  animateSection(section) {
    gsap.to(section, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power3.out'
    });
    
    // Animate children elements
    const children = section.querySelectorAll('.magic-bento-card, .project-card, .section-title');
    children.forEach((child, index) => {
      gsap.fromTo(child,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          delay: index * 0.1,
          ease: 'power2.out'
        }
      );
    });
  }
}

// ========================================
// SMOOTH SCROLL
// ========================================

function scrollToContact() {
  const contactSection = document.getElementById('contact');
  if (contactSection) {
    contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ========================================
// CURSOR TRAIL EFFECT
// ========================================

class CursorTrail {
  constructor() {
    this.dots = [];
    this.maxDots = 15;
    this.init();
  }
  
  init() {
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
  }
  
  handleMouseMove(e) {
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.style.cssText = `
      position: fixed;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(132, 0, 255, 0.6);
      pointer-events: none;
      z-index: 9999;
      left: ${e.clientX - 4}px;
      top: ${e.clientY - 4}px;
      box-shadow: 0 0 10px rgba(132, 0, 255, 0.8);
    `;
    
    document.body.appendChild(dot);
    this.dots.push(dot);
    
    gsap.to(dot, {
      scale: 0,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
      onComplete: () => {
        dot.remove();
        this.dots.shift();
      }
    });
    
    // Limit number of dots
    if (this.dots.length > this.maxDots) {
      const oldDot = this.dots.shift();
      oldDot?.remove();
    }
  }
}



// ========================================
// PARALLAX BACKGROUND
// ========================================

class ParallaxBackground {
  constructor() {
    this.init();
  }
  
  init() {
    document.addEventListener('mousemove', (e) => {
      const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
      const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
      
      document.querySelectorAll('.hero-section, .skills-section, .projects-section').forEach(section => {
        gsap.to(section, {
          backgroundPosition: `${50 + moveX}% ${50 + moveY}%`,
          duration: 1,
          ease: 'power1.out'
        });
      });
    });
  }
}

// ========================================
// MAIN INITIALIZATION
// ========================================

class PortfolioApp {
  constructor() {
    this.profileCardTilt = null;
    this.globalSpotlight = null;
    this.bentoCards = [];
    this.projectCards = [];
    this.formHandler = null;
    this.scrollAnimations = null;
    this.cursorTrail = null;
    this.glitchEffect = null;
    this.parallaxBg = null;
  }
  
  init() {
    // Wait for DOM and GSAP to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }
  
  setup() {
    console.log('🚀 Initializing Epic Portfolio...');
    
    // Initialize Profile Card Tilt
    this.initProfileCard();
    
    // Initialize Global Spotlight
    this.globalSpotlight = new GlobalSpotlight();
    
    // Initialize Bento Cards
    this.initBentoCards();
    
    // Initialize Project Cards
    this.initProjectCards();
    
    // Initialize Form Handler
    this.formHandler = new ContactFormHandler();
    
    // Initialize Scroll Animations
    this.scrollAnimations = new ScrollAnimations();
    
    // Initialize Cursor Trail
    this.cursorTrail = new CursorTrail();
    
    // Initialize Glitch Effect
    this.glitchEffect = new GlitchEffect();
    
    // Initialize Parallax Background
    this.parallaxBg = new ParallaxBackground();
    
    // Initial animations
    this.playInitialAnimations();
    
    console.log('✨ Portfolio initialized successfully!');
  }
  
  initProfileCard() {
    const wrapper = document.querySelector('.pc-card-wrapper');
    const shell = document.querySelector('.pc-card-shell');
    
    if (wrapper && shell) {
      this.profileCardTilt = new ProfileCardTilt(wrapper, shell);
      
      const getOffsets = (evt, el) => {
        const rect = el.getBoundingClientRect();
        return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
      };
      
      shell.addEventListener('pointerenter', (e) => {
        shell.classList.add('active');
        shell.classList.add('entering');
        setTimeout(() => shell.classList.remove('entering'), 180);
        
        const { x, y } = getOffsets(e, shell);
        this.profileCardTilt.setTarget(x, y);
      });
      
      shell.addEventListener('pointermove', (e) => {
        const { x, y } = getOffsets(e, shell);
        this.profileCardTilt.setTarget(x, y);
      });
      
      shell.addEventListener('pointerleave', () => {
        this.profileCardTilt.toCenter();
        
        const checkSettle = () => {
          const { x, y, tx, ty } = this.profileCardTilt.getCurrent();
          const settled = Math.hypot(tx - x, ty - y) < 0.6;
          if (settled) {
            shell.classList.remove('active');
          } else {
            requestAnimationFrame(checkSettle);
          }
        };
        requestAnimationFrame(checkSettle);
      });
      
      // Initialize position
      const initialX = (shell.clientWidth || 0) - 70;
      const initialY = 60;
      this.profileCardTilt.setImmediate(initialX, initialY);
      this.profileCardTilt.toCenter();
      this.profileCardTilt.beginInitial(1200);
    }
  }
  
  initBentoCards() {
    const cards = document.querySelectorAll('.magic-bento-card');
    cards.forEach((card, index) => {
      const bentoCard = new BentoCardEffects(card, index);
      this.bentoCards.push(bentoCard);
    });
  }
  
  initProjectCards() {
    const cards = document.querySelectorAll('.project-card');
    cards.forEach((card, index) => {
      const projectCard = new ProjectCardEffects(card, index);
      this.projectCards.push(projectCard);
    });
  }
  
  playInitialAnimations() {
    // Animate hero text
    gsap.fromTo('.tagline',
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1, delay: 0.8, ease: 'power3.out' }
    );
    
    // Animate profile card
    gsap.fromTo('.pc-card-wrapper',
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: 1.2, delay: 0.3, ease: 'power3.out' }
    );
  }
}

// ========================================
// GLOBAL FUNCTION FOR CONTACT BUTTON
// ========================================
window.scrollToContact = scrollToContact;

// ========================================
// START THE APP
// ========================================

const app = new PortfolioApp();
app.init();

console.log(`
╔═══════════════════════════════════════╗
║                                       ║
║    🎨 EPIC PORTFOLIO LOADED! 🚀      ║
║                                       ║
║    Features:                          ║
║    ✓ 3D Profile Card Tilt            ║
║    ✓ Global Spotlight Effect         ║
║    ✓ Particle System                 ║
║    ✓ Magnetic Bento Cards            ║
║    ✓ Ripple Click Effects            ║
║    ✓ Smooth Scroll Animations        ║
║    ✓ Cursor Trail                    ║
║    ✓ Glitch Text Effect              ║
║    ✓ Parallax Background             ║
║                                       ║
║    Enjoy your awesome portfolio! 💜   ║
║                                       ║
╚═══════════════════════════════════════╝
`);