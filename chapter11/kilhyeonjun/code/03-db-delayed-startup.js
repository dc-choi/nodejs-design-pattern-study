/**
 * 03-db-delayed-startup.js
 * 지연 시작 방식
 *
 * 모든 초기화가 완료된 후 애플리케이션 로직 실행
 */

import { EventEmitter, once } from 'events'

class DB extends EventEmitter {
  connected = false

  connect() {
    console.log('Connecting to database...')
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

// 초기화 함수
async function initialize() {
  db.connect()
  await once(db, 'connected')
  console.log('All services initialized!')
}

// 비즈니스 로직 (초기화 상태 확인 불필요)
async function updateLastAccess() {
  await db.query(`INSERT (${Date.now()}) INTO "LastAccesses"`)
}

async function main() {
  // 먼저 모든 초기화 완료 대기
  await initialize()

  // 이후 비즈니스 로직 실행
  updateLastAccess()

  setTimeout(() => {
    updateLastAccess()
  }, 100)
}

main()

/**
 * 장점:
 * - 비즈니스 로직에서 초기화 상태 확인 불필요
 * - 간단하고 명확함
 *
 * 단점:
 * - 애플리케이션 시작 시간 지연
 * - 비동기 컴포넌트의 재초기화는 고려하지 않음
 * - 어떤 컴포넌트가 초기화가 필요한지 미리 알아야 함
 */
