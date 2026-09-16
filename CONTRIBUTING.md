# 📚 Git Workflow, Branching & Conventional Commits Guide

Este documento define la estrategia de ramificación, el estándar de commits profesionales y las reglas de Pull Request para el equipo de desarrollo.

---

## 🌿 Nomenclatura de Ramas (Branching Strategy)

Antes de empezar a programar cualquier tarea, crea una rama desde la que desees asegurándote de tener la versión más reciente.

### Formato Estándar
```text
tipo/contexto/descripcion-corta
```

### Tipos Permitidos
- `feat/`: Para nuevas funcionalidades de negocio.
- `fix/`: Para arreglar un error / bug.
- `chore/`: Para tareas de configuración o mantenimiento (ej. instalar dependencias, configurar linters/Prisma).
- `ui/`: Para cambios o refactorizaciones de interfaz visual/CSS.

### Ejemplos
- ✅ `feat/auth/discord-login`
- ✅ `ui/dashboard/graph-nodes`
- ✅ `fix/api/progress-calculation`
- ✅ `chore/setup/prisma-schema`
- ❌ `mi-rama-test`
- ❌ `arreglando-el-login`

---

## 📝 Conventional Commits (Commits Profesionales)

Todos los commits deben seguir el estándar de la industria **Conventional Commits**. Esto garantiza un historial limpio, legible y automatizable.

### Formato
```text
tipo(alcance): descripcion en imperativo
```

### Reglas de Oro para la Descripción
1. **Idioma**: En inglés (para coincidir con las reglas del repositorio).
2. **Todo en minúsculas**.
3. **Escribir en modo imperativo** (como dar una orden: `add`, `fix`, `update`; nunca `added` ni `adding`).
4. **Sin punto final**.

### Ejemplos Correctos
- `feat(auth): add discord oauth strategy`
- `fix(ui): resolve overlap on timeline nodes`
- `chore(deps): install spartan ui and tailwind`
- `refactor(api): optimize graph query using jsonb`
- `docs(readme): add local setup instructions`

💡 **Pro-Tip:** Instalen la extensión **"Conventional Commits"** en VS Code / Cursor para autocompletar este formato directamente desde el editor.

---

## ⚡ Reglas para Pull Requests (Protocolo Ágil)

En desarrollos ágiles, los PRs atascados frenan al equipo. Sigan este protocolo:

1. **PRs Pequeños y Frecuentes:** No hagas un PR gigante que abarque todo el módulo. Divide en PRs pequeños ("Layout base", "Cuestionario", "Grafo"). Mientras más pequeño sea el PR, más rápida es la revisión.
2. **Draft PRs (Borradores):** Si estás trabajando en algo complejo, abre un PR de inmediato y márcalo como **Draft** (Borrador). De esta manera el equipo sabe en qué estás trabajando y no duplica esfuerzos.
3. **La Regla del "1 Approve":** Para fusionar (*merge*) a `main`, solo se requiere la aprobación de **1 compañero**. En cuanto recibas el Approve (✅), tú mismo realizas el Merge.
4. **Captura de Pantalla para UI:** Si tu PR modifica o agrega vistas o componentes visuales, incluye obligatoriamente una captura de pantalla en la descripción del PR para acelerar la revisión.

---

## 🔄 Flujo de Trabajo Diario (Paso a Paso)

Sigue este ciclo cada vez que comiences una nueva tarea:

```bash
# 1. Actualizar tu rama local main
git checkout main
git pull origin main

# 2. Crear tu rama de trabajo
git checkout -b feat/ruta/generador-algoritmo

# 3. Programar y realizar commits atómicos
git add .
git commit -m "feat(api): add recommendation algorithm based on tags"

# 4. Sincronizar con main antes de subir (Rebase local)
git fetch origin
git rebase origin/main

# (Si existen conflictos, resuélvelos localmente y ejecuta: git rebase --continue)

# 5. Subir tu rama al repositorio remoto
git push origin feat/ruta/generador-algoritmo
```
