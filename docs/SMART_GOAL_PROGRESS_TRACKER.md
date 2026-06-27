# SMART Goal Progress Tracker

Módulo de seguimiento inteligente del progreso de objetivos SMART, con un
**cilindro de avance 3D** en tiempo real, distribución de aportes por persona,
detección de riesgos, predicción de cierre, salud del proyecto, línea de tiempo
automática y un copiloto de IA. Pensado para la **vista del líder**.

> Implementado sobre el stack existente (Next.js 16 · React 19 · Drizzle ORM
> · PostgreSQL · Vertex AI Gemini 2.5 Flash · Tailwind v4) y siguiendo la
> arquitectura DDD por features del repositorio.

---

## 0. Mapa de archivos implementados

```
src/features/projects/
├── domain/
│   ├── entities/SmartGoal.ts                       # entidades + JSON result types
│   ├── repositories/IGoalProgressRepository.ts     # contrato del repositorio
│   └── progress/                                   # ⭐ AI Progress Engine (puro)
│       ├── index.ts                                #   orchestrator computeGoalProgress()
│       ├── progressEngine.ts                       #   % avance / status / velocidad
│       ├── contributionEngine.ts                   #   distribución + 5 scores
│       ├── riskEngine.ts                           #   detección + clasificación
│       ├── predictionEngine.ts                     #   ETA / probabilidad / riesgo
│       ├── healthEngine.ts                         #   health / delivery / burn
│       ├── timelineEngine.ts                       #   timeline + insights heurísticos
│       └── smartValidator.ts                       #   validación SMART
├── application/use-cases/
│   ├── GetGoalProgress.ts                          # carga + autoriza + computa
│   ├── ManageSmartGoal.ts                          # create / update / validate SMART
│   ├── AskGoalCopilot.ts                           # copiloto NL
│   └── progressEngines.test.ts                     # 14 tests (pasan)
├── infrastructure/repositories/
│   └── PrismaGoalProgressRepository.ts
└── presentation/components/
    ├── SmartCylinder.tsx                           # 🎯 cilindro 3D animado (SVG)
    ├── GoalProgressTracker.tsx                     # dashboard líder completo
    └── GoalCopilotChat.tsx                         # chat copiloto

src/server/lib/goalInsight.ts                       # Gemini insights + fallback
src/server/lib/container.ts                         # registra goalProgressRepository
src/server/lib/apiErrors.ts                         # field hints SMART

src/app/api/goals/
├── route.ts                                        # GET list, POST create
├── [id]/route.ts                                   # GET, PATCH
├── [id]/progress/route.ts                          # GET reporte completo
└── [id]/copilot/route.ts                           # POST pregunta NL

src/app/(app)/progress/                             # 🎯 sección Progreso del líder
├── page.tsx                                        # server (auth + rol líder)
└── ProgressClient.tsx                              # client shell + selector de objetivo

src/features/navigation/components/DesktopSidebar.tsx  # entrada "Progreso" (líder)
```

---

## 1. Historias de usuario

| ID | Como… | quiero… | para… |
|----|-------|---------|-------|
| US-01 | Líder | crear un objetivo SMART con métrica, responsable, fecha y peso | alinear al equipo |
| US-02 | Líder | ver un cilindro que se llena en tiempo real | sentir el avance de un vistazo |
| US-03 | Líder | ver el aporte % de cada miembro como capa de color | reconocer y redistribuir carga |
| US-04 | Líder | ver status, velocidad y ritmo vs. lo esperado | saber si vamos a tiempo |
| US-05 | Líder | leer observaciones automáticas de la IA | decidir sin analizar todo manualmente |
| US-06 | Líder | ver riesgos clasificados (bajo→crítico) | actuar antes de que escalen |
| US-07 | Líder | ver la predicción de fecha y probabilidad de éxito | comunicar expectativas reales |
| US-08 | Líder | ver health score y delivery confidence | tener un pulso del proyecto |
| US-09 | Líder | ver una línea de tiempo auto-generada | reconstruir el contexto |
| US-10 | Líder | preguntarle al copiloto en lenguaje natural | obtener respuestas sin abrir reportes |
| US-11 | Miembro | consultar el progreso (solo lectura) | saber dónde aportar |

---

## 2. Casos de uso

- **UC-1 Crear objetivo SMART** → `POST /api/goals` → `CreateSmartGoal`.
- **UC-2 Editar objetivo** → `PATCH /api/goals/:id` → `UpdateSmartGoal` (solo líder).
- **UC-3 Ver progreso completo** → `GET /api/goals/:id/progress` → `GetGoalProgress` + `generateGoalInsights`.
- **UC-4 Validar SMART** → `validateSmartGoal` (embebido en el reporte).
- **UC-5 Preguntar al copiloto** → `POST /api/goals/:id/copilot` → `AskGoalCopilot`.
- **UC-6 Selección de objetivo activo** → `ProgressClient` selector de chips.

---

## 3. Arquitectura técnica

```
┌────────────────────────── Presentation (React) ──────────────────────────┐
│ ProgressClient → GoalProgressTracker → SmartCylinder + paneles + Copilot │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ fetch (poll 30s)
┌───────────────▼─────────────── API Routes (Next App Router) ──────────────┐
│ /api/goals · /api/goals/:id · /api/goals/:id/progress · /:id/copilot     │
└───────────────┬──────────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────── Application (use-cases + Zod) ────────────┐
│ GetGoalProgress · CreateSmartGoal · UpdateSmartGoal · ValidateSmartGoal │
│ AskGoalCopilot                                                           │
└───────────────┬──────────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────── Domain (puro, sin framework) ─────────────┐
│ computeGoalProgress = progress + contribution + risk + prediction        │
│                       + health + timeline + insight  (+ smartValidator)  │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ IGoalProgressRepository (interfaz)
┌───────────────▼─────────────── Infrastructure ───────────────────────────┐
│ PrismaGoalProgressRepository → PostgreSQL (Goal, Milestone, Task, User)  │
│ goalInsight.ts (Gemini + fallback heurístico)                            │
└──────────────────────────────────────────────────────────────────────────┘
```

**Regla clave**: las engines son **puras y determinísticas** (sin BD ni IA), lo
que las hace testeables y predecibles. La IA (Gemini) **enriquece** insights y
responde el copiloto, pero siempre hay **fallback heurístico** — convención del
repo ("fallback to existing heuristics if Gemini disabled/fails").

---

## 4. Diseño de base de datos

Reutiliza modelos existentes (sin migraciones nuevas):

| Modelo | Rol en el módulo |
|--------|------------------|
| `Goal` | núcleo SMART: `specific/measurable/achievable/relevant/deadline/status` |
| `Milestone` | hitos (peso 40% del avance) |
| `Task` (`smartGoalId`) | entregables (peso 60%, ponderado por `load`) |
| `Membership` | miembros del proyecto (para distribución de aportes) |
| `UserMetric` / `TeamMetric` | series temporales listas para velocity/throughput |

> Para escalar (peso de objetivo, KPIs, dependencias explícitas, snapshots de
> progreso) se añadirían columnas opcionales a `Goal` y una tabla
> `GoalProgressSnapshot` (ver §13 Roadmap).

---

## 5. APIs REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/goals` | Lista los objetivos del workspace activo |
| `POST` | `/api/goals` | Crea un objetivo SMART |
| `GET` | `/api/goals/:id` | Obtiene un objetivo |
| `PATCH` | `/api/goals/:id` | Edita (solo líder) |
| `GET` | `/api/goals/:id/progress` | **Reporte completo** (engines + insights IA) |
| `POST` | `/api/goals/:id/copilot` | Pregunta en lenguaje natural |

Respuesta de `/progress` (tipada en `GoalProgressReport`):

```json
{
  "goalId": "…", "goalTitle": "…", "computedAt": "2026-…",
  "progress": { "goalProgress": 65, "expectedProgress": 72, "pending": 35, "status": "Behind Schedule", "velocity": 4.2, "pace": "Slow" },
  "contributions": { "members": [{ "name": "Sara", "share": 25, "contributionScore": 92, "deliveryScore": 80, "qualityScore": 78, "collaborationScore": 70, "reliabilityScore": 90, "color": "#7c9cff" }], "teamShare": 2 },
  "risks": [{ "level": "high", "type": "behind_schedule", "title": "…", "detail": "…" }],
  "prediction": { "completionProbability": 87, "estimatedFinishDate": "2026-10-15", "riskLevel": "Medium", "daysEarlyOrLate": 3 },
  "health": { "healthScore": 84, "deliveryConfidence": 89, "burnRate": 0.55, "teamEfficiency": 76, "goalAlignment": 100 },
  "timeline": [{ "date": "2026-10-12", "type": "milestone", "title": "…", "responsible": "Sara", "impact": "high" }],
  "insights": [{ "kind": "gap", "text": "El proyecto avanza un 7% por debajo del ritmo esperado." }],
  "usedGemini": true
}
```

---

## 6. Eventos de tiempo real

- **Polling client (30s)** en `GoalProgressTracker` → cerca de "tiempo real" sin
  infraestructura adicional.
- **Escalado**: sustituir por WebSocket / Server-Sent Events emitidos al
  invalidar tareas/hitos (eventos `task.completed`, `milestone.completed`,
  `goal.updated`) y un job que recalcule el snapshot.

---

## 7. Algoritmo de progreso (`progressEngine.ts`)

```
peso(load)  = Light 1, Medium 2, Heavy 3
taskTotal   = Σ peso(t) sobre todas las tareas
mileTotal   = max(#milestones, 1)
mileRatio   = milestones_done / mileTotal
taskRatio   = Σ peso(t_done) / taskTotal

goalProgress = 100 · (0.4·mileRatio + 0.6·taskRatio)   [o señal única]
expected     = clamp((now − created) / (deadline − created) · 100)
status       = Not Started | At Risk | Behind | On Track | Ahead | Completed
               (gap = expected − progress; gaps ≥20 → At Risk, ≥8 → Behind)
velocity     = peso_completado / semanas_transcurridas
pace         = Fast | Steady | Slow (según progress − expected)
```

---

## 8. Algoritmo de contribución (`contributionEngine.ts`)

```
puntos(u) = Σ peso(t_done donde t.userId=u)  +  milestoneBonus·#milestones_done (al owner)
share(u)  = puntos(u) / Σ puntos · 100

contributionScore = share·1.1 + completionRate·20
deliveryScore     = completionRate·80 + avgLoad·5
qualityScore      = completionRate·70 + reliability·0.3
collaborationScore= base + completionRate·30
reliabilityScore  = onTimeCompletions / completions · 100
```

Cada miembro recibe un `color` estable (paleta cálida) que se pinta como **capa
apilada dentro del cilindro**.

---

## 9. Modelos de IA

| Componente | Modelo | Entrada | Salida | Fallback |
|------------|--------|---------|--------|----------|
| Insight Generator | Gemini 2.5 Flash (`generateJSON`) | reporte determinístico | 3-5 insights ES | heurísticos de `generateHeuristicInsights` |
| Copilot Q&A (RAG sobre el reporte) | Gemini 2.5 Flash | pregunta + reporte | respuesta ES ≤3 frases | `buildFallbackAnswer` |
| SMART Validator | heurístico (sin IA) | campos SMART | score + checks | — |

El reporte es el contexto de recuperación (RAG *over-the-report*): la IA nunca
inventa números, se ancla al cálculo determinístico.

---

## 10. KPIs del sistema

- `goalProgress`, `expectedProgress`, `gap` (desviación)
- `velocity` (peso/sem), `pace`
- `healthScore`, `deliveryConfidence`, `burnRate`, `teamEfficiency`, `goalAlignment`
- `completionProbability`, `daysEarlyOrLate`
- `riskLevel` (máx), conteo de señales por nivel
- `share` por miembro + 5 scores
- `usedGemini` (cobertura de IA)
- Latencia p95 de `/progress`, % de fallback a heurística

---

## 11. Wireframes (sección Progreso del líder)

```
┌─ Progreso del objetivo ───────────────────────────────────┐
│ Avance real 53% · Esperado 64% · Pendiente 47% · Behind   │
├───────────────────┬───────────────────────────────────────┤
│   ╱─────╲         │  SALUD        │  PREDICCIÓN           │
│  │       │        │  [84] ring    │  [87%] ring           │
│  │ ▓▓▓▓▓ │ ←65%   │  conf 89      │  ETA 15 oct · Medio   │
│  │ ▓▓▓▓▓ │        │  burn 55%     │  +3 días              │
│  │ ░░░░░ │        │  align 100    │                       │
│   ╲─────╱ - - meta│               │                       │
│   65% Behind      │               │                       │
│ ● Sara 60% ● Mark │               │                       │
├───────────────────┴───────────────────────────────────────┤
│ 🤖 Observaciones de la IA  [Gemini]                        │
│  • El proyecto avanza un 11% por debajo del ritmo…         │
│  • Sara concentra el 60% de las contribuciones.            │
├────────────────────────────────────────────────────────────┤
│ Aportes individuales  Sara ◐ 92/80/78/70/90  …             │
├────────────────────────────────────────────────────────────┤
│ 🛡 Detección de riesgos   [Alto] Por detrás del ritmo…     │
├────────────────────────────────────────────────────────────┤
│ Línea de tiempo   15 oct · Objetivo creado · Sara · alto   │
│                   12 oct · Hito Alpha · Sara · alto        │
├────────────────────────────────────────────────────────────┤
│ 🤖 Copiloto  [¿Quién aporta más?] [¿Llegaremos a tiempo?]  │
│            _______________________________________  ➤      │
└────────────────────────────────────────────────────────────┘
```

---

## 12. Plan MVP para hackathon (entregado ✅)

| Sprint | Alcance | Estado |
|--------|---------|--------|
| S1 | Domain + engines puros + tests | ✅ |
| S2 | Repositorio + use-cases + API | ✅ |
| S3 | Cilindro 3D + dashboard líder + página | ✅ |
| S4 | Copiloto + insights Gemini con fallback | ✅ |
| S5 | Nav líder + field hints | ✅ |

Verificación: `npm run test:run -- progressEngines` → **14/14 ✓**, ESLint 0
errores, TypeScript sin errores en archivos nuevos.

---

## 13. Roadmap de escalamiento enterprise

1. **Persistencia de snapshots** (`GoalProgressSnapshot`) para histórico y
   graficar tendencias sin recalcular.
2. **WebSocket/SSE** con eventos `task.completed`, `milestone.completed`,
   `goal.updated` para tiempo real real (miles de proyectos concurrentes).
3. **Embeddings + Vector DB** (pgvector) sobre conversaciones/PRs/commits para
   detectar aportes no explícitos en tareas (RAG profundo).
4. **Fuentes externas**: GitHub (PRs/commits), Jira (tickets), Linear, Slack.
5. **Pesos configurables** por objetivo, KPIs y dependencias explícitas (DAG) →
   reordenar el cálculo cuando una dependencia bloquea.
6. **Multi-tenant**: aislamiento por workspace, rate-limit por plan, caché Redis
   del reporte con invalidación por evento.
7. **Modelos**: añadir regresión de Monte Carlo sobre velocity para bandas de
   probabilidad (P50/P90).
8. **Observabilidad**: tracing por engine, feature flags de IA, A/B de copy.

---

## 14. Riesgos técnicos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Latencia de recálculo en objetivos grandes | Medio | Snapshot precomputado + caché Redis invalidado por evento |
| Costo/cuota de Gemini | Medio | Fallback heurístico garantizado, rate-limit, cacheo de insights |
| Aportes sesgados (solo tareas, ignora code review) | Medio | Pesos configurables + integración PR/review (Roadmap §13.4) |
| Milestones sin `completedAt` | Bajo | Aproximar con `dueDate`/`createdAt`; añadir columna en Roadmap |
| Concurrencia (miles de proyectos) | Alto | SSE fan-out + workers de recálculo + partición por workspace |
| Privacidad en el copiloto | Alto | RAG solo sobre el reporte del workspace autorizado; sin cross-tenant |
