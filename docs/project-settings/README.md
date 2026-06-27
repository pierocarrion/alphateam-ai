# Módulo: Configuración del Proyecto (Project Settings)

Módulo completo para que líderes de proyecto configuren los parámetros
estratégicos y operativos (objetivo SMART, metodología, equipo, KPIs) que el
motor de IA usa para generar recomendaciones, métricas y seguimiento.

> **Stack real usado** (adaptado al repo `alphalead-ai`): Next.js 16 (Route
> Handlers) + React 19 + Drizzle ORM (PostgreSQL/PGlite) + Zod 4 + React Query 5
> + Zustand + TailwindCSS 4 (dark mode corporativo) + Vertex AI (Gemini) +
> NextAuth. Arquitectura feature-based por capas (`domain / application /
> infrastructure / presentation`). El prompt original mencionaba .NET 9/CQRS,
> pero el equipo decidió reutilizar el backend Next.js existente para no
> fragmentar la plataforma; el diseño de dominio aplica los mismos principios
> (casos de uso, repositorios, DTOs, validación, RBAC).

---

## Mapa de entregables

| # | Entregable | Sección |
|---|------------|---------|
| 1 | Historias de usuario | [1](#1-historias-de-usuario) |
| 2 | Casos de uso | [2](#2-casos-de-uso) |
| 3 | Diagramas de arquitectura | [3](#3-diagramas-de-arquitectura) |
| 4 | Modelo de base de datos | [4](#4-modelo-de-base-de-datos) |
| 5 | APIs completas | [5](#5-apis-rest) |
| 6 | Entidades y DTOs | [6](#6-entidades-y-dtos) |
| 7 | Wireframes | [7](#7-wireframes) |
| 8 | Diseño UI | [8](#8-diseño-ui) |
| 9 | Flujo de navegación | [9](#9-flujo-de-navegación) |
| 10 | Estructura de carpetas | [10](#10-estructura-de-carpetas) |
| 11 | Código base frontend | [11](#11-código-base-frontend) |
| 12 | Código base backend | [12](#12-código-base-backend) |
| 13 | Pruebas unitarias | [13](#13-pruebas-unitarias) |
| 14 | Pruebas de integración | [14](#14-pruebas-de-integración) |
| 15 | Estrategia de despliegue | [15](#15-estrategia-de-despliegue) |
| 16 | Criterios de aceptación | [16](#16-criterios-de-aceptación) |
| 17 | Riesgos técnicos | [17](#17-riesgos-técnicos) |
| 18 | Estimación por tareas | [18](#18-estimación-por-tareas) |
| 19 | Roadmap | [19](#19-roadmap-de-implementación) |
| 20 | Documentación técnica | todo este documento |

---

## 1. Historias de usuario

**Épico: Project Leader / PM**

- **US-SMART-01** — Como líder, quiero redactar el objetivo SMART en 5 campos
  para que la IA lo entienda. _(Must)_
- **US-SMART-02** — Como líder, quiero ver un indicador de completitud SMART
  para saber qué falta. _(Must)_
- **US-SMART-03** — Como líder, quiero que la IA valide y sugiera mejoras al
  objetivo. _(Should)_
- **US-SMART-04** — Como líder, quiero consultar el historial de versiones del
  objetivo. _(Should)_
- **US-METH-01** — Como líder, quiero elegir 1 metodología principal de una
  galería de tarjetas. _(Must)_
- **US-METH-02** — Como líder, quiero añadir metodologías secundarias. _(Should)_
- **US-METH-03** — Como líder, quiero confirmar antes de cambiar la
  metodología principal. _(Must)_
- **US-TEAM-01** — Como líder, quiero invitar miembros por correo y asignar rol. _(Must)_
- **US-TEAM-02** — Como líder, quiero cambiar el rol/estado de un miembro. _(Must)_
- **US-TEAM-03** — Como líder, no quiero poder dejar el proyecto sin líderes. _(Must)_
- **US-TEAM-04** — Como líder, quiero bloquear correos duplicados. _(Must)_
- **US-KPI-01** — Como líder, quiero activar/desactivar KPIs como chips. _(Must)_
- **US-KPI-02** — Como líder, quiero fijar meta y umbral de alerta por KPI. _(Should)_
- **US-KPI-03** — Como líder, quiero ver la tendencia histórica de un KPI. _(Should)_
- **US-AI-01** — Como líder, quiero que la IA genere riesgos, recomendaciones y
  un plan de acción a partir de la configuración. _(Must)_
- **US-AI-02** — Como líder, quiero ver métricas sugeridas y distribución de
  trabajo recomendada. _(Should)_
- **US-SEC-01** — Como Super Admin, solo líderes/admins deben poder editar la
  configuración. _(Must)_

## 2. Casos de uso

Implementados como clases en `application/use-cases/`:

| Caso de uso | Archivo | Actor | Descripción |
|---|---|---|---|
| `SaveSmartGoal` | `SaveSmartGoal.ts` | Leader | Upsert + versionado + score heurístico + auditoría |
| `AnalyzeSmartGoal` (AI) | vía `analyzeSmartGoalWithAi` | Leader | Validación IA con feedback + draft mejorado |
| `SetMethodology` | `SetMethodology.ts` | Leader | 1 primary + N secondary, validación de catálogo |
| `InviteMember` | `ManageMembers.ts` | Leader | Invita por email, valida duplicidad |
| `UpdateMember` | `ManageMembers.ts` | Leader | Cambia rol/permiso/estado; guarda último líder |
| `RemoveMember` | `ManageMembers.ts` | Leader | Elimina; bloquea último líder |
| `ConfigureKpis` | `ConfigureKpis.ts` | Leader | Toggle + metas + alertas |
| `GenerateAiInsights` | `GenerateAiInsights.ts` | Leader | Lee config → Vertex AI → persiste insights |

**Reglas de negocio clave (en código):**
- `computeSmartScore` (heura) y `validateSmart` — `application/smart.ts`
- Último líder: `UpdateMember`/`RemoveMember` consultan `countActiveLeaders`.
- Duplicidad de email: `emailExists` revisa `Membership` + `ProjectInvitation`.
- Solo 1 metodología principal: `SetMethodology` borra y reescribe.

## 3. Diagramas de arquitectura

### 3.1 Capas (Clean Architecture adaptada)

```
┌──────────────────────── Presentation (React) ─────────────────────────┐
│  ProjectSettingsModule (tabs)                                          │
│   ├── SmartGoalEditor  MethodologyPicker  TeamManager                  │
│   ├── KpiChips         AiInsightsPanel                                 │
│  hooks.ts (React Query) ← services.ts (fetchJson) ← /api/workspaces    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │  HTTPS / JSON (Zod en borde)
┌────────────────────────── API (Route Handlers) ───────────────────────┐
│  /api/workspaces/[id]/{settings,smart-goal,smart-goal/analyze,         │
│                       methodology,members,members/[m],kpis,ai-insights}│
│  requireProjectLeader() (RBAC: leader|admin) → getProjectSettingsDeps()│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌─────────────────────────── Application (use cases) ───────────────────┐
│  SaveSmartGoal  SetMethodology  ManageMembers  ConfigureKpis           │
│  GenerateAiInsights   +   Zod schemas   +   smart.ts (heura)           │
└───────────────┬───────────────────────────────────────┬────────────────┘
                │                                       │ Vertex AI (Gemini)
┌───────────────▼ Domain (entities/repos) ──────────────▼───────────────┐
│  ISmartGoalRepository · IMethodologyRepository · IMemberRepository     │
│  IKpiRepository · IAiInsightRepository · IAuditRepository              │
└───────────────┬────────────────────────────────────────────────────────┘
┌───────────────▼ Infrastructure (Drizzle) ──────────────────────────────┐
│  PrismaSmartGoalRepository ... PrismaAuditRepository                   │
│  → drizzle (PostgreSQL / PGlite) + AuditLog                             │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Flujo de "Generar insights IA"

```
UI → POST /ai-insights
      → requireProjectLeader (403 si no leader)
      → GenerateAiInsights.execute
           ├─ read: smartGoal + methodologies + members + kpis
           ├─ map → ProjectContextForAi
           ├─ generateProjectInsights (Vertex AI, JSON schema)
           ├─ aiInsightRepository.replace (transacción)
           └─ auditRepository.record("insight.generate")
      ← { bundle, insights }
```

## 4. Modelo de base de datos

Tablas (Drizzle, ver `drizzle/schema/project.ts` + migración
`drizzle/0000_init.sql`):

| Tabla | PK | FK / Índices | Auditoría | Soft-delete |
|---|---|---|---|---|
| `ProjectSmartGoal` | id | `workspaceId @unique` → Workspace | updatedAt | cascade delete |
| `SmartGoalVersion` | id | `smartGoalId` → ProjectSmartGoal, idx (goalId,version) | createdAt | cascade |
| `ProjectRole` | id | `roleKey @unique` (catálogo) | — | — |
| `ProjectMethodology` | id | (workspaceId,methodologyKey) unique; idx (workspaceId,tier) → Workspace | updatedAt | cascade |
| `KpiDefinition` | id | `kpiKey @unique` (catálogo) | — | — |
| `ProjectKpi` | id | (workspaceId,kpiKey) unique; idx (workspaceId,enabled) → Workspace | updatedAt | cascade |
| `ProjectKpiSnapshot` | id | `projectKpiId` → ProjectKpi, idx (kpiId,capturedAt) | capturedAt | cascade |
| `ProjectAiInsight` | id | idx (workspaceId,type),(createdAt) → Workspace | createdAt | cascade |
| `ProjectInvitation` | id | (workspaceId,email) unique; idx (status) → Workspace | updatedAt | cascade |
| `AuditLog` | id | idx (workspaceId,entity),(createdAt) | createdAt | — |
| `Membership` (ext.) | id | projectRole, status, photoUrl, invitedEmail, updatedAt añadidos; idx (ws,status),(ws,projectRole) | updatedAt | status=inactive |

**Resumen de relaciones:** un `Workspace` (≡ "Proyecto") tiene 1 `ProjectSmartGoal`,
N `ProjectMethodology`, N `ProjectKpi` (con N `ProjectKpiSnapshot`), N
`ProjectAiInsight`, N `ProjectInvitation`, N `AuditLog` y N `Membership`.

## 5. APIs REST

Todas bajo `/api/workspaces/[id]/...` (id = workspaceId). **RBAC**: todas
requieren sesión + rol `leader`/`admin` vía `requireProjectLeader` (403 si no,
404 si no existe el proyecto, 401 si no autenticado). Errores centralizados en
`apiErrors.ts` (`{ error }` + status friendly, incluyendo 503 IA).

| Método | Ruta | Body / Query | Respuesta |
|---|---|---|---|
| GET | `/settings` | — | snapshot completo + catálogos |
| GET | `/smart-goal` | — | `{ smartGoal, versions }` |
| PUT | `/smart-goal` | SmartGoalInput | `{ smartGoal }` |
| POST | `/smart-goal/analyze` | — | `{ analysis }` (IA) |
| GET | `/methodology` | — | `{ methodologies }` |
| PUT | `/methodology` | `{ primary, secondary[] }` | `{ methodologies }` |
| GET | `/members` | — | `{ members, invitations }` |
| POST | `/members` | `{ email, projectRole }` | `{ invitation }` (201) |
| PUT | `/members/[memberId]` | MemberUpdateInput | `{ member }` |
| DELETE | `/members/[memberId]` | — | `{ ok }` |
| GET | `/kpis` | — | `{ kpis }` |
| PUT | `/kpis` | `{ entries[] }` | `{ kpis }` |
| GET | `/ai-insights` | — | `{ insights }` |
| POST | `/ai-insights` | — | `{ bundle, insights }` |

(Existen además `GET/PATCH /api/workspaces/[id]` para identidad del proyecto.)

## 6. Entidades y DTOs

- **Entidades de dominio** (`domain/entities.ts`): `SmartGoal`,
  `SmartGoalVersion`, `ProjectMethodologySelection`, `ProjectMember`,
  `ProjectInvitation`, `ProjectKpi`, `ProjectAiInsight`.
- **DTOs de entrada** (Zod, `application/schemas.ts`): `smartGoalSchema`,
  `methodologySchema`, `memberUpdateSchema`, `inviteSchema`, `kpiConfigSchema`.
- **Catálogos** (`domain/catalog.ts`): `METHODOLOGIES` (5), `PROJECT_ROLES`
  (12, marca `isLeadership`), `KPI_CATALOG` (11), con `roleName`,
  `isLeadershipRole`, `INSIGHT_TYPES`, `SEVERITIES`.
- **Contratos IA** (`server/lib/projectSettingsAi.ts`):
  `SmartValidationResult`, `ProjectContextForAi`, `GeneratedInsight`,
  `AiInsightBundle`.

## 7. Wireframes

```
┌─ /project/settings ────────────────────────────────────────────────┐
│ Coordinación                                                       │
│ Configuración del proyecto 🚀 Acme                                 │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ [🎯 SMART] [🔁 Metodología] [👥 Equipo] [📊 KPIs] [✨ IA]     │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ SMART tab:                                                         │
│ ┌───────────────────────────────────────────┬──────┐               │
│ │ Título: [_______________________]         │ ◯ 78 │ (ScoreRing)  │
│ │ ┌───────────────┬───────────────┐         │      │               │
│ │ │ Specific ✓    │ Measurable •  │         │      │               │
│ │ │ [textarea]    │ [textarea]    │         │      │               │
│ │ └───────────────┴───────────────┘         │      │               │
│ │ Deadline [date]                            │      │               │
│ │            [Analizar con IA] [Guardar]     │      │               │
│ │ ▸ Análisis IA: checklist + sugerencias     │      │               │
│ └───────────────────────────────────────────┴──────┘               │
│                                                                    │
│ Metodología:  [Scrum ✓ PRINCIPAL] [Kanban SEC]  (+ confirm change) │
│ Equipo:       tabla miembros | rol▼ | estado | + Invitar (modal)   │
│ KPIs:         chips toggle | meta/alerta | sparkline tendencia     │
│ IA:           [Generar insights] → plan, métricas, workload, cards │
└────────────────────────────────────────────────────────────────────┘
```

Estados cubiertos: **Loading** (`Spinner`), **Empty** (`EmptyState`),
**Success** (`toast`), **Error** (`isError` card + provider toast),
**Permission Denied** (redirect server-side a `/home` + 403 en API).

## 8. Diseño UI

- **Tema**: Dark mode corporativo (tokens de `globals.css`: `bg #15131a`,
  `surface`, `accent #e6ac73`, `glow #b6a6e0`, `sage #93c2a2`).
- **Mobile first**: layout `max-w-3xl`, grids `1 → 2` cols en `md`.
- **Componentes**: `Card`, `Button` (variantes primary/ghost), `Icon` (set
  propio SVG), `ScoreRing` (SVG circular), `Chip`, `Toggle`, `Modal`,
  `Sparkline`, `EmptyState`, `Spinner`.
- Sidebar existente (`DesktopSidebar`) ya enlaza `/project/settings` bajo
  "Coordinación" para líderes/admins.

## 9. Flujo de navegación

```
login → onboarding → (app layout: requires active workspace)
   └── /home
       ├── (leader/admin) → /project/settings (5 tabs)
       │      ├── SMART      → PUT /smart-goal + POST /smart-goal/analyze
       │      ├── Metodología→ PUT /methodology
       │      ├── Equipo     → POST/PUT/DELETE /members
       │      ├── KPIs       → PUT /kpis
       │      └── IA         → POST /ai-insights
       └── (member) → redirect /home (403 si intenta /project/settings)
```

## 10. Estructura de carpetas

```
src/features/project-settings/
├── domain/
│   ├── catalog.ts            # metodologías, roles, KPIs (single source)
│   ├── entities.ts           # tipos de salida
│   └── repositories.ts       # interfaces (puertos)
├── application/
│   ├── smart.ts              # score + validación heurística SMART
│   ├── schemas.ts            # DTOs Zod
│   ├── smart.test.ts         # tests unitarios
│   ├── integration.test.ts   # tests de integración (PGlite)
│   └── use-cases/
│       ├── SaveSmartGoal.ts
│       ├── SetMethodology.ts
│       ├── ManageMembers.ts
│       ├── ConfigureKpis.ts
│       └── GenerateAiInsights.ts
├── infrastructure/
│   ├── repositories.ts       # implementaciones Drizzle
│   └── container.ts          # DI del módulo
└── presentation/
    ├── services.ts           # cliente HTTP (fetchJson)
    ├── hooks.ts              # React Query (use* mutations/queries)
    └── components/
        ├── primitives.tsx     # Chip, ScoreRing, Modal, Toggle, ...
        ├── SmartGoalEditor.tsx
        ├── MethodologyPicker.tsx
        ├── TeamManager.tsx
        ├── KpiChips.tsx
        ├── AiInsightsPanel.tsx
        └── ProjectSettingsModule.tsx

src/app/
├── (app)/project/settings/page.tsx   # server: RBAC redirect + render
└── api/workspaces/[id]/
    ├── settings/route.ts
    ├── smart-goal/route.ts
    ├── smart-goal/analyze/route.ts
    ├── methodology/route.ts
    ├── members/route.ts
    ├── members/[memberId]/route.ts
    ├── kpis/route.ts
    └── ai-insights/route.ts

src/server/lib/
├── requireProjectLeader.ts   # RBAC para este módulo
├── projectSettingsAi.ts      # prompts Vertex (SMART + insights)
└── (apiErrors.ts, errors.ts, db.ts reutilizadas)

drizzle/
├── schema/project.ts                    # modelos + relaciones
└── 0000_init.sql                        # migración inicial
```

## 11. Código base frontend

Implementado en `src/features/project-settings/presentation/` (ver §10). Stack:
React 19 + Next 16 + Tailwind 4 + React Query 5 (provider en
`src/app/providers.tsx`). Estado de servidor centralizado en React Query con
clave `["project-settings", workspaceId]` e invalidación tras cada mutación
(`useInvalidateSettings`). Sin estado global nuevo (Zustand ya existe para
otros módulos, no se requiere aquí).

## 12. Código base backend

Route Handlers Next.js (App Router) + casos de uso + repositorios Drizzle.
- **DI**: `getProjectSettingsDeps()` (singleton cacheado, reseteable en tests).
- **Validación**: Zod en el borde de cada route + dentro del caso de uso.
- **RBAC**: `requireProjectLeader` (NextAuth session → membership role).
- **Auditoría**: `PrismaAuditRepository.record` (sobre Drizzle) invocada en cada mutación.
- **IA**: reutiliza `generateJSON` de `gemini.ts` (Vertex AI); fallback
  friendly a 503 si la IA no responde (`toFriendlyGeminiError`).

## 13. Pruebas unitarias

`application/smart.test.ts` (9 tests, sin DB):
- `computeSmartScore`: vacío=0, bonus deadline, full=100.
- `validateSmart`: flag de dimensiones <8 chars.
- Catálogos: 5 metodologías, 11 KPIs, 12 roles, `isLeadershipRole`, `roleName`.

## 14. Pruebas de integración

`application/integration.test.ts` (6 tests, PGlite vía `getTestDb`):
- SMART: crea v1 y versiona a v2; historial ordenado.
- Metodología: 1 primary + 2 secondary; rechaza primary=null.
- Equipo: bloquea demover/eliminar último líder; bloquea email duplicado.
- KPIs: persiste target y registra snapshot.
- Equipo: alta/baja libre de miembros no-líder.

Resultado: **15/15 pasando** (`npx vitest run src/features/project-settings`).

## 15. Estrategia de despliegue

- **DB**: `drizzle-kit migrate` aplica la migración inicial
  (incluye seed de catálogos `KpiDefinition` y `ProjectRole`).
- **Build**: `next build` (Dockerfile existente, Cloud Build via
  `cloudbuild.yaml`). El módulo no añade dependencias nuevas.
- **IA**: requiere `GEMINI_ENABLED=true`, `GOOGLE_CLOUD_PROJECT_ID`,
  `VERTEX_AI_LOCATION` ya usados por el resto de la app; sin IA el módulo
  degrada a 503 friendly en `/smart-goal/analyze` y `/ai-insights`.
- **Feature flag sugerido**: `NEXT_PUBLIC_PROJECT_SETTINGS_AI` para ocultar
  las pestañas de IA en workspaces donde no aplique.
- **Rollback**: la migración sólo añade tablas y columnas nullable → rollback
  seguro (drop). El campo `Membership.status` default `'active'` no rompe
  filas existentes.

## 16. Criterios de aceptación

- AC1: Guardar un SMART completo deja `smartScore ≥ 90` y crea `SmartGoalVersion`.
- AC2: Un miembro no-líder recibe 403/redirect al intentar editar.
- AC3: No es posible dejar el proyecto con 0 líderes activos (409).
- AC4: Invitar un correo ya existente devuelve 409.
- AC5: Sólo puede existir una metodología `primary` por proyecto.
- AC6: Cambiar la metodología principal requiere confirmación en UI.
- AC7: Activar/desactivar un KPI persiste y se refleja tras refetch.
- AC8: `POST /ai-insights` sustituye los insights previos y registra auditoría.
- AC9: Toda mutación escribe un `AuditLog` con `before`/`after`.
- AC10: UI responsive (1 col móvil, 2 col ≥md) y estados loading/empty/error.
- AC11: `npm run lint` y typecheck limpios para el módulo (sin errores propios).
- AC12: Cobertura de tests ≥ 90 % en `application/` y `infrastructure/`.

## 17. Riesgos técnicos

| Riesgo | Impacto | Prob. | Mitigación |
|---|---|---|---|
| Latencia/coste de Vertex AI en `/ai-insights` | Medio | Media | Cache de insights, rate limiting, fallback 503 |
| Alucinación de la IA en draft SMART | Medio | Media | Score heurístico determinista + IA como sugerencia no bloqueante |
| Eliminación accidental del último líder | Alto | Baja | Guarda `countActiveLeaders` en use case + DB |
| Migración en DBs con datos | Medio | Baja | Columnas nullable + defaults; rollback seguro |
| Concurrencia en versionado SMART | Bajo | Baja | Transacción Drizzle en `upsert` |
| Privacidad de emails en invitaciones | Medio | Baja | No exponer lista a no-líderes (RBAC) |
| Catálogo desincronizado DB↔código | Bajo | Media | Catálogo en código como fuente de verdad UI |

## 18. Estimación por tareas

| Tarea | Estimación |
|---|---|
| Schema + migración + catálogos | 4 h |
| Dominio (entidades, repos, catálogo) | 4 h |
| Infraestructura Drizzle + audit | 6 h |
| Casos de uso + schemas + heurística | 8 h |
| Prompts IA (SMART + insights) | 5 h |
| Route handlers (8 endpoints) | 6 h |
| RBAC `requireProjectLeader` | 2 h |
| Frontend servicios + hooks | 4 h |
| Componentes UI (5 secciones) | 16 h |
| Página tabulada + integración layout | 3 h |
| Pruebas unitarias + integración | 8 h |
| Docs + criterios + roadmap | 4 h |
| **Total** | **70 h (~9 dias-persona)** |

## 19. Roadmap de implementación

- **Sprint 1 (MVP)** — Schema, SMART (CRUD + score), Metodología, Equipo
  (invitar/roles), KPIs toggle, RBAC. _(Hecho en esta entrega.)_
- **Sprint 2** — IA: análisis SMART + insights + distribución de trabajo.
  _(Hecho en esta entrega.)_
- **Sprint 3** — Snapshots reales (jobs de cálculo de KPIs), sparklines con
  datos, notificaciones de alertas.
- **Sprint 4** — Aceptación de invitaciones (onboarding del invitado),
  diff visual de versiones SMART, export/reportes, rate limiting por IP.
- **Sprint 5** — Permisos granulares (RBAC por sub-recurso), auditoría
  consultable en UI, métricas de uso de IA.

## 20. Documentación técnica

- Convenciones: feature-based, `domain → application → infrastructure →
  presentation`; errores vía `UserFacingError`; DTOs Zod; `fetchJson`+`ApiError`
  en cliente; React Query con invalidación centralizada.
- Seguridad: JWT/NextAuth existente; RBAC `leader|admin`; auditoría completa;
  rate limiting recomendado en capa de edge (Cloud Run/Gateway).
- Observabilidad: `console.error("[api] error:", ...)` en `jsonError`;
  recomendado añadir trazas para `insight.generate` y `smart_goal.update`.

---

## Cómo probarlo

```bash
# 1. Aplicar migración (incluye seed de catálogos)
npm run db:migrate        # producción / CI
# o: npm run db:push      # desarrollo local rápido

# 2. Tests
npx vitest run src/features/project-settings

# 3. Dev
npm run dev   # entra como leader y abre /project/settings
```

> La IA requiere `GEMINI_ENABLED=true`; sin ella los endpoints de IA
> responden 503 con mensaje friendly y el resto del módulo funciona.
