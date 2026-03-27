/**
 * 01-db-without-queue.js
 * 비동기 초기화 컴포넌트의 문제점
 *
 * 연결이 완료되기 전에 쿼리를 실행하면 에러 발생
 */

import { EventEmitter } from 'events'

// 비동기 초기화가 필요한 DB 모듈
class DB extends EventEmitter {
  connected = false

  connect() {
    console.log('Connecting to database...')
    // 연결 지연 시뮬레이션 (500ms)
    setTimeout(() => {
      this.connected = true
      console.log('Database connected!')
      this.emit('connected')
    }, 500)
  }

  async query(queryString) {
    if (!this.connected) {
      throw new Error('Not connected yet')
    }
    console.log(`Query executed: ${queryString}`)
    return { rows: [] }
  }
}

export const db = new DB()

// 문제 시연
async function main() {
  db.connect()

  // 연결 완료 전에 쿼리 실행 시도 - 에러 발생!
  try {
    await db.query('SELECT * FROM users')
  } catch (err) {
    console.error('Error:', err.message)
  }

  // 600ms 후 (연결 완료 후) 쿼리 실행 - 성공
  setTimeout(async () => {
    try {
      await db.query('SELECT * FROM users')
    } catch (err) {
      console.error('Error:', err.message)
    }
  }, 600)
}

main()
