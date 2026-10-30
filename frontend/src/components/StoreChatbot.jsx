import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Send, Sparkles, X } from 'lucide-react'
import { getProducts } from '../services/products.js'
import './StoreChatbot.css'

const quickPrompts = ['Recommend a scent', 'Something woody', 'How do I order?']
const stopWords = new Set([
  'about', 'and', 'are', 'can', 'for', 'from', 'give', 'have', 'help', 'like',
  'looking', 'make', 'need', 'recommend', 'show', 'something', 'that', 'the',
  'this', 'want', 'with', 'you', 'your', 'perfume', 'fragrance', 'scent',
])
const scentFamilies = {
  fresh: ['fresh', 'citrus', 'bergamot', 'lemon', 'orange', 'clean', 'light'],
  sweet: ['sweet', 'vanilla', 'gourmand', 'peach', 'fruity', 'soft'],
  floral: ['floral', 'rose', 'jasmine', 'magnolia', 'flower', 'blossom'],
  woody: ['woody', 'wood', 'cedar', 'sandal', 'musk', 'warm', 'smoky'],
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function formatPrice(price) {
  return `Rs. ${new Intl.NumberFormat('en-PK').format(price)}`
}

function getMinimumPrice(product) {
  return Math.min(...product.variants.map(({ price }) => price))
}

function getReply(prompt, products, catalogState) {
  const text = prompt.toLowerCase()

  if (/\b(payment|pay|cash|cod)\b/.test(text)) {
    return { text: 'IKIRA currently accepts cash on delivery. You can review your order total at checkout, and the team will contact you to confirm delivery details.' }
  }
  if (/\b(deliver|delivery|shipping|ship)\b/.test(text)) {
    return { text: 'Delivery details are confirmed by the IKIRA team after you place an order. Choose your fragrance and size, then continue to checkout.' }
  }
  if (/\b(order|checkout|purchase)\b/.test(text) && !/recommend|suggest|find|looking/.test(text)) {
    return { text: 'To order, choose a fragrance and bottle size, add it to your bag, then continue to checkout. Payment is cash on delivery.' }
  }
  if (/\b(wishlist|save|heart)\b/.test(text)) {
    return { text: 'Tap the heart on a product card to save a fragrance. Your saved items are available from Wishlist in the store menu.' }
  }
  if (/\b(return|refund|exchange)\b/.test(text)) {
    return { text: 'I don’t have the store’s return policy details. Please email hello@ikira.com using the Get in touch link in the footer.' }
  }
  if (/\b(hello|hi|hey|help|what can you do)\b/.test(text)) {
    return { text: 'I can help you find a fragrance, compare prices, and explain ordering. Tell me a scent family, note, occasion, or budget to get started.' }
  }

  if (catalogState === 'loading') {
    return { text: 'I’m loading the fragrance collection now. Please try your question again in a moment.' }
  }
  if (catalogState === 'error' || !products.length) {
    return { text: 'I can’t reach the fragrance collection right now. You can browse the shop, or try again in a moment.' }
  }

  const budgetMatch = text.match(/\b(?:under|below|less than|max(?:imum)?|budget(?: of)?)\s*(?:rs\.?|pkr)?\s*([\d,]+)/)
  const budget = budgetMatch ? Number(budgetMatch[1].replaceAll(',', '')) : null
  const gender = /\b(for him|men|man|masculine)\b/.test(text)
    ? 'men'
    : /\b(for her|women|woman|feminine)\b/.test(text)
      ? 'women'
      : null
  const words = text.match(/[a-z]{3,}/g)?.filter((word) => !stopWords.has(word)) ?? []
  const expandedWords = words.flatMap((word) => scentFamilies[word] ?? [word])
  const matches = products
    .filter((product) => !gender || product.gender === gender || product.gender === 'unisex')
    .map((product) => {
      const minimumPrice = getMinimumPrice(product)
      const searchable = [
        product.name,
        product.family,
        product.concentration,
        product.description,
        ...(product.notes ?? []),
      ].join(' ').toLowerCase()
      const score = expandedWords.reduce((total, word) => total + (searchable.includes(word) ? 1 : 0), 0)
      return { product, minimumPrice, score }
    })
    .filter(({ minimumPrice }) => budget === null || minimumPrice <= budget)
    .sort((left, right) => right.score - left.score || left.minimumPrice - right.minimumPrice)
    .slice(0, 3)

  if (!matches.length) {
    return {
      text: budget === null
        ? 'I couldn’t find a close match. Try a scent family such as woody, floral, fresh, or sweet.'
        : `I couldn’t find an available fragrance under ${formatPrice(budget)}. Try a higher budget or ask for a scent family.`,
    }
  }

  return {
    text: matches[0].score > 0
      ? 'These fragrances look like a good match. Tap one to see its sizes and details.'
      : 'Here are a few fragrances from the collection. Tell me if you prefer woody, floral, fresh, or sweet notes.',
    recommendations: matches.map(({ product, minimumPrice }) => ({
      id: product.id,
      name: product.name,
      family: product.family,
      price: minimumPrice,
    })),
  }
}

function StoreChatbot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [products, setProducts] = useState([])
  const [catalogState, setCatalogState] = useState('idle')
  const [messages, setMessages] = useState([
    {
      id: makeId(),
      type: 'assistant',
      text: 'Welcome to IKIRA. Tell me what kind of fragrance you’re looking for, and I’ll help you choose.',
    },
  ])
  const inputRef = useRef(null)
  const messagesRef = useRef(null)

  useEffect(() => {
    if (!open || catalogState !== 'idle') return
    setCatalogState('loading')
    getProducts({ limit: 50, available: true, sort: 'featured' })
      .then((response) => {
        setProducts(response.data)
        setCatalogState('ready')
      })
      .catch((error) => {
        console.error('The shopping assistant could not load the fragrance collection.', error)
        setCatalogState('error')
      })
  }, [open, catalogState])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function sendMessage(rawMessage = input) {
    const text = rawMessage.trim()
    if (!text) return

    setMessages((current) => [...current, { id: makeId(), type: 'user', text }])
    setInput('')
    const reply = getReply(text, products, catalogState)
    window.setTimeout(() => {
      setMessages((current) => [...current, { id: makeId(), type: 'assistant', ...reply }])
    }, 220)
  }

  return (
    <div className="store-chatbot">
      {open && (
        <section className="store-chat-panel" role="dialog" aria-label="IKIRA shopping assistant">
          <header className="store-chat-header">
            <span className="store-chat-avatar"><Sparkles size={17} aria-hidden="true" /></span>
            <div><strong>IKIRA Assistant</strong><span>Fragrance finder</span></div>
            <button className="store-chat-close" type="button" aria-label="Close chat" onClick={() => setOpen(false)}>
              <X size={19} aria-hidden="true" />
            </button>
          </header>
          <div className="store-chat-messages" ref={messagesRef} aria-live="polite">
            {messages.map((message) => (
              <article className={`store-chat-message is-${message.type}`} key={message.id}>
                <p>{message.text}</p>
                {message.recommendations?.map((product) => (
                  <Link
                    className="store-chat-product"
                    key={product.id}
                    to={`/product/${product.id}`}
                    onClick={() => setOpen(false)}
                  >
                    <span><strong>{product.name}</strong><small>{product.family}</small></span>
                    <span className="store-chat-price">From {formatPrice(product.price)}</span>
                  </Link>
                ))}
              </article>
            ))}
            {messages.length === 1 && (
              <div className="store-chat-prompts">
                {quickPrompts.map((prompt) => (
                  <button type="button" key={prompt} onClick={() => sendMessage(prompt)}>{prompt}</button>
                ))}
              </div>
            )}
          </div>
          <form className="store-chat-form" onSubmit={(event) => { event.preventDefault(); sendMessage() }}>
            <input
              ref={inputRef}
              aria-label="Message the IKIRA assistant"
              placeholder="Ask about a fragrance..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit" aria-label="Send message" disabled={!input.trim()}>
              <Send size={17} aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
      <button
        className="store-chat-launcher"
        type="button"
        aria-label={open ? 'Close shopping assistant' : 'Open shopping assistant'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={21} aria-hidden="true" /> : <MessageCircle size={21} aria-hidden="true" />}
        {!open && <span>Ask IKIRA</span>}
      </button>
    </div>
  )
}

export default StoreChatbot
