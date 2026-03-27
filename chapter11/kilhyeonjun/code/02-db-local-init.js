/**
 * 02-db-local-init.js
 * 로컬 초기화 확인 방식
 *
 * API 호출 시마다 초기화 여부를 확인하고 대기
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

// 로컬 초기화 확인 방식
async function updateLastAccess() {
  // 매번 연결 상태 확인
  if (!db.connected) {
    console.log('Waiting for connection...')
    await once(db, 'connected')
  }

  await db.query(`INSERT (${Date.now()}) INTO "LastAccesses"`)
}

async function main() {
  db.connect()

  // 연결 전 호출 - 대기 후 실행
  updateLastAccess()

  // 600ms 후 호출 - 바로 실행
  setTimeout(() => {
    updateLastAccess()
  }, 600)
}

main()

/**
 * 단점:
 * - 매번 초기화 상태를 확인해야 함
 * - 코드 중복 발생
 * - 여러 비동기 컴포넌트가 있으면 복잡해짐
 */
