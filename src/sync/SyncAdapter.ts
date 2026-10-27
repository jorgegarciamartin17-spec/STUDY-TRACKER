// Sitio reservado para la sincronización en la nube (todavía sin implementar).
//
// Cómo se añadiría con Supabase:
// 1. Crear en Supabase una tabla por entidad (subjects, topics, tasks, itemActions, settings)
//    con las mismas columnas; `id` es UUID y `updatedAt`/`deletedAt` sirven para resolver conflictos.
// 2. Implementar esta interfaz: `push` sube los registros con updatedAt > última sincronización,
//    `pull` baja los cambios remotos y los aplica con la misma regla que la importación en modo
//    "fusionar" (gana el updatedAt más reciente; los borrados son lógicos, nunca se pierden).
// 3. Llamar a `sync()` al abrir la app y tras cada cambio desde src/data/repo.ts.
import type { Base } from '../db/types';
import type { TableName } from '../db/db';

export interface ChangeSet {
  table: TableName;
  rows: Base[];
}

export interface SyncAdapter {
  push(changes: ChangeSet[], since: number): Promise<void>;
  pull(since: number): Promise<ChangeSet[]>;
}

/** Adaptador por defecto: no sincroniza nada. */
export const noSync: SyncAdapter = {
  async push() {},
  async pull() {
    return [];
  },
};
