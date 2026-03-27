/**
 * 11.1-proxy-queue.js
 * 연습문제 11.1: Proxy를 사용한 대기열 구현
 *
 * Proxy를 사용하여 비동기로 초기화되는 모든 컴포넌트에
 * 대기열을 투명하게 적용하는 일반 래퍼
 */

import { EventEmitter, once } from 'events'

/**
 * 프록시 기반 초기화 대기열 래퍼
 *
 * @param {Object} target - 래핑할 객체
 * @param {Function} initFn - 초기화 함수 (Promise 반환)
 * @returns {Proxy} 대기열이 적용된 프록시 객체
 */
function createQueuedProxy(target, initFn) {
  let initialized = false
  let initPromise = null
  const queue = []

  // 초기화 시작
  initPromise = initFn().then(() => {
    initialized = true
    // 대기 중인 호출 실행
    queue.forEach(({ method, args, resolve, reject }) => {
      Promise.resolve(target[method](...args))
        .then(resolve)
        .catch(reject)
    })
    queue.length = 0
  })

  return new Proxy(target, {
    get(obj, prop) {
      const value = obj[prop]

      // 함수가 아니면 그대로 반환
      if (typeof value !== 'function') {
        return value
      }

      // 초기화 완료 후에는 원본 함수 반환
      if (initialized) {
        return value.bind(obj)
      }

      // 초기화 전에는 큐에 저장하는 래퍼 반환
      return function(...args) {
        return new Promise((resolve, reject) => {
          queue.push({ method: prop, args, resolve, reject })
        })
      }
    }
  })
}

// 예제: 비동기 초기화가 필요한 DB 클래스
class Database extends EventEmitter {
  constructor() {
    super()
    this.connected = false
    this.data = new Map()
  }

  async connect() {
    console.log('[DB] Connecting...')
    await new Promise(resolve => setTimeout(resolve, 500))
    this.connected = true
    console.log('[DB] Connected!')
    this.emit('connected')
  }

  async query(sql) {
    if (!this.connected) {
      throw new Error('Not connected')
    }
    console.log(`[DB] Executing: ${sql}`)
    await new Promise(resolve => setTimeout(resolve, 100))
    return { rows: [], sql }
  }

  async insert(table, data) {
    if (!this.connected) {
      throw new Error('Not connected')
    }
    console.log(`[DB] Inserting into ${table}:`, data)
    const id = Date.now()
    this.data.set(id, { table, ...data })
    return { id }
  }
}

// 예제: 비동기 초기화가 필요한 캐시 클래스
class Cache extends EventEmitter {
  constructor() {
    super()
    this.ready = false
    this.store = new Map()
  }

  async initialize() {
    console.log('[Cache] Initializing...')
    await new Promise(resolve => setTimeout(resolve, 300))
    this.ready = true
    console.log('[Cache] Ready!')
    this.emit('ready')
  }

  async get(key) {
    if (!this.ready) throw new Error('Not ready')
    console.log(`[Cache] Getting: ${key}`)
    return this.store.get(key)
  }

  async set(key, value, ttl = 60000) {
    if (!this.ready) throw new Error('Not ready')
    console.log(`[Cache] Setting: ${key} = ${value}`)
    this.store.set(key, value)
    setTimeout(() => this.store.delete(key), ttl)
    return true
  }
}

// 사용 예제
async function main() {
  console.log('=== Proxy Queue Demo ===\n')

  // 1. Database with proxy queue
  console.log('--- Database Example ---')
  const rawDb = new Database()
  const db = createQueuedProxy(rawDb, () => rawDb.connect())

  // 초기화 전에 호출 - 자동으로 큐에 저장됨
  const promise1 = db.query('SELECT * FROM users')
  const promise2 = db.insert('users', { name: 'Alice' })
  const promise3 = db.query('SELECT * FROM orders')

  console.log('[Main] All calls queued, waiting for results...')
  const results = await Promise.all([promise1, promise2, promise3])
  console.log('[Main] Results:', results)

  // 초기화 후 호출 - 바로 실행
  console.log('\n[Main] Now calling after initialization:')
  const result = await db.query('SELECT * FROM products')
  console.log('[Main] Immediate result:', result)

  // 2. Cache with proxy queue
  console.log('\n--- Cache Example ---')
  const rawCache = new Cache()
  const cache = createQueuedProxy(rawCache, () => rawCache.initialize())

  // 초기화 전에 호출
  const setPromise = cache.set('user:1', { name: 'Bob' })
  const getPromise = cache.get('user:1')

  console.log('[Main] Cache calls queued...')
  await setPromise
  const cachedValue = await getPromise
  console.log('[Main] Cached value:', cachedValue)
}

main().catch(console.error)

/**
 * Proxy 기반 대기열의 장점:
 *
 * 1. 투명성: 사용자 코드에서 초기화 상태를 전혀 신경 쓰지 않아도 됨
 * 2. 일반성: 어떤 객체에도 적용 가능
 * 3. 자동화: 모든 메서드 호출을 자동으로 처리
 *
 * 확장 가능한 기능:
 * - 특정 메서드만 대기열 적용
 * - 재초기화 지원
 * - 타임아웃 처리
 * - 에러 핸들링 개선
 */
