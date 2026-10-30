import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function Hero() {
  const heroRef = useRef(null)

  useEffect(() => {
    const context = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      gsap.fromTo(
        '[data-reveal]',
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.85,
          stagger: 0.11,
          ease: 'power3.out',
          clearProps: 'all',
        },
      )
      gsap.fromTo(
        '.perfume-bottle',
        { opacity: 0, y: 34, rotate: -3 },
        {
          opacity: 1,
          y: 0,
          rotate: 0,
          duration: 1.15,
          delay: 0.3,
          ease: 'power3.out',
          clearProps: 'all',
        },
      )
      gsap.fromTo(
        '.blossom-branch',
        { opacity: 0, y: -14, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1.1,
          delay: 0.18,
          ease: 'power2.out',
          clearProps: 'all',
        },
      )

      gsap.to('.perfume-bottle', {
        y: -30,
        rotation: 1.2,
        scale: 1.035,
        filter: 'drop-shadow(0 18px 14px rgb(53 38 25 / 23%))',
        ease: 'none',
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.8,
        },
      })
      gsap.to('.blossom-branch', {
        yPercent: -8,
        rotation: -1.2,
        ease: 'none',
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      })
      gsap.utils.toArray('.blossom-cluster').forEach((blossom, index) => {
        gsap.to(blossom, {
          rotation: index % 2 === 0 ? 4 : -4,
          duration: 2.4 + (index % 3) * 0.35,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          transformOrigin: '50% 65%',
        })
      })
      gsap.utils.toArray('.drifting-petal').forEach((petal, index) => {
        gsap.to(petal, {
          y: 150 + index * 25,
          x: index % 2 === 0 ? 35 : -28,
          rotation: index % 2 === 0 ? 125 : -105,
          opacity: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.7,
          },
        })
      })
    }, heroRef)

    return () => context.revert()
  }, [])

  return (
    <section className="hero section-wrap" id="home" ref={heroRef}>
      <div className="hero-copy">
        <p className="eyebrow hero-eyebrow" data-reveal>
          The first chapter <span>—</span> No. 01
        </p>
        <h1 className="hero-title" data-reveal>
          <span>NEW</span>
          <span>COLLECTION</span>
        </h1>
        <div className="hero-description" data-reveal>
          <span className="description-rule" />
          <p>
            Peachwood is a refined fragrance where magnolia and the juiciness of
            peach meet the warm depth of woody notes.
          </p>
        </div>
        <Link className="hero-cta" to="/product/peachwood" data-reveal>
          <span>Discover Peachwood</span>
          <ArrowUpRight aria-hidden="true" size={17} />
        </Link>
        <p className="hero-footnote" data-reveal>
          A fragrance shaped by nature
        </p>
      </div>

      <div
        className="hero-stage"
        role="img"
        aria-label="Illustrated peach-colored IKIRA Peachwood perfume bottle on a sculptural wooden platform, framed by magnolia branches"
      >
        <span className="stage-glow" />
        <svg
          className="blossom-branch"
          viewBox="0 0 720 550"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M31 437C124 398 158 364 220 355C290 344 326 370 387 332C443 298 460 246 513 231C566 217 609 241 686 181"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M197 359C195 308 169 284 144 258M320 365C334 311 316 273 294 246M436 285C418 239 431 196 465 159M526 231C559 197 568 154 552 121M592 230C619 197 653 190 684 193"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M174 323C151 299 126 306 119 321C139 339 160 340 174 323ZM319 319C291 301 271 311 269 328C288 343 309 338 319 319ZM447 222C427 197 403 202 397 219C413 237 434 238 447 222ZM562 180C551 155 529 148 517 162C526 184 542 192 562 180ZM632 207C649 183 672 180 684 194C676 216 656 224 632 207Z"
            fill="#83906A"
          />
          <g className="blossom-cluster" transform="translate(142 244)">
            <g fill="#E9B48F" stroke="#FCF4EA" strokeWidth="3">
              <circle r="15" />
              <circle cx="-13" cy="-5" r="12" />
              <circle cx="5" cy="-12" r="12" />
              <circle cx="16" cy="3" r="12" />
            </g>
            <circle r="4" fill="#C98953" />
          </g>
          <g className="blossom-cluster" transform="translate(294 234)">
            <g fill="#E9B48F" stroke="#FCF4EA" strokeWidth="3">
              <circle r="14" />
              <circle cx="-14" cy="-6" r="12" />
              <circle cx="5" cy="-14" r="12" />
              <circle cx="15" cy="3" r="12" />
            </g>
            <circle r="4" fill="#C98953" />
          </g>
          <g className="blossom-cluster" transform="translate(465 146)">
            <g fill="#E9B48F" stroke="#FCF4EA" strokeWidth="3">
              <circle r="15" />
              <circle cx="-15" cy="-5" r="12" />
              <circle cx="5" cy="-15" r="12" />
              <circle cx="15" cy="3" r="12" />
            </g>
            <circle r="4" fill="#C98953" />
          </g>
          <g className="blossom-cluster" transform="translate(552 108)">
            <g fill="#E9B48F" stroke="#FCF4EA" strokeWidth="3">
              <circle r="14" />
              <circle cx="-14" cy="-6" r="11" />
              <circle cx="4" cy="-14" r="11" />
              <circle cx="15" cy="2" r="11" />
            </g>
            <circle r="4" fill="#C98953" />
          </g>
          <g className="blossom-cluster" transform="translate(685 169)">
            <g fill="#E9B48F" stroke="#FCF4EA" strokeWidth="3">
              <circle r="14" />
              <circle cx="-14" cy="-6" r="11" />
              <circle cx="4" cy="-14" r="11" />
              <circle cx="15" cy="2" r="11" />
            </g>
            <circle r="4" fill="#C98953" />
          </g>
        </svg>

        <span className="drifting-petal petal-a" aria-hidden="true" />
        <span className="drifting-petal petal-b" aria-hidden="true" />
        <span className="drifting-petal petal-c" aria-hidden="true" />
        <span className="drifting-petal petal-d" aria-hidden="true" />
        <div className="wood-plinth" />
        <div className="perfume-bottle">
          <span className="bottle-cap" />
          <span className="bottle-neck" />
          <span className="bottle-label">
            <span>IKIRA</span>
            <strong>PEACHWOOD</strong>
            <small>EAU DE PARFUM</small>
            <small>100 ML / 3.4 FL. OZ.</small>
          </span>
        </div>
        <p className="stage-caption">01 / PEACHWOOD</p>
      </div>

      <a className="scroll-cue" href="#about" aria-label="Scroll to learn about IKIRA">
        <span>Scroll to explore</span>
        <ArrowDown aria-hidden="true" size={15} />
      </a>
    </section>
  )
}

export default Hero
