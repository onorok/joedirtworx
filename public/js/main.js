const media = document.querySelector('.hero-media')
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

if (media && !reduceMotion.matches) {
  let ticking = false

  const updateParallax = () => {
    const rect = media.parentElement.getBoundingClientRect()
    const offset = Math.min(Math.max(-rect.top, 0), rect.height)
    media.style.transform = `translate3d(0, ${offset * 0.35}px, 0)`
    ticking = false
  }

  const onScroll = () => {
    if (ticking) return
    ticking = true
    window.requestAnimationFrame(updateParallax)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  updateParallax()
}

const nav = document.querySelector('.site-nav')
const toggle = document.querySelector('.nav-toggle')

if (nav && toggle) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open')
    toggle.setAttribute('aria-expanded', String(open))
  })
}

const form = document.querySelector('#quote-form')
if (form) {
  const status = form.querySelector('.form-status')
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    status.hidden = false
    status.textContent = 'Sending…'
    status.className = 'form-status'

    const body = Object.fromEntries(new FormData(form).entries())
    try {
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Could not send that request.')
      }
      form.reset()
      status.textContent = 'Got it. We will get back to you soon.'
      status.classList.add('is-ok')
    } catch (error) {
      status.textContent = error.message
      status.classList.add('is-error')
    }
  })
}
