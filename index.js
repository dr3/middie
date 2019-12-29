'use strict'

const fp = require('fastify-plugin')
const symbols = require('fastify/lib/symbols')
const Middie = require('./engine')
const kMiddlewares = Symbol('fastify-middie-middlewares')
const kMiddie = Symbol('fastify-middie-instance')

function middiePlugin (fastify, options, next) {
  // TODO: we should use decorate, but `use` is already
  // a public API of Fastify. In Fastify v3 it will be deprecated,
  // so we will able to use `decorate`
  fastify.use = use
  fastify[kMiddlewares] = []
  fastify[kMiddie] = Middie(onMiddieEnd)

  fastify
    .addHook('onRequest', enhanceRequest)
    .addHook('onRequest', runMiddie)
    .addHook('onRegister', onRegister)

  function use (path, fn) {
    if (typeof path === 'string') {
      const prefix = this[symbols.kRoutePrefix]
      path = prefix + (path === '/' && prefix.length > 0 ? '' : path)
    }
    this[kMiddlewares].push([path, fn])
    if (fn == null) {
      this[kMiddie].use(path)
    } else {
      this[kMiddie].use(path, fn)
    }
    return this
  }

  function enhanceRequest (req, reply, next) {
    req.raw.originalUrl = req.raw.url
    req.raw.id = req.id
    req.raw.hostname = req.hostname
    req.raw.ip = req.ip
    req.raw.ips = req.ips
    req.raw.log = req.log
    reply.raw.log = req.log
    next()
  }

  function runMiddie (req, reply, next) {
    if (this[kMiddlewares].length > 0) {
      this[kMiddie].run(req.raw, reply.raw, next)
    } else {
      next()
    }
  }

  function onMiddieEnd (err, req, res, next) {
    next(err)
  }

  function onRegister (instance) {
    const middlewares = instance[kMiddlewares].slice()
    instance[kMiddlewares] = []
    instance[kMiddie] = Middie(onMiddieEnd)
    instance.use = use
    for (const middleware of middlewares) {
      instance.use(...middleware)
    }
  }

  next()
}

module.exports = fp(middiePlugin, {
  // fastify: '>=3.0.0',
  name: 'middie'
})
