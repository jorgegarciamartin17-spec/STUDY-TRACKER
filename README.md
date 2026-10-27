# Tracker de Estudios

Aplicación web para llevar al día las asignaturas de la carrera. Cada día te dice qué toca hacer para ir al día con lo nuevo (pasar a limpio, hacer ejercicios, entregas) y te avisa de qué asignaturas se están quedando atrás.

- Funciona en el móvil y en el ordenador, y se puede instalar como una app.
- Funciona sin conexión.
- Tus datos se guardan **solo en tu navegador**: no hay servidor ni cuenta.

> Estado: **fase 1 (MVP)**. Las fases siguientes añadirán repasos espaciados, planificador semanal, estadísticas y flashcards.

---

## Cómo usarla

### Pantalla «Hoy» (la principal)

Al abrir la app ves la lista de lo que toca hoy, ordenada por prioridad:

| Grupo | Qué entra |
| --- | --- |
| **Urgente** | Entregas que vencen hoy, mañana o ya vencidas, y temas vistos en clase hace muchos días sin pasar a limpio. |
| **Para hoy** | Lo siguiente más importante, hasta llenar el tiempo que tienes para estudiar hoy. |
| **Si te da tiempo** | Lo que no cabe en tu tiempo de hoy (pulsa «Mostrar» para verlo). |

En cada tarea:

- **✓** la marca como hecha. Si es un tema, avanza solo al siguiente estado (por ejemplo, de «Visto» a «Apuntes a limpio»).
- **Mañana** la pospone hasta mañana.
- Si te equivocas, pulsa **Deshacer** en el aviso que aparece abajo.

Arriba ves cuánto tiempo suma el plan de hoy frente al que tienes disponible, y los exámenes y parciales de los próximos 30 días.

### Asignaturas y temas

1. En **Asignaturas → + Nueva** crea cada asignatura con su color, profesor, fecha del examen final, parciales (con el último tema que entra) y número de temas.
2. Dentro de una asignatura, **toca el estado de un tema para avanzarlo**:
   Pendiente → Visto en clase → Apuntes a limpio → Ejercicios hechos → Repasado.
3. Toca el nombre de un tema para cambiarle el título, elegir un estado concreto, escribir notas o dudas, marcarlo «para tutoría» o reordenarlo.

**Truco:** el día que veas un tema en clase, márcalo como «Visto». A partir de ahí la app te recordará pasarlo a limpio, y si pasan más de 3 días lo subirá a urgente.

### Panel

Muestra el avance de cada asignatura (porcentaje de temas en cada estado), los días que faltan para la próxima evaluación y un semáforo de riesgo:

- 🟢 **Al día**: tu avance está como mucho 10 puntos por debajo de lo esperado.
- 🟡 **Atención**: entre 10 y 25 puntos por debajo.
- 🔴 **En riesgo**: más de 25 puntos por debajo, o más de 3 temas vistos sin pasar a limpio.

El avance esperado crece en línea recta desde el inicio del cuatrimestre hasta una semana antes del examen (esa última semana queda para repasar). Si hay un parcial próximo, se mide solo con los temas que entran en él. También verás aquí los temas que marcaste para tutoría.

### Entregas

Informes de prácticas, boletines de problemas y trabajos, con su fecha de entrega y tiempo estimado. Aparecen en «Hoy» cuando faltan 7 días o menos.

### Ajustes

- Curso, fecha de inicio del cuatrimestre y tiempo para estudiar entre semana y en fin de semana.
- Días a partir de los cuales un tema sin pasar a limpio se vuelve urgente (3 por defecto).
- Horario de clases y prácticas (lo usará el planificador de la fase 3).
- Tema claro, oscuro o automático.
- Copia de seguridad.

---

## Copia de seguridad de tus datos

Los datos viven solo en el navegador del dispositivo donde usas la app. Si borras los datos del navegador o pierdes el móvil, se pierden. Por eso:

1. **Exporta una copia cada semana**: Ajustes → **Exportar JSON**. Se descarga un archivo `estudios-copia-AAAA-MM-DD.json`. En el móvil también puedes usar **Compartir copia** para mandarlo directamente a Drive, iCloud, tu correo, etc.
2. Guarda ese archivo en tu nube.
3. La app te recuerda en «Hoy» si llevas más de 7 días sin hacer copia.

**Restaurar o pasar datos entre móvil y ordenador:** Ajustes → **Importar JSON** y elige el archivo. Te enseña un resumen y te deja elegir:

- **Fusionar con mis datos**: añade lo que falte y, si algo está en los dos sitios, se queda la versión modificada más recientemente.
- **Reemplazar todo**: borra los datos de este dispositivo y deja exactamente los de la copia.

---

## Instalarla en el móvil

Abre la dirección de la app en el navegador del móvil:

- **Android (Chrome)**: menú ⋮ → **Instalar aplicación** (o «Añadir a pantalla de inicio»).
- **iPhone (Safari)**: botón compartir → **Añadir a pantalla de inicio**.

Se abrirá como una app normal y funcionará sin conexión. Las actualizaciones se instalan solas la siguiente vez que la abras con conexión.

> El móvil y el ordenador tienen datos separados. Usa exportar/importar para pasar los datos de uno a otro.

---

## Para desarrolladores: cómo arrancarla

Requisitos: [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install       # instalar dependencias (solo la primera vez)
npm run dev       # servidor de desarrollo en http://localhost:5173
npm test          # tests de la lógica
npm run build     # versión de producción en dist/
npm run preview   # sirve dist/ en http://localhost:4173 (con modo sin conexión)
```

### Publicación

Cada cambio en la rama `main` se publica automáticamente en GitHub Pages con el flujo `.github/workflows/deploy.yml`. Para activarlo una vez: en GitHub, **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### Estructura

```
src/
  db/          tipos, esquema de IndexedDB (Dexie) y datos de precarga (seed.ts)
  data/        repositorio (única API de lectura/escritura), hooks y copia de seguridad
  domain/      lógica pura: fechas, prioridades de Hoy, avance y riesgo
  features/    pantallas: Hoy, Asignaturas, Panel, Entregas, Ajustes
  components/  piezas de interfaz reutilizables
  sync/        sitio reservado para sincronización en la nube (sin implementar)
tests/         tests de la lógica, la precarga y la copia de seguridad
```

**Precarga:** `src/db/seed.ts` contiene las asignaturas, temas y entregas que se cargan la primera vez que se abre la app en un dispositivo. Después todo se edita desde la propia app.

**Sincronización futura:** todos los registros tienen `id` (UUID), `updatedAt` y `deletedAt` (borrado lógico). `src/sync/SyncAdapter.ts` explica cómo conectar Supabase sin tocar las pantallas.
