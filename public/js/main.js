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

const lightbox = document.querySelector('#lightbox')
if (lightbox) {
  const image = lightbox.querySelector('img')
  const caption = lightbox.querySelector('figcaption')
  const prev = lightbox.querySelector('.lightbox-prev')
  const next = lightbox.querySelector('.lightbox-next')
  const triggers = [...document.querySelectorAll('.lightbox-trigger')]
  const groups = new Map()

  triggers.forEach((trigger) => {
    const key = trigger.dataset.project
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(trigger)
  })

  let current = []
  let index = 0

  const show = (nextIndex) => {
    if (!current.length) return
    index = (nextIndex + current.length) % current.length
    const item = current[index]
    image.src = item.dataset.src
    image.alt = item.dataset.title || ''
    caption.textContent = item.dataset.title || ''
    const many = current.length > 1
    prev.hidden = !many
    next.hidden = !many
  }

  const open = (trigger) => {
    current = groups.get(trigger.dataset.project) || [trigger]
    show(Number(trigger.dataset.index) || 0)
    lightbox.showModal()
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => open(trigger))
  })

  lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close())
  lightbox.querySelector('.lightbox-prev').addEventListener('click', () => show(index - 1))
  lightbox.querySelector('.lightbox-next').addEventListener('click', () => show(index + 1))
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) lightbox.close()
  })
  window.addEventListener('keydown', (event) => {
    if (!lightbox.open) return
    if (event.key === 'ArrowLeft') show(index - 1)
    if (event.key === 'ArrowRight') show(index + 1)
  })
}

const projectForm = document.querySelector('#project-upload-form')
if (projectForm) {
  const fileInput = projectForm.querySelector('input[name="photos"]')
  const fileHint = projectForm.querySelector('[data-file-hint]')
  const status = projectForm.querySelector('.upload-status')
  const statusLabel = projectForm.querySelector('.upload-status-label')
  const statusPct = projectForm.querySelector('.upload-status-pct')
  const bar = projectForm.querySelector('.upload-progress')
  const barFill = bar.querySelector('span')
  const submit = projectForm.querySelector('button[type="submit"]')

  const setProgress = (pct, label) => {
    const value = Math.max(0, Math.min(100, Math.round(pct)))
    statusLabel.textContent = label
    statusPct.textContent = `${value}%`
    barFill.style.width = `${value}%`
    bar.setAttribute('aria-valuenow', String(value))
  }

  fileInput.addEventListener('change', () => {
    const count = fileInput.files.length
    fileHint.textContent = count
      ? `${count} photo${count === 1 ? '' : 's'} selected`
      : ''
  })

  projectForm.addEventListener('submit', (event) => {
    event.preventDefault()
    projectForm.classList.add('is-uploading')
    status.hidden = false
    submit.disabled = true
    setProgress(0, 'Uploading photos…')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', projectForm.action)
    xhr.setRequestHeader('Accept', 'application/json')

    xhr.upload.addEventListener('progress', (uploadEvent) => {
      if (!uploadEvent.lengthComputable) return
      const pct = (uploadEvent.loaded / uploadEvent.total) * 90
      setProgress(pct, 'Uploading photos…')
    })

    xhr.addEventListener('load', () => {
      let data = {}
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        data = {}
      }

      if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
        setProgress(100, 'Saving project…')
        window.location.reload()
        return
      }

      projectForm.classList.remove('is-uploading')
      submit.disabled = false
      setProgress(0, data.error || 'Upload failed. Try again.')
    })

    xhr.addEventListener('error', () => {
      projectForm.classList.remove('is-uploading')
      submit.disabled = false
      setProgress(0, 'Upload failed. Check your connection and try again.')
    })

    xhr.upload.addEventListener('load', () => {
      setProgress(92, 'Saving photos…')
    })

    xhr.send(new FormData(projectForm))
  })
}

const confirmDelete = document.querySelector('#confirm-delete')
if (confirmDelete) {
  const title = confirmDelete.querySelector('[data-project-title]')
  let pendingForm = null

  document.querySelectorAll('.delete-project-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      pendingForm = form
      title.textContent = form.dataset.title || 'this project'
      confirmDelete.showModal()
    })
  })

  confirmDelete.querySelector('[data-cancel]').addEventListener('click', () => {
    confirmDelete.close()
  })
  confirmDelete.querySelector('[data-confirm]').addEventListener('click', () => {
    if (pendingForm) pendingForm.submit()
  })
  confirmDelete.addEventListener('click', (event) => {
    if (event.target === confirmDelete) confirmDelete.close()
  })
  confirmDelete.addEventListener('close', () => {
    pendingForm = null
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
