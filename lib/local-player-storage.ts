export type LocalPlayer = {
  id: number
  name: string
  color: string
  score: number
  position: number
  photo?: string
}

type PlayerRecord = {
  key: 'players'
  value: LocalPlayer[]
}

const databaseName = 'treasure-route-game'
const storeName = 'game-state'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('El almacenamiento local no está disponible en este navegador.'))
      return
    }

    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el almacenamiento local.'))
  })
}

export async function loadLocalPlayers(): Promise<LocalPlayer[] | null> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).get('players') as IDBRequest<PlayerRecord | undefined>
    request.onsuccess = () => {
      database.close()
      resolve(request.result?.value ?? null)
    }
    request.onerror = () => {
      database.close()
      reject(request.error ?? new Error('No se pudo leer la partida local.'))
    }
  })
}

export async function saveLocalPlayers(players: LocalPlayer[]): Promise<void> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put({ key: 'players', value: players } satisfies PlayerRecord)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('No se pudo guardar la partida local.'))
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error ?? new Error('No se pudo guardar la partida local.'))
    }
  })
}
