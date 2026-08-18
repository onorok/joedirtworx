const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} = require('@aws-sdk/client-s3')
const { Upload } = require('@aws-sdk/lib-storage')

const REGION = process.env.AWS_REGION || 'us-east-1'
const BUCKET = process.env.AWS_S3_BUCKET_NAME
const MANIFEST_KEY = 'projects.json'

const s3 = new S3Client({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    : undefined
})

function isConfigured() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && BUCKET)
}

function publicUrl(key) {
  if (REGION === 'us-east-1') {
    return `https://${BUCKET}.s3.amazonaws.com/${key}`
  }
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`
}

async function streamToString(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function readManifest() {
  if (!isConfigured()) {
    return { projects: [] }
  }

  try {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: MANIFEST_KEY })
    )
    const body = await streamToString(response.Body)
    const data = JSON.parse(body)
    return { projects: Array.isArray(data.projects) ? data.projects : [] }
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return { projects: [] }
    }
    throw error
  }
}

async function writeManifest(manifest) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: MANIFEST_KEY,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json'
    })
  )
}

async function uploadImage(key, buffer, contentType, onProgress) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }
  })

  if (typeof onProgress === 'function') {
    onProgress(0, buffer.length)
    upload.on('httpUploadProgress', (event) => {
      onProgress(event.loaded || 0, event.total || buffer.length)
    })
  }

  await upload.done()
  if (typeof onProgress === 'function') {
    onProgress(buffer.length, buffer.length)
  }
  return publicUrl(key)
}

async function deletePrefix(prefix) {
  const listed = await s3.send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix
    })
  )

  if (!listed.Contents?.length) {
    return
  }

  await Promise.all(
    listed.Contents.map((object) =>
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: object.Key }))
    )
  )
}

module.exports = {
  isConfigured,
  publicUrl,
  readManifest,
  writeManifest,
  uploadImage,
  deletePrefix
}
