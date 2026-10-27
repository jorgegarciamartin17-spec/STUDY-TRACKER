import { useRef, useState } from 'react';
import { Button, Card, Field, Modal, PageHeader, useToast } from '../components/ui';
import type { ParsedBackup } from '../data/backup';
import { useSettings, useToday } from '../data/hooks';
import { newId, updateSettings } from '../data/repo';
import type { ClassSlot, Settings, Theme } from '../db/types';
import { defaultSemesterStart } from '../domain/dates';

// El módulo de copias (con su validador) se carga solo cuando se usa, para que Hoy abra más rápido.
const loadBackup = () => import('../data/backup');

const BACKUP_EVERY_DAYS = 7;
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function backupDue(settings: Settings, now = Date.now()) {
  return !settings.lastBackupAt || now - settings.lastBackupAt > BACKUP_EVERY_DAYS * 86_400_000;
}

async function downloadBackup(share = false) {
  const { exportBackup, backupFileName } = await loadBackup();
  const backup = await exportBackup();
  const name = backupFileName();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Copia de seguridad de estudios' });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  await updateSettings({ lastBackupAt: Date.now() });
}

export function BackupReminder({ settings, hasData }: { settings: Settings; hasData: boolean }) {
  if (!hasData || !backupDue(settings)) return null;
  const days = settings.lastBackupAt ? Math.floor((Date.now() - settings.lastBackupAt) / 86_400_000) : null;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10">
      <p className="text-sm">
        💾 {days === null ? 'Aún no has hecho ninguna copia de seguridad.' : `Tu última copia es de hace ${days} días.`} Tus datos solo están en este
        dispositivo.
      </p>
      <Button variant="primary" onClick={() => downloadBackup()}>
        Exportar ahora
      </Button>
    </Card>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const today = useToday();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tras importar, se vuelven a montar los campos para que muestren los valores nuevos.
  const [importCount, setImportCount] = useState(0);
  const [slot, setSlot] = useState<Omit<ClassSlot, 'id'>>({ weekday: 1, start: '09:00', end: '11:00', label: '' });

  if (!settings) return null;
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  async function onFile(file: File) {
    setError(null);
    try {
      const { parseBackup } = await loadBackup();
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function doImport(mode: 'replace' | 'merge') {
    if (!pending) return;
    const { importBackup } = await loadBackup();
    await importBackup(pending.backup, mode);
    setPending(null);
    setImportCount((n) => n + 1);
    toast(mode === 'replace' ? 'Datos restaurados desde la copia' : 'Copia fusionada con tus datos');
  }

  const sortedSchedule = [...settings.schedule].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Ajustes" />

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">Copia de seguridad</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Tus datos se guardan solo en este navegador. Exporta una copia cada semana y guárdala en tu nube (Drive, iCloud…). El mismo archivo sirve para
          pasar los datos del móvil al ordenador.
        </p>
        <p className="text-xs text-slate-500">
          Última copia: {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('es-ES') : 'nunca'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => downloadBackup()}>
            Exportar JSON
          </Button>
          {canShare && <Button onClick={() => downloadBackup(true).catch(() => {})}>Compartir copia</Button>}
          <Button onClick={() => fileRef.current?.click()}>Importar JSON</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Card>

      <Card key={importCount} className="flex flex-col gap-4">
        <h2 className="font-semibold">Curso y tiempo de estudio</h2>
        <Field label="Curso y cuatrimestre">
          <input defaultValue={settings.courseLabel ?? ''} placeholder="2º curso, primer cuatrimestre" onBlur={(e) => updateSettings({ courseLabel: e.target.value.trim() || undefined })} />
        </Field>
        <Field label="Inicio del cuatrimestre" hint="Se usa para calcular cuánto deberías llevar avanzado.">
          <input
            type="date"
            defaultValue={settings.semesterStart ?? defaultSemesterStart(today)}
            onChange={(e) => e.target.value && updateSettings({ semesterStart: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minutos al día (L-V)">
            <input type="number" min={0} step={15} defaultValue={settings.minutesWeekday} onBlur={(e) => updateSettings({ minutesWeekday: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Minutos al día (S-D)">
            <input type="number" min={0} step={15} defaultValue={settings.minutesWeekend} onBlur={(e) => updateSettings({ minutesWeekend: Number(e.target.value) || 0 })} />
          </Field>
        </div>
        <Field label="Días para pasar a limpio" hint="A partir de cuántos días un tema visto en clase sin pasar a limpio se marca como urgente.">
          <input
            type="number"
            min={0}
            max={14}
            defaultValue={settings.cleanupThresholdDays}
            onBlur={(e) => updateSettings({ cleanupThresholdDays: Number(e.target.value) || 0 })}
          />
        </Field>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Horario de clases y prácticas</h2>
        <p className="text-xs text-slate-500">Lo usará el planificador semanal (fase 3).</p>
        {sortedSchedule.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50">
            <span>
              <strong>{WEEKDAYS[s.weekday - 1]}</strong> {s.start}–{s.end} {s.label && `· ${s.label}`}
            </span>
            <Button variant="ghost" aria-label="Quitar franja" onClick={() => updateSettings({ schedule: settings.schedule.filter((x) => x.id !== s.id) })}>
              ✕
            </Button>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_auto_auto_1fr_auto]">
          <select aria-label="Día" value={slot.weekday} onChange={(e) => setSlot({ ...slot, weekday: Number(e.target.value) })}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
          <input aria-label="Etiqueta" placeholder="Clases / Prácticas" value={slot.label} onChange={(e) => setSlot({ ...slot, label: e.target.value })} />
          <input aria-label="Desde" type="time" value={slot.start} onChange={(e) => setSlot({ ...slot, start: e.target.value })} />
          <input aria-label="Hasta" type="time" value={slot.end} onChange={(e) => setSlot({ ...slot, end: e.target.value })} />
          <Button
            className="col-span-2 sm:col-span-1"
            disabled={slot.end <= slot.start}
            onClick={() => updateSettings({ schedule: [...settings.schedule, { ...slot, id: newId() }] })}
          >
            + Añadir
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Apariencia</h2>
        <div className="flex gap-2">
          {(
            [
              ['system', 'Automático'],
              ['light', 'Claro'],
              ['dark', 'Oscuro'],
            ] as [Theme, string][]
          ).map(([value, label]) => (
            <Button key={value} variant={settings.theme === value ? 'primary' : 'secondary'} onClick={() => updateSettings({ theme: value })}>
              {label}
            </Button>
          ))}
        </div>
      </Card>

      <Modal open={pending !== null} onClose={() => setPending(null)} title="Importar copia">
        {pending && (
          <div className="flex flex-col gap-4 text-sm">
            <p>
              Copia del {new Date(pending.summary.exportedAt).toLocaleString('es-ES')}: {pending.summary.subjects} asignaturas, {pending.summary.topics} temas y{' '}
              {pending.summary.tasks} entregas.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="primary" onClick={() => doImport('merge')}>
                Fusionar con mis datos
              </Button>
              <p className="text-xs text-slate-500">Añade lo nuevo y, si algo está en los dos sitios, se queda la versión más reciente.</p>
              <Button variant="danger" onClick={() => doImport('replace')}>
                Reemplazar todo
              </Button>
              <p className="text-xs text-slate-500">Borra los datos de este dispositivo y deja exactamente los de la copia.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
