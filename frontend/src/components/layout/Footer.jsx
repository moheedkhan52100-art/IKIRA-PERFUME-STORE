import { ArrowUpRight, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer" id="contact">
      <div className="site-footer-main section-wrap">
        <section className="site-footer-brand-column" aria-label="About IKIRA">
          <Link className="site-footer-brand" to="/#home" aria-label="IKIRA, back to top">
            IKIRA
          </Link>
          <p className="site-footer-tagline">A quieter kind of luxury.</p>
          <p className="site-footer-copy">
            Thoughtfully composed fragrances, made to become part of your story.
          </p>
          <a className="site-footer-email" href="mailto:hello@ikira.com">
            <Mail size={15} aria-hidden="true" /> hello@ikira.com
          </a>
        </section>

        <nav className="site-footer-links" aria-label="Information">
          <h2>Information</h2>
          <Link to="/account/track-order">Track your order</Link>
          <Link to="/account">My account</Link>
          <a href="mailto:hello@ikira.com">Contact us</a>
        </nav>

        <nav className="site-footer-links" aria-label="Explore IKIRA">
          <h2>Explore</h2>
          <Link to="/shop">Shop fragrances</Link>
          <Link to="/#collections">Our collections</Link>
          <Link to="/wishlist">Your wishlist</Link>
        </nav>

        <section className="site-footer-connect">
          <h2>Stay in touch</h2>
          <p>Questions about a fragrance or an order? We would love to hear from you.</p>
          <a className="site-footer-contact" href="mailto:hello@ikira.com">
            Get in touch <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </section>
      </div>

      <div className="site-footer-bottom section-wrap">
        <span>&copy; {year} IKIRA. All rights reserved.</span>
        <span>Made slowly, worn your way.</span>
      </div>
    </footer>
  )
}

export default Footer
