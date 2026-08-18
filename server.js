require('dotenv').config()

const crypto = require('crypto')
const path = require('path')
const express = require('express')
const session = require('express-session')
const multer = require('multer')
const s3 = require('./lib/s3')
const mail = require('./lib/mail')

const app = express()
const PORT = process.env.PORT || 3000
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      cb(null, true)
      return
    }
    cb(new Error('Please upload JPG, PNG, WebP, or GIF images.'))
  }
})

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.set('trust proxy', 1)

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(
  session({
    name: 'jdw.sid',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
)

app.use((req, res, next) => {
  res.locals.currentPath = req.path
  res.locals.isAdmin = Boolean(req.session.admin)
  res.locals.phone = '870-688-5556'
  res.locals.phoneHref = 'tel:8706885556'
  next()
})

function safeEqual(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  if (!left.length || left.length !== right.length) {
    return false
  }
  return crypto.timingSafeEqual(left, right)
}

function requireAdmin(req, res, next) {
  if (req.session.admin) {
    next()
    return
  }
  res.redirect('/admin')
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'project'
}

function extensionFor(file) {
  const fromName = path.extname(file.originalname || '').toLowerCase()
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(fromName)) {
    return fromName === '.jpeg' ? '.jpg' : fromName
  }
  const fromType = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  }
  return fromType[file.mimetype] || '.jpg'
}

async function loadProjects() {
  const manifest = await s3.readManifest()
  return manifest.projects.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

app.get('/', async (_req, res, next) => {
  try {
    const projects = await loadProjects()
    res.render('index', { projects: projects.slice(0, 4) })
  } catch (error) {
    next(error)
  }
})

app.get('/work', async (_req, res, next) => {
  try {
    res.render('work', { projects: await loadProjects() })
  } catch (error) {
    next(error)
  }
})

app.get('/admin', (req, res) => {
  if (req.session.admin) {
    res.redirect('/admin/projects')
    return
  }
  res.render('admin/login', { error: req.session.loginError || null })
  delete req.session.loginError
})

app.post('/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    req.session.loginError = 'Admin password is not configured.'
    res.redirect('/admin')
    return
  }

  if (safeEqual(req.body.password || '', ADMIN_PASSWORD)) {
    req.session.admin = true
    res.redirect('/admin/projects')
    return
  }

  req.session.loginError = 'That password is not correct.'
  res.redirect('/admin')
})

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin')
  })
})

app.get('/admin/projects', requireAdmin, async (req, res, next) => {
  try {
    res.render('admin/dashboard', {
      projects: await loadProjects(),
      error: req.session.adminError || null,
      notice: req.session.adminNotice || null,
      s3Ready: s3.isConfigured()
    })
    delete req.session.adminError
    delete req.session.adminNotice
  } catch (error) {
    next(error)
  }
})

app.post('/admin/projects', requireAdmin, upload.array('photos', 12), async (req, res) => {
  try {
    if (!s3.isConfigured()) {
      throw new Error('S3 is not configured on this app.')
    }

    const title = String(req.body.title || '').trim()
    const description = String(req.body.description || '').trim()
    const files = req.files || []

    if (!title) {
      throw new Error('Add a project title.')
    }
    if (!files.length) {
      throw new Error('Upload at least one photo.')
    }

    const id = `${Date.now()}-${slugify(title)}`
    const images = []

    for (const [index, file] of files.entries()) {
      const key = `projects/${id}/${String(index + 1).padStart(2, '0')}${extensionFor(file)}`
      const url = await s3.uploadImage(key, file.buffer, file.mimetype)
      images.push({ key, url })
    }

    const manifest = await s3.readManifest()
    manifest.projects.unshift({
      id,
      title,
      description,
      createdAt: new Date().toISOString(),
      images
    })
    await s3.writeManifest(manifest)

    req.session.adminNotice = 'Project added.'
    res.redirect('/admin/projects')
  } catch (error) {
    req.session.adminError = error.message || 'Could not save that project.'
    res.redirect('/admin/projects')
  }
})

app.post('/admin/projects/:id/delete', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id
    const manifest = await s3.readManifest()
    const project = manifest.projects.find((item) => item.id === id)
    if (!project) {
      throw new Error('Project not found.')
    }

    await s3.deletePrefix(`projects/${id}/`)
    manifest.projects = manifest.projects.filter((item) => item.id !== id)
    await s3.writeManifest(manifest)

    req.session.adminNotice = 'Project removed.'
    res.redirect('/admin/projects')
  } catch (error) {
    req.session.adminError = error.message || 'Could not delete that project.'
    res.redirect('/admin/projects')
  }
})

app.post('/api/quote', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const phone = String(req.body.phone || '').trim()
  const email = String(req.body.email || '').trim()
  const message = String(req.body.message || '').trim()

  if (!name || !phone || !message) {
    res.status(400).json({ ok: false, error: 'Name, phone, and project details are required.' })
    return
  }

  try {
    await mail.sendQuote({ name, phone, email, message })
    res.json({ ok: true })
  } catch (error) {
    console.error('Quote send failed', error)
    res.status(500).json({ ok: false, error: 'Could not send that request. Call us instead.' })
  }
})

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (req.path.startsWith('/admin')) {
      req.session.adminError = 'That upload is too large. Use images under 12MB.'
      res.redirect('/admin/projects')
      return
    }
  }

  if (req.path.startsWith('/admin') && error.message?.includes('upload')) {
    req.session.adminError = error.message
    res.redirect('/admin/projects')
    return
  }

  console.error(error)
  res.status(500).send('Something went wrong.')
})

app.listen(PORT, () => {
  console.log(`Joe Dirt Worx listening on ${PORT}`)
  console.log(`Open http://localhost:${PORT} in your browser`)
})
