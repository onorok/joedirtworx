const sgMail = require('@sendgrid/mail')

function isConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.CONTACT_EMAIL)
}

function escapeText(value) {
  return String(value || '').replace(/\r?\n/g, '\n').trim()
}

async function sendQuote({ name, phone, email, message }) {
  if (!isConfigured()) {
    throw new Error('Email is not configured.')
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY)

  const safeName = escapeText(name)
  const safePhone = escapeText(phone)
  const safeEmail = escapeText(email)
  const safeMessage = escapeText(message)
  const replyTo = safeEmail || undefined

  await sgMail.send({
    to: process.env.CONTACT_EMAIL,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || 'zakandrews@gmail.com',
      name: 'Joe Dirt Worx'
    },
    replyTo,
    subject: `New quote request from ${safeName}`,
    text: [
      'New quote request from joedirtworx.com',
      '',
      `Name: ${safeName}`,
      `Phone: ${safePhone}`,
      `Email: ${safeEmail || 'Not provided'}`,
      '',
      'Project details:',
      safeMessage
    ].join('\n')
  })
}

module.exports = { isConfigured, sendQuote }
